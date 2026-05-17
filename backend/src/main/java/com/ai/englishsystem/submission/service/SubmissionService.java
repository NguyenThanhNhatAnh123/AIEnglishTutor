package com.ai.englishsystem.submission.service;

import com.ai.englishsystem.ai.repository.AiResultRepository;
import com.ai.englishsystem.common.exception.BadRequestException;
import com.ai.englishsystem.common.exception.ForbiddenException;
import com.ai.englishsystem.common.exception.NotFoundException;
import com.ai.englishsystem.result.service.ScoreService;
import com.ai.englishsystem.common.util.SecurityUtils;
import com.ai.englishsystem.exam.entity.Exam;
import com.ai.englishsystem.exam.repository.ExamRepository;
import com.ai.englishsystem.exam.service.StudentExamService;
import com.ai.englishsystem.result.entity.Score;
import com.ai.englishsystem.result.entity.Feedback;
import com.ai.englishsystem.result.entity.WritingReviewStatus;
import com.ai.englishsystem.result.repository.FeedbackRepository;
import com.ai.englishsystem.result.repository.ScoreRepository;
import com.ai.englishsystem.speaking.service.SpeakingFileStorage;
import com.ai.englishsystem.student.entity.Student;
import com.ai.englishsystem.student.repository.StudentRepository;
import com.ai.englishsystem.submission.dto.StartSubmissionRequest;
import com.ai.englishsystem.submission.dto.SubmissionListResponse;
import com.ai.englishsystem.submission.dto.SubmissionResponse;
import com.ai.englishsystem.submission.dto.SubmitExamRequest;
import com.ai.englishsystem.submission.dto.SubmitSubmissionRequest;
import com.ai.englishsystem.submission.entity.Answer;
import com.ai.englishsystem.submission.entity.Submission;
import com.ai.englishsystem.submission.entity.SubmissionStatus;
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
    private final StudentExamService studentExamService;
    private final StudentRepository studentRepository;
    private final ScoreRepository scoreRepository;
    private final AnswerRepository answerRepository;
    private final AiResultRepository aiResultRepository;
    private final FeedbackRepository feedbackRepository;
    private final SpeakingFileStorage speakingFileStorage;
    private final ScoreService scoreService;
    private final SubmissionSuspiciousEventRepository submissionSuspiciousEventRepository;

    @Transactional
    public SubmissionResponse start(StartSubmissionRequest request) {
        return studentExamService.startExam(request.getExamId());
    }

    @Transactional
    public SubmissionResponse submit(SubmitSubmissionRequest request) {
        var graded = studentExamService.submitExam(
                request.getSubmissionId(),
                SubmitExamRequest.builder()
                        .clientTimeSpentSeconds(request.getClientTimeSpentSeconds())
                        .tabSwitchCount(request.getTabSwitchCount())
                        .focusLossCount(request.getFocusLossCount())
                        .copyPasteCount(request.getCopyPasteCount())
                        .suspiciousEventCount(request.getSuspiciousEventCount())
                        .deviceType(request.getDeviceType())
                        .deviceLabel(request.getDeviceLabel())
                        .build());
        Submission persisted = submissionRepository.findWithAssociationsById(graded.getSubmissionId())
                .orElse(null);
        return SubmissionResponse.builder()
                .id(graded.getSubmissionId())
                .examId(graded.getExamId())
                .studentId(graded.getStudentId())
                .attemptId(persisted != null && persisted.getExamAttempt() != null
                        ? persisted.getExamAttempt().getId() : null)
                .durationMinutes(persisted != null && persisted.getExam() != null
                        ? persisted.getExam().getDurationMinutes() : null)
                .startTime(persisted != null ? persisted.getStartTime() : null)
                .submitTime(graded.getSubmitTime())
                .status(graded.getStatus())
                .build();
    }

    /**
     * Teacher/Admin: list submissions for a given exam.
     * Teachers can only see submissions for exams they own.
     */
    @Transactional(readOnly = true)
    public List<SubmissionListResponse> listByExam(Integer examId) {
        Exam exam = examRepository.findById(examId)
                .orElseThrow(() -> new NotFoundException("Exam", examId));

        // Ownership check: teachers can only view their own exam's submissions
        if (SecurityUtils.hasRole("TEACHER") && !SecurityUtils.hasRole("ADMIN")) {
            Integer currentUserId = SecurityUtils.getCurrentUserId();
            Integer examOwnerUserId = exam.getTeacher().getUser().getId();
            if (!currentUserId.equals(examOwnerUserId)) {
                throw new ForbiddenException("You do not have permission to view submissions for this exam");
            }
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
                .map(s -> toListResponse(s, scoreBySubmissionId.get(s.getId())))
                .collect(Collectors.toList());
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

        // Batch load scores to avoid N+1 (Bug fix: LOW-04)
        Map<Integer, Float> scoreBySubmissionId = scoreRepository.findBySubmissionIn(submissions).stream()
                .collect(Collectors.toMap(
                        sc -> sc.getSubmission().getId(),
                        Score::getTotalScore,
                        (a, b) -> a // pick first if duplicate
                ));

        Map<Integer, SubmissionReviewOverview> reviewBySubmissionId = resolveReviewOverview(submissionIds);

        return submissions.stream()
                .map(s -> {
                    SubmissionReviewOverview overview = reviewBySubmissionId.getOrDefault(s.getId(), SubmissionReviewOverview.empty());
                    return toListResponse(s, resolveStudentVisibleTotalScore(s, scoreBySubmissionId, overview), overview);
                })
                .collect(Collectors.toList());
    }

    private Float resolveStudentVisibleTotalScore(
            Submission s,
            Map<Integer, Float> scoreMap,
            SubmissionReviewOverview overview
    ) {
        if (s.getStatus() == SubmissionStatus.IN_PROGRESS) {
            return null;
        }
        if (!overview.allSubjectivePublished()) {
            return null;
        }
        return scoreMap.get(s.getId());
    }

    private Map<Integer, SubmissionReviewOverview> resolveReviewOverview(List<Integer> submissionIds) {
        if (submissionIds == null || submissionIds.isEmpty()) {
            return Map.of();
        }

        List<Answer> answers = answerRepository.findBySubmissionIdInFetchQuestion(submissionIds);
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

    private SubmissionReviewOverview reviewOverview(List<Answer> answers, Map<Integer, Feedback> feedbackByAnswerId) {
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

        return new SubmissionReviewOverview(writingTotal, writingPublished, speakingTotal, speakingPublished);
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

        if (SecurityUtils.hasRole("ADMIN")) {
            // ok
        } else if (SecurityUtils.hasRole("TEACHER")) {
            Integer currentUserId = SecurityUtils.getCurrentUserId();
            Integer ownerUserId = submission.getExam().getTeacher().getUser().getId();
            if (!currentUserId.equals(ownerUserId)) {
                throw new ForbiddenException("You do not have permission to view this submission");
            }
        } else if (SecurityUtils.hasRole("STUDENT")) {
            Integer currentUserId = SecurityUtils.getCurrentUserId();
            Student student = studentRepository.findByUser_Id(currentUserId)
                    .orElseThrow(() -> new ForbiddenException("Student profile not found for current user"));
            if (!submission.getStudent().getId().equals(student.getId())) {
                throw new ForbiddenException("You do not have permission to view this submission");
            }
        } else {
            throw new ForbiddenException("Not allowed");
        }

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

    private SubmissionListResponse toListResponse(Submission s, Float totalScore) {
        return toListResponse(s, totalScore, SubmissionReviewOverview.empty());
    }

    private SubmissionListResponse toListResponse(Submission s, Float totalScore, SubmissionReviewOverview review) {
        LocalDateTime end = s.getEndTime() != null ? s.getEndTime() : s.getSubmitTime();
        return SubmissionListResponse.builder()
                .id(s.getId())
                .examId(s.getExam().getId())
                .examTitle(s.getExam().getTitle())
                .studentId(s.getStudent().getId())
                .studentName(s.getStudent().getUser().getFullName())
                .status(s.getStatus().name())
                .startTime(s.getStartTime())
                .submitTime(s.getSubmitTime())
                .endTime(end)
                .durationSeconds(s.getDuration())
                .answeredQuestions(s.getAnsweredQuestions())
                .totalQuestions(s.getTotalQuestions())
                .completionPercent(s.getCompletionPercent())
                .tabSwitchCount(s.getTabSwitchCount())
                .focusLossCount(s.getFocusLossCount())
                .copyPasteCount(s.getCopyPasteCount())
                .suspiciousEventCount(s.getSuspiciousEventCount())
                .deviceType(s.getDeviceType())
                .deviceLabel(s.getDeviceLabel())
                .totalScore(totalScore)
                .writingReviewStatus(review.writingStatus())
                .speakingReviewStatus(review.speakingStatus())
                .subjectiveReviewStatus(review.subjectiveStatus())
                .writingAnswerCount(review.writingTotal())
                .speakingAnswerCount(review.speakingTotal())
                .build();
    }

    /**
     * Deletes a submission and removes speaking files from disk. Teacher must own the exam (or admin).
     */
    @Transactional
    public void deleteSubmission(Integer submissionId) {
        Submission submission = submissionRepository.findWithAssociationsById(submissionId)
                .orElseThrow(() -> new NotFoundException("Submission", submissionId));

        if (SecurityUtils.hasRole("ADMIN")) {
            // ok
        } else if (SecurityUtils.hasRole("TEACHER")) {
            Integer currentUserId = SecurityUtils.getCurrentUserId();
            Integer ownerUserId = submission.getExam().getTeacher().getUser().getId();
            if (!currentUserId.equals(ownerUserId)) {
                throw new ForbiddenException("You do not have permission to delete this submission");
            }
        } else {
            throw new ForbiddenException("Not allowed");
        }

        List<Answer> answers = answerRepository.findBySubmissionFetchQuestion(submission);
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
        if (SecurityUtils.hasRole("ADMIN")) {
            // ok
        } else if (SecurityUtils.hasRole("TEACHER")) {
            Integer currentUserId = SecurityUtils.getCurrentUserId();
            Integer ownerUserId = submission.getExam().getTeacher().getUser().getId();
            if (!currentUserId.equals(ownerUserId)) {
                throw new ForbiddenException("You do not have permission to download this file");
            }
        } else if (SecurityUtils.hasRole("STUDENT")) {
            Integer currentUserId = SecurityUtils.getCurrentUserId();
            Student student = studentRepository.findByUser_Id(currentUserId)
                    .orElseThrow(() -> new ForbiddenException("Student profile not found for current user"));
            if (!submission.getStudent().getId().equals(student.getId())) {
                throw new ForbiddenException("You do not have permission to download this file");
            }
        } else {
            throw new ForbiddenException("Not allowed");
        }
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

    private record SubmissionReviewOverview(
            int writingTotal,
            int writingPublished,
            int speakingTotal,
            int speakingPublished
    ) {
        static SubmissionReviewOverview empty() {
            return new SubmissionReviewOverview(0, 0, 0, 0);
        }

        boolean allSubjectivePublished() {
            return isPublished(writingTotal, writingPublished) && isPublished(speakingTotal, speakingPublished);
        }

        String writingStatus() {
            return status(writingTotal, writingPublished);
        }

        String speakingStatus() {
            return status(speakingTotal, speakingPublished);
        }

        String subjectiveStatus() {
            int total = writingTotal + speakingTotal;
            int published = writingPublished + speakingPublished;
            return status(total, published);
        }

        private static boolean isPublished(int total, int published) {
            return total == 0 || published == total;
        }

        private static String status(int total, int published) {
            if (total == 0) {
                return "NOT_REQUIRED";
            }
            return published == total ? "PUBLISHED" : "PENDING";
        }
    }
}
