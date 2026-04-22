package com.ai.englishsystem.submission.service;

import com.ai.englishsystem.ai.repository.AiResultRepository;
import com.ai.englishsystem.common.exception.BadRequestException;
import com.ai.englishsystem.common.exception.ForbiddenException;
import com.ai.englishsystem.common.exception.NotFoundException;
import com.ai.englishsystem.common.util.SecurityUtils;
import com.ai.englishsystem.exam.entity.Exam;
import com.ai.englishsystem.exam.repository.ExamRepository;
import com.ai.englishsystem.exam.service.StudentExamService;
import com.ai.englishsystem.result.entity.Score;
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
import com.ai.englishsystem.submission.repository.AnswerRepository;
import com.ai.englishsystem.submission.repository.SubmissionRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.core.io.Resource;
import org.springframework.core.io.UrlResource;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.net.MalformedURLException;
import java.time.LocalDateTime;
import java.util.List;
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

        return submissionRepository.findByExam(exam).stream()
                .map(s -> toListResponse(s, fetchTotalScore(s)))
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

        return submissionRepository.findByStudentOrderByStartTimeDesc(student).stream()
                .map(s -> toListResponse(s, fetchTotalScore(s)))
                .collect(Collectors.toList());
    }

    private Float fetchTotalScore(Submission s) {
        return scoreRepository.findFirstBySubmissionOrderByIdAsc(s)
                .map(Score::getTotalScore)
                .orElse(null);
    }

    private SubmissionListResponse toListResponse(Submission s, Float totalScore) {
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
        for (Answer a : answers) {
            feedbackRepository.findByAnswer(a).ifPresent(feedbackRepository::delete);
            aiResultRepository.findByAnswer(a).ifPresent(aiResultRepository::delete);
            speakingFileStorage.deleteIfExists(a.getSpeakingAudioUrl());
        }
        scoreRepository.findFirstBySubmissionOrderByIdAsc(submission).ifPresent(scoreRepository::delete);
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
}
