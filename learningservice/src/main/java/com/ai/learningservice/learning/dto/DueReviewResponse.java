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
public class DueReviewResponse {
    private Long stateId;
    private Long itemId;
    private Long deckId;
    private String deckName;
    private String word;
    private String phonetic;
    private String partOfSpeech;
    private String definitionEn;
    private String definitionVi;
    private String exampleSentence;
    private String exampleSentenceVi;
    private String imageUrl;
    private String status;
    private BigDecimal easeFactor;
    private Integer intervalDays;
    private Integer streak;
    private Integer lapseCount;
    private Instant dueAt;
}
