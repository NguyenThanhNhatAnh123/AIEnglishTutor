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
public class DeckResponse {
    private Long id;
    private String name;
    private String description;
    private String level;
    private String topic;
    private Long itemCount;
    private boolean enrolled;
    private String enrollmentStatus;
    private Long dueCount;
    private Instant createdAt;
}
