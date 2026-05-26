package com.ai.learningservice.learning.controller;

import com.ai.learningservice.common.dto.ApiResponse;
import com.ai.learningservice.learning.dto.*;
import com.ai.learningservice.learning.service.LearningService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/learning")
@RequiredArgsConstructor
@PreAuthorize("hasRole('STUDENT')")
public class LearningController {

    private final LearningService learningService;

    @GetMapping("/decks")
    public ResponseEntity<ApiResponse<List<DeckResponse>>> getDecks(
            @RequestParam(required = false) String level,
            @RequestParam(required = false) String topic) {
        return ResponseEntity.ok(ApiResponse.success(learningService.getVisibleDecks(level, topic)));
    }

    @GetMapping("/decks/{deckId}")
    public ResponseEntity<ApiResponse<DeckResponse>> getDeck(@PathVariable Long deckId) {
        return ResponseEntity.ok(ApiResponse.success(learningService.getDeck(deckId)));
    }

    @GetMapping("/decks/{deckId}/items")
    public ResponseEntity<ApiResponse<List<VocabularyItemResponse>>> getDeckItems(@PathVariable Long deckId) {
        return ResponseEntity.ok(ApiResponse.success(learningService.getDeckItems(deckId)));
    }

    @PostMapping("/decks/{deckId}/enroll")
    public ResponseEntity<ApiResponse<EnrollDeckResponse>> enrollDeck(@PathVariable Long deckId) {
        return ResponseEntity.ok(ApiResponse.success("Deck enrolled", learningService.enrollDeck(deckId)));
    }

    @GetMapping("/reviews/due")
    public ResponseEntity<ApiResponse<List<DueReviewResponse>>> getDueReviews(
            @RequestParam(required = false) Long deckId,
            @RequestParam(required = false) Integer limit) {
        return ResponseEntity.ok(ApiResponse.success(learningService.getDueReviews(deckId, limit)));
    }

    @PostMapping("/reviews")
    public ResponseEntity<ApiResponse<ReviewResponse>> submitReview(@Valid @RequestBody SubmitReviewRequest request) {
        return ResponseEntity.ok(ApiResponse.success("Review saved", learningService.submitReview(request)));
    }

    @GetMapping("/progress")
    public ResponseEntity<ApiResponse<LearningProgressResponse>> getProgress() {
        return ResponseEntity.ok(ApiResponse.success(learningService.getProgress()));
    }

    @GetMapping("/progress/decks/{deckId}")
    public ResponseEntity<ApiResponse<DeckProgressResponse>> getDeckProgress(@PathVariable Long deckId) {
        return ResponseEntity.ok(ApiResponse.success(learningService.getDeckProgress(deckId)));
    }
}
