package com.ai.learningservice.learning.repository;

import com.ai.learningservice.learning.entity.VocabularyItem;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Collection;
import java.util.List;

public interface VocabularyItemRepository extends JpaRepository<VocabularyItem, Long> {

    List<VocabularyItem> findByDeck_IdAndActiveTrueOrderByOrderInDeckAscIdAsc(Long deckId);

    long countByDeck_IdAndActiveTrue(Long deckId);

    @Query("""
            SELECT v.deck.id AS deckId, COUNT(v.id) AS itemCount
            FROM VocabularyItem v
            WHERE v.active = true AND v.deck.id IN :deckIds
            GROUP BY v.deck.id
            """)
    List<DeckItemCount> countActiveItemsByDeckIds(@Param("deckIds") Collection<Long> deckIds);
}
