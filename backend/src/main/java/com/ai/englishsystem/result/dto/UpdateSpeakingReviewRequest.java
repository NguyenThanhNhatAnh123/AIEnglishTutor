package com.ai.englishsystem.result.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class UpdateSpeakingReviewRequest {
    private Float score;
    private String feedback;
    private String transcript;
}
