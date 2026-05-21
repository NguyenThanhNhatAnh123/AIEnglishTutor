package com.ai.englishsystem.result.service;

import com.ai.englishsystem.ai.dto.WritingScoreRequest;
import com.ai.englishsystem.ai.service.AiConcurrencyLimiter;
import com.ai.englishsystem.ai.service.AiScoringService;
import com.ai.englishsystem.common.exception.BadRequestException;
import com.ai.englishsystem.common.exception.NotFoundException;
import com.ai.englishsystem.common.security.AccessControlService;
import com.ai.englishsystem.common.util.SecurityUtils;
import com.ai.englishsystem.result.dto.UpdateWritingReviewRequest;
import com.ai.englishsystem.result.dto.WritingReviewResponse;
import com.ai.englishsystem.result.entity.Feedback;
import com.ai.englishsystem.result.entity.WritingReviewStatus;
import com.ai.englishsystem.result.repository.FeedbackRepository;
import com.ai.englishsystem.submission.entity.Answer;
import com.ai.englishsystem.submission.repository.AnswerRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;

@Service
@RequiredArgsConstructor
public class WritingReviewService {

    private final AnswerRepository answerRepository;
    private final FeedbackRepository feedbackRepository;
    private final AiScoringService aiScoringService;
    private final AiConcurrencyLimiter aiConcurrencyLimiter;
    private final AccessControlService accessControlService;
    private final ReviewScoreAggregator reviewScoreAggregator;

    public WritingReviewResponse generateDraft(Integer answerId, String customPrompt) {
        Answer answer = loadWritingAnswer(answerId);
        accessControlService.assertTeacherOrAdminCanManageAnswer(
                answer,
                "Cannot manage writing reviews for another teacher's exam"
        );

        var ai = aiConcurrencyLimiter.run(() -> aiScoringService.scoreWriting(WritingScoreRequest.builder()
                .answerId(answerId)
                .essayText(answer.getAnswerText())
                .customPrompt(customPrompt)
                .build(), true));

        Feedback feedback = feedbackRepository.findByAnswer(answer)
                .orElseGet(() -> Feedback.builder().answer(answer).build());
        feedback.setAnswer(answer);
        feedback.setReviewStatus(WritingReviewStatus.DRAFT);
        feedback.setAiFeedback(trimToNull(ai.getFeedback()));
        feedback.setDraftScore(ai.getOverallScore() != null ? clampScore(ai.getOverallScore() * 10f) : null);
        feedback.setCustomPrompt(trimToNull(customPrompt));
        feedback = feedbackRepository.save(feedback);
        return toResponse(feedback);
    }

    @Transactional
    public WritingReviewResponse updateDraft(Integer answerId, UpdateWritingReviewRequest request) {
        Answer answer = loadWritingAnswer(answerId);
        accessControlService.assertTeacherOrAdminCanManageAnswer(
                answer,
                "Cannot manage writing reviews for another teacher's exam"
        );

        if (request == null || (request.getScore() == null && !hasText(request.getFeedback()))) {
            throw new BadRequestException("Provide score or feedback to update draft review");
        }

        Feedback feedback = feedbackRepository.findByAnswer(answer)
                .orElseGet(() -> Feedback.builder().answer(answer).build());
        feedback.setReviewStatus(WritingReviewStatus.DRAFT);
        if (request.getScore() != null) {
            feedback.setDraftScore(clampScore(request.getScore()));
        }
        if (request.getFeedback() != null) {
            feedback.setAiFeedback(trimToNull(request.getFeedback()));
        }
        feedback = feedbackRepository.save(feedback);
        return toResponse(feedback);
    }

    @Transactional
    public WritingReviewResponse approveAndPublish(Integer answerId) {
        Answer answer = loadWritingAnswer(answerId);
        accessControlService.assertTeacherOrAdminCanManageAnswer(
                answer,
                "Cannot manage writing reviews for another teacher's exam"
        );

        Feedback feedback = feedbackRepository.findByAnswer(answer)
                .orElseThrow(() -> new BadRequestException("No draft writing review found"));
        String draftFeedback = trimToNull(feedback.getAiFeedback());
        Float draftScore = feedback.getDraftScore();
        if (draftFeedback == null && draftScore == null) {
            throw new BadRequestException("Draft review is empty and cannot be published");
        }

        Integer currentUserId = SecurityUtils.getCurrentUserId();
        feedback.setTeacherFeedback(draftFeedback);
        feedback.setPublishedScore(draftScore);
        feedback.setReviewStatus(WritingReviewStatus.PUBLISHED);
        feedback.setPublishedBy(currentUserId);
        feedback.setPublishedAt(LocalDateTime.now());
        feedback = feedbackRepository.save(feedback);

        reviewScoreAggregator.refreshSubjectiveScore(answer.getSubmission(), "WRITING", currentUserId);
        return toResponse(feedback);
    }

    @Transactional
    public WritingReviewResponse revertToDraft(Integer answerId) {
        Answer answer = loadWritingAnswer(answerId);
        accessControlService.assertTeacherOrAdminCanManageAnswer(
                answer,
                "Cannot manage writing reviews for another teacher's exam"
        );

        Feedback feedback = feedbackRepository.findByAnswer(answer)
                .orElseThrow(() -> new BadRequestException("No writing review found"));
        feedback.setReviewStatus(WritingReviewStatus.DRAFT);
        feedback.setTeacherFeedback(null);
        feedback.setPublishedScore(null);
        feedback.setPublishedBy(null);
        feedback.setPublishedAt(null);
        feedback = feedbackRepository.save(feedback);

        reviewScoreAggregator.refreshSubjectiveScore(answer.getSubmission(), "WRITING", SecurityUtils.getCurrentUserId());
        return toResponse(feedback);
    }

    private Answer loadWritingAnswer(Integer answerId) {
        Answer answer = answerRepository.findWithSubmissionGraphById(answerId)
                .orElseThrow(() -> new NotFoundException("Answer", answerId));
        String type = normalizeType(answer.getQuestion() != null ? answer.getQuestion().getQuestionType() : null);
        if (!"WRITING".equals(type)) {
            throw new BadRequestException("Answer is not a writing answer");
        }
        return answer;
    }

    private WritingReviewResponse toResponse(Feedback feedback) {
        return WritingReviewResponse.builder()
                .answerId(feedback.getAnswer() != null ? feedback.getAnswer().getId() : null)
                .status((feedback.getReviewStatus() != null ? feedback.getReviewStatus() : WritingReviewStatus.DRAFT).name())
                .draftScore(feedback.getDraftScore())
                .draftFeedback(feedback.getAiFeedback())
                .publishedScore(feedback.getPublishedScore())
                .publishedFeedback(feedback.getTeacherFeedback())
                .customPrompt(feedback.getCustomPrompt())
                .publishedBy(feedback.getPublishedBy())
                .publishedAt(feedback.getPublishedAt())
                .build();
    }

    private static String normalizeType(String questionType) {
        return questionType == null ? "" : questionType.trim().toUpperCase();
    }

    private static boolean hasText(String value) {
        return value != null && !value.isBlank();
    }

    private static String trimToNull(String value) {
        if (value == null) {
            return null;
        }
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }

    private static Float clampScore(Float score) {
        if (score == null) {
            return null;
        }
        return Math.max(0f, Math.min(100f, score));
    }
}
