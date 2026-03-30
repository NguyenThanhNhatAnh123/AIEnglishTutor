package com.ai.englishsystem.ai.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AiScoreResponse {
    private Integer aiResultId;
    private Float grammarScore;
    private Float vocabularyScore;
    private Float fluencyScore;
    private Float pronunciationScore;
    private Float coherenceScore;
    private Float overallScore;
    private String feedback;
}
