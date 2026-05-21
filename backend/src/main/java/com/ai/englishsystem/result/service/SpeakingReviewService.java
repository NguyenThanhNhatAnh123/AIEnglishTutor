package com.ai.englishsystem.result.service;

import com.ai.englishsystem.ai.dto.AiScoreResponse;
import com.ai.englishsystem.ai.dto.SpeakingScoreRequest;
import com.ai.englishsystem.ai.service.AiConcurrencyLimiter;
import com.ai.englishsystem.ai.service.AiScoringService;
import com.ai.englishsystem.common.exception.BadRequestException;
import com.ai.englishsystem.common.exception.NotFoundException;
import com.ai.englishsystem.common.security.AccessControlService;
import com.ai.englishsystem.common.util.SecurityUtils;
import com.ai.englishsystem.result.dto.SpeakingReviewResponse;
import com.ai.englishsystem.result.dto.UpdateSpeakingReviewRequest;
import com.ai.englishsystem.result.entity.Feedback;
import com.ai.englishsystem.result.entity.WritingReviewStatus;
import com.ai.englishsystem.result.repository.FeedbackRepository;
import com.ai.englishsystem.speaking.service.SpeakingFileStorage;
import com.ai.englishsystem.submission.entity.Answer;
import com.ai.englishsystem.submission.repository.AnswerRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;

@Service
@RequiredArgsConstructor
public class SpeakingReviewService {

    private final AnswerRepository answerRepository;
    private final FeedbackRepository feedbackRepository;
    private final AiScoringService aiScoringService;
    private final SpeakingFileStorage speakingFileStorage;
    private final AiConcurrencyLimiter aiConcurrencyLimiter;
    private final AccessControlService accessControlService;
    private final ReviewScoreAggregator reviewScoreAggregator;

    public SpeakingReviewResponse generateDraft(Integer answerId, String customPrompt, String language) {
        Answer answer = loadSpeakingAnswer(answerId);
        accessControlService.assertTeacherOrAdminCanManageAnswer(
                answer,
                "Cannot manage speaking reviews for another teacher's exam"
        );

        String transcript = aiConcurrencyLimiter.run(() -> aiScoringService.transcribeSpeakingAudio(
                speakingFileStorage.resolveFromPublicUrl(answer.getSpeakingAudioUrl()),
                language
        ));
        String cleanedTranscript = hasText(transcript) ? transcript.trim() : null;

        // Only score when we actually have a transcript.
        // If STT fails, teacher can still edit transcript manually.
        AiScoreResponse ai = null;
        if (hasText(cleanedTranscript)) {
            String transcriptForScoring = cleanedTranscript;
            ai = aiConcurrencyLimiter.run(() -> aiScoringService.scoreSpeaking(SpeakingScoreRequest.builder()
                    .answerId(answerId)
                    .audioUrl(answer.getSpeakingAudioUrl())
                    .customPrompt(customPrompt)
                    .transcriptText(transcriptForScoring)
                    .build(), true));
        }

        if (!hasText(cleanedTranscript)) {
            cleanedTranscript = "Auto speech-to-text is unavailable for this audio. Please edit transcript manually.";
        }

        Feedback feedback = feedbackRepository.findByAnswer(answer)
                .orElseGet(() -> Feedback.builder().answer(answer).build());
        feedback.setAnswer(answer);
        feedback.setReviewStatus(WritingReviewStatus.DRAFT);
        feedback.setAiFeedback(ai != null ? trimToNull(ai.getFeedback()) : null);
        feedback.setDraftScore(ai != null && ai.getOverallScore() != null ? clampScore(ai.getOverallScore() * 10f) : null);
        feedback.setDraftTranscript(trimToNull(cleanedTranscript));
        feedback.setCustomPrompt(trimToNull(customPrompt));
        feedback = feedbackRepository.save(feedback);
        return toResponse(feedback);
    }

