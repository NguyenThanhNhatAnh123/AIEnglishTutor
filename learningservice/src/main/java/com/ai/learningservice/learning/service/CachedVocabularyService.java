package com.ai.learningservice.learning.service;

import com.ai.learningservice.config.CacheNames;
import com.ai.learningservice.learning.dto.VocabularyItemResponse;
import com.ai.learningservice.learning.entity.VocabularyItem;
import com.ai.learningservice.learning.repository.VocabularyItemRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@RequiredArgsConstructor
public class CachedVocabularyService {

    private final VocabularyItemRepository vocabularyItemRepository;

    @Cacheable(value = CacheNames.VOCABULARY_DECK_ITEMS, key = "#deckId")
    @Transactional(readOnly = true)
    public List<VocabularyItemResponse> getActiveItems(Long deckId) {
        return vocabularyItemRepository.findByDeck_IdAndActiveTrueOrderByOrderInDeckAscIdAsc(deckId)
                .stream()
                .map(this::toStaticItemResponse)
                .toList();
    }

    private VocabularyItemResponse toStaticItemResponse(VocabularyItem item) {
        return VocabularyItemResponse.builder()
                .id(item.getId())
                .deckId(item.getDeck().getId())
                .word(item.getWord())
                .phonetic(item.getPhonetic())
                .partOfSpeech(item.getPartOfSpeech())
                .definitionEn(item.getDefinitionEn())
                .definitionVi(item.getDefinitionVi())
                .exampleSentence(item.getExampleSentence())
                .exampleSentenceVi(item.getExampleSentenceVi())
                .imageUrl(item.getImageUrl())
                .orderInDeck(item.getOrderInDeck())
                .studyStatus(null)
                .build();
    }
}
