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
public class SubmitSubmissionRequest {
    @NotNull
    private Integer submissionId;

    /** Optional; validated against server session clock */
    private Integer clientTimeSpentSeconds;

    private Integer tabSwitchCount;

    private Integer focusLossCount;

    private Integer copyPasteCount;

    private Integer suspiciousEventCount;

    private String deviceType;

    private String deviceLabel;
}
