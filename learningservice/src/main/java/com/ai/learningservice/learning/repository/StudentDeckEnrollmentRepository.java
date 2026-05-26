package com.ai.learningservice.learning.repository;

import com.ai.learningservice.learning.entity.EnrollmentStatus;
import com.ai.learningservice.learning.entity.StudentDeckEnrollment;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.util.Collection;
import java.util.List;
import java.util.Optional;

public interface StudentDeckEnrollmentRepository extends JpaRepository<StudentDeckEnrollment, Long> {

    Optional<StudentDeckEnrollment> findByStudentUserIdAndDeck_Id(Long studentUserId, Long deckId);

    long countByStudentUserIdAndStatus(Long studentUserId, EnrollmentStatus status);

    @Query("""
            SELECT e.deck.id AS deckId, e.status AS status
            FROM StudentDeckEnrollment e
            WHERE e.studentUserId = :studentUserId AND e.deck.id IN :deckIds
            """)
    List<EnrollmentDeckId> findEnrollmentDeckIds(
            @Param("studentUserId") Long studentUserId,
            @Param("deckIds") Collection<Long> deckIds);

    @Query("""
            UPDATE StudentDeckEnrollment e
            SET e.lastStudiedAt = :studiedAt
            WHERE e.studentUserId = :studentUserId AND e.deck.id = :deckId
            """)
    @Modifying
    void touchLastStudiedAt(
            @Param("studentUserId") Long studentUserId,
            @Param("deckId") Long deckId,
            @Param("studiedAt") Instant studiedAt);
}
