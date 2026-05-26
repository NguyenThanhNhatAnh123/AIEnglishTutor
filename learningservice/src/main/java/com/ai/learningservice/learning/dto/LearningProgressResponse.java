package com.ai.learningservice.learning.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class LearningProgressResponse {
    private Long enrolledDecks;
    private Long dueCount;
    private Long newCount;
    private Long learningCount;
    private Long reviewCount;
    private Long reviewedToday;
}
