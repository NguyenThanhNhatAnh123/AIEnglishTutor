package com.ai.learningservice.learning.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.Instant;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ReviewResponse {
    private Long reviewId;
    private Long stateId;
    private Long itemId;
    private Long deckId;
    private String rating;
    private Integer prevIntervalDays;
    private Integer nextIntervalDays;
    private BigDecimal prevEaseFactor;
    private BigDecimal nextEaseFactor;
    private String nextStatus;
    private Instant nextDueAt;
    private boolean idempotent;
}
