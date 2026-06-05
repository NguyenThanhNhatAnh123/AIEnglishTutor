package com.ai.englishsystem.submission.service;

import com.ai.englishsystem.ai.repository.AiResultRepository;
import com.ai.englishsystem.common.exception.BadRequestException;
import com.ai.englishsystem.common.exception.ForbiddenException;
import com.ai.englishsystem.common.exception.NotFoundException;
import com.ai.englishsystem.common.security.AccessControlService;
import com.ai.englishsystem.common.util.SecurityUtils;
import com.ai.englishsystem.exam.entity.Exam;
import com.ai.englishsystem.exam.repository.ExamRepository;
import com.ai.englishsystem.result.entity.Score;
import com.ai.englishsystem.result.entity.Feedback;
import com.ai.englishsystem.result.entity.WritingReviewStatus;
import com.ai.englishsystem.result.repository.FeedbackRepository;
import com.ai.englishsystem.result.repository.ScoreRepository;
import com.ai.englishsystem.speaking.service.SpeakingFileStorage;
import com.ai.englishsystem.student.entity.Student;
import com.ai.englishsystem.student.repository.StudentRepository;
import com.ai.englishsystem.submission.dto.SubmissionListResponse;
import com.ai.englishsystem.submission.dto.SubmissionResponse;
import com.ai.englishsystem.submission.dto.SubmissionWorkspaceResponse;
import com.ai.englishsystem.submission.entity.Answer;
import com.ai.englishsystem.submission.entity.Submission;
import com.ai.englishsystem.submission.entity.SubmissionStatus;
import com.ai.englishsystem.submission.mapper.SubmissionMapper;
import com.ai.englishsystem.submission.mapper.SubmissionReviewSummary;
import com.ai.englishsystem.submission.repository.AnswerRepository;
import com.ai.englishsystem.submission.repository.SubmissionRepository;
import com.ai.englishsystem.submission.repository.SubmissionSuspiciousEventRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.core.io.Resource;
import org.springframework.core.io.UrlResource;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

