package com.ai.learningservice.learning.repository;

import com.ai.learningservice.learning.entity.Deck;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface DeckRepository extends JpaRepository<Deck, Long> {

    @Query("""
            SELECT d FROM Deck d
            WHERE d.active = true
              AND (:level IS NULL OR LOWER(d.level) = LOWER(:level))
              AND (:topic IS NULL OR LOWER(d.topic) = LOWER(:topic))
            ORDER BY d.level ASC, d.topic ASC, d.name ASC
            """)
    List<Deck> findVisibleDecks(@Param("level") String level, @Param("topic") String topic);

    Optional<Deck> findByIdAndActiveTrue(Long id);
}
