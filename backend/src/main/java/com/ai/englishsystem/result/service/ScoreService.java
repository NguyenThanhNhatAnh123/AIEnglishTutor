package com.ai.englishsystem.result.service;

import com.ai.englishsystem.ai.entity.AiResult;
import com.ai.englishsystem.ai.repository.AiResultRepository;
import com.ai.englishsystem.common.exception.ForbiddenException;
import com.ai.englishsystem.common.exception.NotFoundException;
import com.ai.englishsystem.common.util.SecurityUtils;
import com.ai.englishsystem.result.dto.ScoreResponse;
import com.ai.englishsystem.result.entity.Score;
import com.ai.englishsystem.result.entity.Feedback;
import com.ai.englishsystem.result.repository.FeedbackRepository;
import com.ai.englishsystem.result.repository.ScoreRepository;
import com.ai.englishsystem.student.entity.Student;
import com.ai.englishsystem.student.repository.StudentRepository;
import com.ai.englishsystem.submission.entity.Answer;
import com.ai.englishsystem.submission.entity.Submission;
import com.ai.englishsystem.submission.repository.AnswerRepository;
import com.ai.englishsystem.submission.repository.SubmissionRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class ScoreService {

    private final ScoreRepository scoreRepository;
    private final SubmissionRepository submissionRepository;
    private final StudentRepository studentRepository;
    private final AnswerRepository answerRepository;
    private final AiResultRepository aiResultRepository;
    private final FeedbackRepository feedbackRepository;

    @Transactional(readOnly = true)
    public ScoreResponse getBySubmissionId(Integer submissionId) {
        Submission submission = submissionRepository.findWithAssociationsById(submissionId)
                .orElseThrow(() -> new NotFoundException("Submission", submissionId));

        if (SecurityUtils.hasRole("ADMIN")) {
            // admins can view any score
        } else if (SecurityUtils.hasRole("TEACHER")) {
            Integer currentUserId = SecurityUtils.getCurrentUserId();
            Integer ownerUserId = submission.getExam().getTeacher().getUser().getId();
            if (!currentUserId.equals(ownerUserId)) {
                throw new ForbiddenException("Cannot view scores for another teacher's exam");
            }
        } else {
            Integer userId = SecurityUtils.getCurrentUserId();
            Student student = studentRepository.findByUser_Id(userId)
                    .orElseThrow(() -> new ForbiddenException("Student profile not found for current user"));
            if (!submission.getStudent().getId().equals(student.getId())) {
                throw new ForbiddenException("Cannot view another student's score");
            }
        }

        return scoreRepository.findFirstBySubmissionOrderByIdAsc(submission)
                .map(this::toResponse)
                .orElseThrow(() -> new NotFoundException("Score not found for submission"));
    }

    private ScoreResponse toResponse(Score score) {
        Submission submission = score.getSubmission();
        return ScoreResponse.builder()
                .id(score.getId())
                .submissionId(submission.getId())
                .mcScore(score.getMcScore())
                .writingScore(score.getWritingScore())
                .speakingScore(score.getSpeakingScore())
                .totalScore(score.getTotalScore())
                .feedback(resolveFeedback(submission))
                .tabSwitchCount(submission.getTabSwitchCount())
                .focusLossCount(submission.getFocusLossCount())
                .copyPasteCount(submission.getCopyPasteCount())
                .suspiciousEventCount(submission.getSuspiciousEventCount())
                .deviceType(submission.getDeviceType())
                .deviceLabel(submission.getDeviceLabel())
                .gradedBy(score.getGradedBy())
                .gradedAt(score.getGradedAt())
                .build();
    }

    private String resolveFeedback(Submission submission) {
        List<Answer> answers = answerRepository.findBySubmissionFetchQuestion(submission);
        if (answers.isEmpty()) {
            return null;
        }

        Map<Integer, Feedback> feedbackByAnswerId = feedbackRepository.findByAnswerIn(answers).stream()
                .filter(f -> f.getAnswer() != null && f.getAnswer().getId() != null)
                .collect(Collectors.toMap(f -> f.getAnswer().getId(), Function.identity()));

        Map<Integer, AiResult> aiResultByAnswerId = aiResultRepository.findByAnswerIn(answers).stream()
                .filter(r -> r.getAnswer() != null && r.getAnswer().getId() != null)
                .collect(Collectors.toMap(r -> r.getAnswer().getId(), Function.identity()));

        String joined = answers.stream()
                .map(answer -> formatFeedback(answer, feedbackByAnswerId.get(answer.getId()), aiResultByAnswerId.get(answer.getId())))
                .filter(this::hasText)
                .collect(Collectors.joining("\n\n"));

        return hasText(joined) ? joined : null;
    }

    private String formatFeedback(Answer answer, Feedback feedback, AiResult aiResult) {
        String text = null;
        if (feedback != null && hasText(feedback.getAiFeedback())) {
            text = feedback.getAiFeedback().trim();
        } else if (aiResult != null && hasText(aiResult.getFeedback())) {
            text = aiResult.getFeedback().trim();
        }

        if (!hasText(text)) {
            return null;
        }

        Integer questionId = answer.getQuestion() != null ? answer.getQuestion().getId() : null;
        return questionId != null ? "Question #" + questionId + ": " + text : text;
    }

    private boolean hasText(String value) {
        return value != null && !value.isBlank();
    }
}
