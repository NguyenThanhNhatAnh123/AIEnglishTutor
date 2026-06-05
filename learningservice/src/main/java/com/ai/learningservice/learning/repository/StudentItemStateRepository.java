package com.ai.learningservice.learning.repository;

import com.ai.learningservice.learning.entity.StudentItemState;
import com.ai.learningservice.learning.entity.StudyStatus;
import jakarta.persistence.LockModeType;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.util.Collection;
import java.util.List;
import java.util.Optional;

public interface StudentItemStateRepository extends JpaRepository<StudentItemState, Long> {

    Optional<StudentItemState> findByStudentUserIdAndItem_Id(Long studentUserId, Long itemId);

    List<StudentItemState> findByStudentUserIdAndItem_IdIn(Long studentUserId, Collection<Long> itemIds);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("""
            SELECT s FROM StudentItemState s
            JOIN FETCH s.item i
            JOIN FETCH i.deck d
            WHERE s.studentUserId = :studentUserId AND i.id = :itemId
            """)
    Optional<StudentItemState> lockByStudentUserIdAndItemId(
            @Param("studentUserId") Long studentUserId,
            @Param("itemId") Long itemId);

    @Query("""
            SELECT s FROM StudentItemState s
            JOIN FETCH s.item i
            JOIN FETCH i.deck d
            WHERE s.studentUserId = :studentUserId
              AND s.dueAt <= :now
              AND s.status <> :suspendedStatus
              AND i.active = true
              AND d.active = true
              AND (:deckId IS NULL OR d.id = :deckId)
            ORDER BY s.dueAt ASC, i.orderInDeck ASC, i.id ASC
            """)
    List<StudentItemState> findDueStates(
            @Param("studentUserId") Long studentUserId,
            @Param("deckId") Long deckId,
            @Param("now") Instant now,
            @Param("suspendedStatus") StudyStatus suspendedStatus,
            Pageable pageable);

    long countByStudentUserIdAndStatus(Long studentUserId, StudyStatus status);

    long countByStudentUserIdAndDueAtLessThanEqualAndStatusNot(Long studentUserId, Instant now, StudyStatus status);

    long countByStudentUserIdAndItem_Deck_IdAndStatus(Long studentUserId, Long deckId, StudyStatus status);

    long countByStudentUserIdAndItem_Deck_IdAndDueAtLessThanEqualAndStatusNot(
            Long studentUserId,
            Long deckId,
            Instant now,
            StudyStatus status);

    @Query("""
            SELECT i.deck.id, COUNT(s.id)
            FROM StudentItemState s
            JOIN s.item i
            WHERE s.studentUserId = :studentUserId
              AND i.deck.id IN :deckIds
              AND s.dueAt <= :now
              AND s.status <> :status
            GROUP BY i.deck.id
            """)
    List<Object[]> countDueByDeckIds(
            @Param("studentUserId") Long studentUserId,
            @Param("deckIds") Collection<Long> deckIds,
            @Param("now") Instant now,
            @Param("status") StudyStatus status);

    long countByStudentUserIdAndItem_Deck_Id(Long studentUserId, Long deckId);
}
