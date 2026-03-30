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
    private Integer gradedBy;
    private LocalDateTime gradedAt;
}
