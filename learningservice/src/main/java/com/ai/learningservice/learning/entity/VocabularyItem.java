package com.ai.learningservice.learning.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;

@Entity
@Table(name = "vocabulary_items")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class VocabularyItem {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "deck_id", nullable = false)
    private Deck deck;

    @Column(nullable = false, length = 100)
    private String word;

    @Column(length = 100)
    private String phonetic;

    @Column(name = "part_of_speech", length = 20)
    private String partOfSpeech;

    @Column(name = "definition_en", nullable = false, length = 400)
    private String definitionEn;

    @Column(name = "definition_vi", nullable = false, length = 400)
    private String definitionVi;

    @Column(name = "example_sentence", length = 500)
    private String exampleSentence;

    @Column(name = "example_sentence_vi", length = 500)
    private String exampleSentenceVi;

    @Column(name = "image_url", length = 500)
    private String imageUrl;

    @Column(name = "order_in_deck", nullable = false)
    @Builder.Default
    private Integer orderInDeck = 0;

    @Column(name = "is_active", nullable = false)
    @Builder.Default
    private boolean active = true;

    @Column(name = "created_at")
    private Instant createdAt;

    @Column(name = "updated_at")
    private Instant updatedAt;

    @PrePersist
    protected void onCreate() {
        Instant now = Instant.now();
        this.createdAt = now;
        this.updatedAt = now;
    }

    @PreUpdate
    protected void onUpdate() {
        this.updatedAt = Instant.now();
    }
}
