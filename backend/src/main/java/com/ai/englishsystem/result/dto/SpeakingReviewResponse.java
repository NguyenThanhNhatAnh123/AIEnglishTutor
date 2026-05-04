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
public class SpeakingReviewResponse {
    private Integer answerId;
    private String status;
    private Float draftScore;
    private String draftFeedback;
    private String draftTranscript;
    private Float publishedScore;
    private String publishedFeedback;
    private String publishedTranscript;
    private String customPrompt;
    private Integer publishedBy;
    private LocalDateTime publishedAt;
}
