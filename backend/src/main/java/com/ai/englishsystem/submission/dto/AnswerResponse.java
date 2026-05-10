package com.ai.englishsystem.submission.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AnswerResponse {
    private Integer id;
    private Integer submissionId;
    private Integer questionId;

    /** Question stem (for result and review UIs). */
    private String questionText;

    /** Helps teachers route playback (e.g. SPEAKING). */
    private String questionType;

    private String answerText;
    private Integer selectedOptionId;
    private String selectedOptionText;

    private String speakingAudioUrl;

    private Integer speakingDurationSeconds;

    private String speakingFormat;

    private String imageUrl;

    private String writingReviewStatus;

    private Float writingDraftScore;

    private String writingDraftFeedback;

    private Float writingPublishedScore;

    private String writingPublishedFeedback;

    private LocalDateTime writingPublishedAt;

    private String speakingReviewStatus;

    private Float speakingDraftScore;

    private String speakingDraftFeedback;

    private String speakingDraftTranscript;

    private Float speakingPublishedScore;

    private String speakingPublishedFeedback;

    private String speakingPublishedTranscript;

    private LocalDateTime speakingPublishedAt;
}
