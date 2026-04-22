package com.ai.englishsystem.submission.dto;

import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AnswerRequest {
    @NotNull
    private Integer submissionId;

    @NotNull
    private Integer questionId;

    private String answerText;

    private Integer selectedOptionId;

    /** Public path from POST /api/speaking/upload (always mp3 after processing). */
    private String speakingAudioUrl;

    private Integer speakingDurationSeconds;

    private String speakingFormat;

    private String imageUrl;
}