    @Transactional
    public SpeakingReviewResponse updateDraft(Integer answerId, UpdateSpeakingReviewRequest request) {
        Answer answer = loadSpeakingAnswer(answerId);
        accessControlService.assertTeacherOrAdminCanManageAnswer(
                answer,
                "Cannot manage speaking reviews for another teacher's exam"
        );

        if (request == null || (request.getScore() == null && !hasText(request.getFeedback()) && !hasText(request.getTranscript()))) {
            throw new BadRequestException("Provide score, feedback, or transcript to update draft review");
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
        if (request.getTranscript() != null) {
            feedback.setDraftTranscript(trimToNull(request.getTranscript()));
        }
        feedback = feedbackRepository.save(feedback);
        return toResponse(feedback);
    }

    @Transactional
    public SpeakingReviewResponse approveAndPublish(Integer answerId) {
        Answer answer = loadSpeakingAnswer(answerId);
        accessControlService.assertTeacherOrAdminCanManageAnswer(
                answer,
                "Cannot manage speaking reviews for another teacher's exam"
        );

        Feedback feedback = feedbackRepository.findByAnswer(answer)
                .orElseThrow(() -> new BadRequestException("No draft speaking review found"));
        String draftFeedback = trimToNull(feedback.getAiFeedback());
        Float draftScore = feedback.getDraftScore();
        if (draftFeedback == null && draftScore == null) {
            throw new BadRequestException("Draft review is empty and cannot be published");
        }

        Integer currentUserId = SecurityUtils.getCurrentUserId();
        feedback.setTeacherFeedback(draftFeedback);
        feedback.setPublishedScore(draftScore);
        feedback.setPublishedTranscript(trimToNull(feedback.getDraftTranscript()));
        feedback.setReviewStatus(WritingReviewStatus.PUBLISHED);
        feedback.setPublishedBy(currentUserId);
        feedback.setPublishedAt(LocalDateTime.now());
        feedback = feedbackRepository.save(feedback);

        reviewScoreAggregator.refreshSubjectiveScore(answer.getSubmission(), "SPEAKING", currentUserId);
        return toResponse(feedback);
    }

    @Transactional
    public SpeakingReviewResponse revertToDraft(Integer answerId) {
        Answer answer = loadSpeakingAnswer(answerId);
        accessControlService.assertTeacherOrAdminCanManageAnswer(
                answer,
                "Cannot manage speaking reviews for another teacher's exam"
        );

        Feedback feedback = feedbackRepository.findByAnswer(answer)
                .orElseThrow(() -> new BadRequestException("No speaking review found"));
        feedback.setReviewStatus(WritingReviewStatus.DRAFT);
        feedback.setTeacherFeedback(null);
        feedback.setPublishedScore(null);
        feedback.setPublishedTranscript(null);
        feedback.setPublishedBy(null);
        feedback.setPublishedAt(null);
        feedback = feedbackRepository.save(feedback);

        reviewScoreAggregator.refreshSubjectiveScore(answer.getSubmission(), "SPEAKING", SecurityUtils.getCurrentUserId());
        return toResponse(feedback);
    }

    private Answer loadSpeakingAnswer(Integer answerId) {
        Answer answer = answerRepository.findWithSubmissionGraphById(answerId)
                .orElseThrow(() -> new NotFoundException("Answer", answerId));
        String type = normalizeType(answer.getQuestion() != null ? answer.getQuestion().getQuestionType() : null);
        if (!"SPEAKING".equals(type)) {
            throw new BadRequestException("Answer is not a speaking answer");
        }
        if (!hasText(answer.getSpeakingAudioUrl())) {
            throw new BadRequestException("Speaking answer has no audio URL");
        }
        return answer;
    }

    private SpeakingReviewResponse toResponse(Feedback feedback) {
        return SpeakingReviewResponse.builder()
                .answerId(feedback.getAnswer() != null ? feedback.getAnswer().getId() : null)
                .status((feedback.getReviewStatus() != null ? feedback.getReviewStatus() : WritingReviewStatus.DRAFT).name())
                .draftScore(feedback.getDraftScore())
                .draftFeedback(feedback.getAiFeedback())
                .draftTranscript(feedback.getDraftTranscript())
                .publishedScore(feedback.getPublishedScore())
                .publishedFeedback(feedback.getTeacherFeedback())
                .publishedTranscript(feedback.getPublishedTranscript())
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
