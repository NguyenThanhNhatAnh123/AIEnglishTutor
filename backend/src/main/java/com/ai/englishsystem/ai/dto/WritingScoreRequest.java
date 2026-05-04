package com.ai.englishsystem.ai.dto;

import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class WritingScoreRequest {
    @NotNull
    private Integer answerId;

    private String essayText;

    /** Optional teacher instruction to customize AI review criteria. */
    private String customPrompt;
}
