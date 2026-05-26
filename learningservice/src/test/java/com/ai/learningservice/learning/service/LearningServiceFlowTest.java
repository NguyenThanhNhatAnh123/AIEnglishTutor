package com.ai.learningservice.learning.service;

import com.ai.learningservice.learning.dto.SubmitReviewRequest;
import com.ai.learningservice.learning.entity.Deck;
import com.ai.learningservice.learning.entity.VocabularyItem;
import com.ai.learningservice.learning.repository.DeckRepository;
import com.ai.learningservice.learning.repository.VocabularyItemRepository;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest
@ActiveProfiles("test")
@Transactional
class LearningServiceFlowTest {

    @Autowired
    private LearningService learningService;

    @Autowired
    private DeckRepository deckRepository;

    @Autowired
    private VocabularyItemRepository vocabularyItemRepository;

    private Long deckId;
    private Long itemId;

    @BeforeEach
    void setUp() {
        SecurityContextHolder.getContext().setAuthentication(new UsernamePasswordAuthenticationToken(
                "101",
                null,
                List.of(new SimpleGrantedAuthority("ROLE_STUDENT"))
        ));

        Deck deck = deckRepository.save(Deck.builder()
                .name("Test Deck")
                .description("Test words")
                .level("A1")
                .topic("daily")
                .active(true)
                .build());
        deckId = deck.getId();

        VocabularyItem item = vocabularyItemRepository.save(VocabularyItem.builder()
                .deck(deck)
                .word("hello")
                .phonetic("/həˈloʊ/")
                .partOfSpeech("interjection")
                .definitionEn("A greeting")
                .definitionVi("Lời chào")
                .exampleSentence("Hello, Tom.")
                .exampleSentenceVi("Xin chào, Tom.")
                .orderInDeck(1)
                .active(true)
                .build());
        itemId = item.getId();
    }

    @AfterEach
    void tearDown() {
        SecurityContextHolder.clearContext();
    }

    @Test
    void studentCanEnrollReviewAndRetryIdempotently() {
        var enrollment = learningService.enrollDeck(deckId);
        assertThat(enrollment.getCreatedStateCount()).isEqualTo(1);
        assertThat(enrollment.isAlreadyEnrolled()).isFalse();

        var due = learningService.getDueReviews(deckId, 10);
        assertThat(due).hasSize(1);
        assertThat(due.get(0).getItemId()).isEqualTo(itemId);

        var review = learningService.submitReview(SubmitReviewRequest.builder()
                .itemId(itemId)
                .rating("good")
                .requestId("req-1")
                .build());
        assertThat(review.isIdempotent()).isFalse();
        assertThat(review.getNextStatus()).isEqualTo("review");

        var retry = learningService.submitReview(SubmitReviewRequest.builder()
                .itemId(itemId)
                .rating("good")
                .requestId("req-1")
                .build());
        assertThat(retry.isIdempotent()).isTrue();
        assertThat(retry.getReviewId()).isEqualTo(review.getReviewId());

        var progress = learningService.getProgress();
        assertThat(progress.getEnrolledDecks()).isEqualTo(1);
        assertThat(progress.getReviewCount()).isEqualTo(1);
        assertThat(progress.getReviewedToday()).isEqualTo(1);
    }
}
