package com.ai.englishsystem.submission.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AnswerResponse {
    private Integer id;
    private Integer submissionId;
    private Integer questionId;

    /** Helps teachers route playback (e.g. SPEAKING). */
    private String questionType;

    private String answerText;
    private Integer selectedOptionId;

    private String speakingAudioUrl;

    private Integer speakingDurationSeconds;

    private String speakingFormat;

    private String imageUrl;
}
