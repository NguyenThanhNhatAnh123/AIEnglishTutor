package com.ai.learningservice.learning.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class EnrollDeckResponse {
    private Long enrollmentId;
    private Long deckId;
    private String status;
    private Long createdStateCount;
    private Long totalStateCount;
    private boolean alreadyEnrolled;
    private Instant startedAt;
}
