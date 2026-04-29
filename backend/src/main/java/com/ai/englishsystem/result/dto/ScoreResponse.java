package com.ai.englishsystem.result.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ScoreResponse {
    private Integer id;
    private Integer submissionId;
    private Float mcScore;
    private Float writingScore;
    private Float speakingScore;
    private Float totalScore;
    private String feedback;
    private Integer tabSwitchCount;
    private Integer focusLossCount;
    private Integer copyPasteCount;
    private Integer suspiciousEventCount;
    private String deviceType;
    private String deviceLabel;
    private Integer gradedBy;
    private LocalDateTime gradedAt;
}