import java.net.MalformedURLException;
import java.time.ZoneId;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.function.Function;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class SubmissionService {

    private final SubmissionRepository submissionRepository;
    private final ExamRepository examRepository;
    private final StudentRepository studentRepository;
    private final ScoreRepository scoreRepository;
    private final AnswerRepository answerRepository;
    private final AiResultRepository aiResultRepository;
    private final FeedbackRepository feedbackRepository;
    private final SpeakingFileStorage speakingFileStorage;
    private final SubmissionSuspiciousEventRepository submissionSuspiciousEventRepository;
    private final AccessControlService accessControlService;
    private final SubmissionMapper submissionMapper;
    private final AnswerService answerService;

    /**
     * Teacher/Admin: list submissions for a given exam.
     * Teachers can only see submissions for exams they own.
     */
    @Transactional(readOnly = true)
    public List<SubmissionListResponse> listByExam(Integer examId) {
        Exam exam = examRepository.findById(examId)
                .orElseThrow(() -> new NotFoundException("Exam", examId));

        if (SecurityUtils.hasRole("TEACHER") || SecurityUtils.hasRole("ADMIN")) {
            accessControlService.assertTeacherOrAdminOwnsExam(
                    exam,
                    "You do not have permission to view submissions for this exam"
            );
        }

        List<Submission> submissions = submissionRepository.findByExamOrderByLatestWorkDateDesc(exam);
        if (submissions.isEmpty()) {
            return List.of();
        }
        Map<Integer, Float> scoreBySubmissionId = scoreRepository.findBySubmissionIn(submissions).stream()
                .collect(Collectors.toMap(
                        sc -> sc.getSubmission().getId(),
                        Score::getTotalScore,
                        (a, b) -> a
                ));

        return submissions.stream()
                .map(s -> submissionMapper.toListResponse(s, scoreBySubmissionId.get(s.getId())))
                .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public SubmissionWorkspaceResponse workspaceByExam(Integer examId) {
        List<SubmissionListResponse> submissions = listByExam(examId);
        List<Integer> submissionIds = submissions.stream()
                .map(SubmissionListResponse::getId)
                .filter(java.util.Objects::nonNull)
                .toList();
        return SubmissionWorkspaceResponse.builder()
                .submissions(submissions)
                .answersBySubmissionId(answerService.getAnswersForTeacherBatch(submissionIds))
                .build();
    }

    /**
     * Student: list own submission history with scores.
     */
    @Transactional(readOnly = true)
    public List<SubmissionListResponse> listMySubmissions() {
        Integer userId = SecurityUtils.getCurrentUserId();
        Student student = studentRepository.findByUser_Id(userId)
                .orElseThrow(() -> new ForbiddenException("Student profile not found for current user"));

        List<Submission> submissions = submissionRepository.findByStudentOrderByStartTimeDesc(student);
        List<Integer> submissionIds = submissions.stream().map(Submission::getId).toList();

        // Batch load scores to avoid N+1 queries.
        Map<Integer, Float> scoreBySubmissionId = scoreRepository.findBySubmissionIn(submissions).stream()
                .collect(Collectors.toMap(
                        sc -> sc.getSubmission().getId(),
                        Score::getTotalScore,
                        (a, b) -> a // pick first if duplicate
                ));

        Map<Integer, SubmissionReviewSummary> reviewBySubmissionId = resolveReviewOverview(submissionIds);

        return submissions.stream()
                .map(s -> {
                    SubmissionReviewSummary overview = reviewBySubmissionId.getOrDefault(s.getId(), SubmissionReviewSummary.empty());
                    return submissionMapper.toListResponse(s, resolveStudentVisibleTotalScore(s, scoreBySubmissionId, overview), overview);
                })
                .collect(Collectors.toList());
    }

    private Float resolveStudentVisibleTotalScore(
            Submission s,
            Map<Integer, Float> scoreMap,
            SubmissionReviewSummary overview
    ) {
        if (s.getStatus() == SubmissionStatus.IN_PROGRESS) {
            return null;
        }
        if (!overview.allSubjectivePublished()) {
            return null;
        }
        return scoreMap.get(s.getId());
    }

    private Map<Integer, SubmissionReviewSummary> resolveReviewOverview(List<Integer> submissionIds) {
        if (submissionIds == null || submissionIds.isEmpty()) {
            return Map.of();
        }

        List<Answer> answers = answerRepository.findBySubmissionIdInFetchQuestionOnly(submissionIds);
        Map<Integer, Feedback> feedbackByAnswerId = feedbackRepository.findByAnswerIn(answers).stream()
                .filter(feedback -> feedback.getAnswer() != null && feedback.getAnswer().getId() != null)
                .collect(Collectors.toMap(feedback -> feedback.getAnswer().getId(), Function.identity()));

        Map<Integer, List<Answer>> answersBySubmissionId = answers.stream()
                .collect(Collectors.groupingBy(answer -> answer.getSubmission().getId()));

        return submissionIds.stream()
                .collect(Collectors.toMap(
                        Function.identity(),
                        submissionId -> reviewOverview(answersBySubmissionId.getOrDefault(submissionId, List.of()), feedbackByAnswerId)
                ));
    }

    private SubmissionReviewSummary reviewOverview(List<Answer> answers, Map<Integer, Feedback> feedbackByAnswerId) {
        int writingTotal = 0;
        int writingPublished = 0;
        int speakingTotal = 0;
        int speakingPublished = 0;

        for (Answer answer : answers) {
            String type = answer.getQuestion() != null ? answer.getQuestion().getQuestionType() : null;
            String normalized = type != null ? type.trim().toUpperCase() : "";
            if (!Set.of("WRITING", "SPEAKING").contains(normalized)) {
                continue;
            }
            Feedback feedback = feedbackByAnswerId.get(answer.getId());
            boolean published = feedback != null && feedback.getReviewStatus() == WritingReviewStatus.PUBLISHED;
            if ("WRITING".equals(normalized)) {
                writingTotal++;
                if (published) writingPublished++;
            } else {
                speakingTotal++;
                if (published) speakingPublished++;
            }
        }

        return new SubmissionReviewSummary(writingTotal, writingPublished, speakingTotal, speakingPublished);
    }

    /**
     * Teacher/Admin/Student: get a submission by id.
     * - ADMIN: any submission
     * - TEACHER: only submissions belonging to exams they own
     * - STUDENT: only own submissions
     */
    @Transactional(readOnly = true)
    public SubmissionResponse getById(Integer submissionId) {
        Submission submission = submissionRepository.findWithAssociationsById(submissionId)
                .orElseThrow(() -> new NotFoundException("Submission", submissionId));

        accessControlService.assertCurrentUserCanViewSubmission(submission);

        Integer dur = submission.getExam() != null ? submission.getExam().getDurationMinutes() : null;
        int effectiveDur = dur != null ? dur : 60;
        LocalDateTime effectiveStart = submission.getStartTime() != null ? submission.getStartTime() : LocalDateTime.now();
        LocalDateTime deadline = effectiveStart.plusMinutes(effectiveDur);
        long deadlineEpochMs = deadline.atZone(ZoneId.systemDefault()).toInstant().toEpochMilli();

        var exam = submission.getExam();
        String examTypeName = null;
        if (exam != null && exam.getExamType() != null) {
            examTypeName = exam.getExamType().name();
        }

        return SubmissionResponse.builder()
                .id(submission.getId())
                .examId(exam != null ? exam.getId() : null)
                .examTitle(exam != null ? exam.getTitle() : null)
                .examType(examTypeName)
                .studentId(submission.getStudent() != null ? submission.getStudent().getId() : null)
                .attemptId(submission.getExamAttempt() != null ? submission.getExamAttempt().getId() : null)
                .durationMinutes(effectiveDur)
                .deadlineAt(deadline)
                .deadlineEpochMs(deadlineEpochMs)
                .startTime(submission.getStartTime())
                .submitTime(submission.getSubmitTime())
                .status(submission.getStatus() != null ? submission.getStatus().name() : null)
                .build();
    }

    /**
     * Deletes a submission and removes speaking files from disk. Teacher must own the exam (or admin).
     */
    @Transactional
    public void deleteSubmission(Integer submissionId) {
        Submission submission = submissionRepository.findWithAssociationsById(submissionId)
                .orElseThrow(() -> new NotFoundException("Submission", submissionId));

        accessControlService.assertTeacherOrAdminCanAccessSubmission(
                submission,
                "You do not have permission to delete this submission"
        );

        List<Answer> answers = answerRepository.findBySubmission(submission);
        if (!answers.isEmpty()) {
            feedbackRepository.deleteByAnswerIn(answers);
            aiResultRepository.deleteByAnswerIn(answers);
        }
        deleteSpeakingFilesAfterCommit(answers.stream()
                .map(Answer::getSpeakingAudioUrl)
                .filter(url -> url != null && !url.isBlank())
                .toList());
        scoreRepository.findFirstBySubmissionOrderByIdAsc(submission).ifPresent(scoreRepository::delete);
        // Delete suspicious events BEFORE deleting submission (Bug #4 fix)
        submissionSuspiciousEventRepository.deleteBySubmission(submission);
        submissionRepository.delete(submission);
    }

    /**
     * Teacher/Admin: download normalized speaking MP3 for an answer.
     */
    @Transactional(readOnly = true)
    public Resource loadSpeakingAudioResource(Integer submissionId, Integer answerId) {
        Answer answer = answerRepository.findWithSubmissionGraphById(answerId)
                .orElseThrow(() -> new NotFoundException("Answer", answerId));
        if (!answer.getSubmission().getId().equals(submissionId)) {
            throw new BadRequestException("Answer does not belong to this submission");
        }
        Submission submission = answer.getSubmission();
        accessControlService.assertCurrentUserCanViewSubmission(submission);
        String url = answer.getSpeakingAudioUrl();
        if (url == null || url.isBlank()) {
            throw new NotFoundException("No speaking audio for this answer");
        }
        try {
            var path = speakingFileStorage.resolveFromPublicUrl(url);
            if (path == null || !java.nio.file.Files.exists(path)) {
                throw new NotFoundException("Speaking file missing on disk");
            }
            return new UrlResource(path.toUri());
        } catch (MalformedURLException e) {
            throw new BadRequestException("Invalid file URL");
        }
    }

    public String speakingDownloadFilename(Integer answerId) {
        return "speaking-answer-" + answerId + ".mp3";
    }

    private void deleteSpeakingFilesAfterCommit(List<String> urls) {
        if (urls == null || urls.isEmpty()) {
            return;
        }
        Runnable deleteFiles = () -> urls.forEach(speakingFileStorage::deleteIfExists);
        if (!TransactionSynchronizationManager.isSynchronizationActive()) {
            deleteFiles.run();
            return;
        }
        TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
            @Override
            public void afterCommit() {
                deleteFiles.run();
            }
        });
    }

}
