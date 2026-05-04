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
public class SpeakingScoreRequest {
    @NotNull
    private Integer answerId;

    private String audioUrl;

    /** Optional teacher instruction to customize AI review criteria. */
    private String customPrompt;

    /** Optional transcript text from speech-to-text; when present, scoring will prioritize this text. */
    private String transcriptText;
}
