package com.ai.learningservice.learning.entity;

import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;
import java.time.Instant;

@Entity
@Table(
        name = "flashcard_reviews",
        uniqueConstraints = @UniqueConstraint(name = "uk_review_request", columnNames = {"student_user_id", "request_id"})
)
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class FlashcardReview {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "student_item_state_id", nullable = false)
    private StudentItemState studentItemState;

    @Column(name = "student_user_id", nullable = false)
    private Long studentUserId;

    @Column(name = "item_id", nullable = false)
    private Long itemId;

    @Column(name = "request_id", nullable = false, length = 80)
    private String requestId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private ReviewRating rating;

    @Column(name = "prev_interval_days", nullable = false)
    private Integer prevIntervalDays;

    @Column(name = "next_interval_days", nullable = false)
    private Integer nextIntervalDays;

    @Column(name = "prev_ease_factor", nullable = false, precision = 4, scale = 2)
    private BigDecimal prevEaseFactor;

    @Column(name = "next_ease_factor", nullable = false, precision = 4, scale = 2)
    private BigDecimal nextEaseFactor;

    @Column(name = "reviewed_at")
    private Instant reviewedAt;

    @PrePersist
    protected void onCreate() {
        this.reviewedAt = this.reviewedAt == null ? Instant.now() : this.reviewedAt;
    }
}
