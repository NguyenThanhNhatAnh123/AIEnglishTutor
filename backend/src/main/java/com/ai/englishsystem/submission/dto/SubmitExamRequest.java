package com.ai.englishsystem.submission.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Optional body when submitting an exam. Server keeps authoritative elapsed time;
 * client value is validated and stored for audit.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class SubmitExamRequest {
    private Integer clientTimeSpentSeconds;

    private Integer tabSwitchCount;

    private Integer focusLossCount;

    private Integer copyPasteCount;

    private Integer suspiciousEventCount;

    private String deviceType;

    private String deviceLabel;
}
