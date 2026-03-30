package com.ai.englishsystem.ai.entity;

import com.ai.englishsystem.submission.entity.Answer;
import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;

@Entity
@Table(name = "ai_results")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class AiResult {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer id;

    @OneToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "answer_id", nullable = false, unique = true)
    private Answer answer;

    @Column(name = "grammar_score")
    private Float grammarScore;

    @Column(name = "vocabulary_score")
    private Float vocabularyScore;

    @Column(name = "fluency_score")
    private Float fluencyScore;

    @Column(name = "pronunciation_score")
    private Float pronunciationScore;

    @Column(name = "coherence_score")
    private Float coherenceScore;

    @Column(name = "overall_score")
    private Float overallScore;

    @Column(columnDefinition = "TEXT")
    private String feedback;

    @Column(name = "created_at")
    private LocalDateTime createdAt;

    @PrePersist
    protected void onCreate() {
        this.createdAt = LocalDateTime.now();
    }
}
