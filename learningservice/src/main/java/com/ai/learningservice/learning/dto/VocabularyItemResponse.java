package com.ai.learningservice.learning.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class VocabularyItemResponse {
    private Long id;
    private Long deckId;
    private String word;
    private String phonetic;
    private String partOfSpeech;
    private String definitionEn;
    private String definitionVi;
    private String exampleSentence;
    private String exampleSentenceVi;
    private String imageUrl;
    private Integer orderInDeck;
    private String studyStatus;
}
