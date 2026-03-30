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

    private String audioUrl;

    private String imageUrl;
}
