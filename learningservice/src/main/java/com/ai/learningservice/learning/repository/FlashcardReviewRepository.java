package com.ai.learningservice.learning.repository;

import com.ai.learningservice.learning.entity.FlashcardReview;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.util.Optional;

public interface FlashcardReviewRepository extends JpaRepository<FlashcardReview, Long> {

    Optional<FlashcardReview> findByStudentUserIdAndRequestId(Long studentUserId, String requestId);

    long countByStudentUserIdAndReviewedAtBetween(Long studentUserId, Instant start, Instant end);

    @Query("""
            SELECT COUNT(r.id)
            FROM FlashcardReview r
            JOIN r.studentItemState s
            JOIN s.item i
            WHERE r.studentUserId = :studentUserId
              AND i.deck.id = :deckId
              AND r.reviewedAt >= :start
              AND r.reviewedAt < :end
            """)
    long countDeckReviewsBetween(
            @Param("studentUserId") Long studentUserId,
            @Param("deckId") Long deckId,
            @Param("start") Instant start,
            @Param("end") Instant end);
}
