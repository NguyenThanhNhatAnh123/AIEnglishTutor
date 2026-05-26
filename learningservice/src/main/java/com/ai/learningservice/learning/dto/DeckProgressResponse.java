package com.ai.learningservice.learning.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class DeckProgressResponse {
    private Long deckId;
    private String deckName;
    private boolean enrolled;
    private String enrollmentStatus;
    private Long totalItems;
    private Long trackedItems;
    private Long dueCount;
    private Long newCount;
    private Long learningCount;
    private Long reviewCount;
    private Long reviewedToday;
}
