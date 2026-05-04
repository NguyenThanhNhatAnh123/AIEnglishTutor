package com.ai.englishsystem.result.entity;

import com.ai.englishsystem.submission.entity.Answer;
import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;

@Entity
@Table(name = "feedbacks")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Feedback {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer id;

    @OneToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "answer_id", nullable = false, unique = true)
    private Answer answer;

    @Column(name = "teacher_feedback", columnDefinition = "TEXT")
    private String teacherFeedback;

    /**
     * Draft feedback content (AI-generated or teacher-edited) before publish.
     * Kept in legacy ai_feedback column for backward compatibility.
     */
    @Column(name = "ai_feedback", columnDefinition = "TEXT")
    private String aiFeedback;

    @Enumerated(EnumType.STRING)
    @Column(name = "review_status", length = 20, nullable = false)
    @Builder.Default
    private WritingReviewStatus reviewStatus = WritingReviewStatus.DRAFT;

    @Column(name = "draft_score")
    private Float draftScore;

    @Column(name = "published_score")
    private Float publishedScore;

    @Column(name = "custom_prompt", columnDefinition = "TEXT")
    private String customPrompt;

    @Column(name = "published_at")
    private LocalDateTime publishedAt;

    @Column(name = "published_by")
    private Integer publishedBy;

    @Column(name = "draft_transcript", columnDefinition = "TEXT")
    private String draftTranscript;

    @Column(name = "published_transcript", columnDefinition = "TEXT")
    private String publishedTranscript;

    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    @Column(name = "created_at")
    private LocalDateTime createdAt;

    @PrePersist
    protected void onCreate() {
        LocalDateTime now = LocalDateTime.now();
        this.createdAt = now;
        this.updatedAt = now;
    }

    @PreUpdate
    protected void onUpdate() {
        this.updatedAt = LocalDateTime.now();
    }
}
