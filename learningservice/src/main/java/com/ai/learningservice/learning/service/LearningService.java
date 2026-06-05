package com.ai.learningservice.learning.service;

import com.ai.learningservice.common.exception.BadRequestException;
import com.ai.learningservice.common.exception.NotFoundException;
import com.ai.learningservice.common.util.SecurityUtils;
import com.ai.learningservice.learning.dto.*;
import com.ai.learningservice.learning.entity.*;
import com.ai.learningservice.learning.repository.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.*;
import java.util.function.Function;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class LearningService {

    private static final int DEFAULT_DUE_LIMIT = 20;
    private static final int MAX_DUE_LIMIT = 100;

    private final DeckRepository deckRepository;
    private final VocabularyItemRepository vocabularyItemRepository;
    private final StudentDeckEnrollmentRepository enrollmentRepository;
    private final StudentItemStateRepository stateRepository;
    private final FlashcardReviewRepository reviewRepository;
    private final CachedVocabularyService cachedVocabularyService;
    private final SpacedRepetitionPolicy spacedRepetitionPolicy = new SpacedRepetitionPolicy();

    @Transactional(readOnly = true)
    public List<DeckResponse> getVisibleDecks(String level, String topic) {
        Long studentUserId = SecurityUtils.getCurrentUserId();
        List<Deck> decks = deckRepository.findVisibleDecks(blankToNull(level), blankToNull(topic));
        if (decks.isEmpty()) {
            return List.of();
        }

        List<Long> deckIds = decks.stream().map(Deck::getId).toList();
        Map<Long, Long> itemCounts = vocabularyItemRepository.countActiveItemsByDeckIds(deckIds).stream()
                .collect(Collectors.toMap(DeckItemCount::getDeckId, DeckItemCount::getItemCount));
        Map<Long, String> enrollments = enrollmentRepository.findEnrollmentDeckIds(studentUserId, deckIds).stream()
                .collect(Collectors.toMap(EnrollmentDeckId::getDeckId, e -> e.getStatus().name()));
        Instant now = Instant.now();
        Map<Long, Long> dueCounts = stateRepository.countDueByDeckIds(studentUserId, deckIds, now, StudyStatus.SUSPENDED).stream()
                .collect(Collectors.toMap(row -> (Long) row[0], row -> ((Number) row[1]).longValue()));

        return decks.stream()
                .map(deck -> DeckResponse.builder()
                        .id(deck.getId())
                        .name(deck.getName())
                        .description(deck.getDescription())
                        .level(deck.getLevel())
                        .topic(deck.getTopic())
                        .itemCount(itemCounts.getOrDefault(deck.getId(), 0L))
                        .enrolled(enrollments.containsKey(deck.getId()))
                        .enrollmentStatus(enrollments.get(deck.getId()))
                        .dueCount(enrollments.containsKey(deck.getId())
                                ? dueCounts.getOrDefault(deck.getId(), 0L)
                                : 0L)
                        .createdAt(deck.getCreatedAt())
                        .build())
                .toList();
    }

    @Transactional(readOnly = true)
    public DeckResponse getDeck(Long deckId) {
        Long studentUserId = SecurityUtils.getCurrentUserId();
        Deck deck = findVisibleDeck(deckId);
        Optional<StudentDeckEnrollment> enrollment = enrollmentRepository.findByStudentUserIdAndDeck_Id(studentUserId, deckId);
        Instant now = Instant.now();

        return DeckResponse.builder()
                .id(deck.getId())
                .name(deck.getName())
                .description(deck.getDescription())
                .level(deck.getLevel())
                .topic(deck.getTopic())
                .itemCount(vocabularyItemRepository.countByDeck_IdAndActiveTrue(deckId))
                .enrolled(enrollment.isPresent())
                .enrollmentStatus(enrollment.map(e -> e.getStatus().name()).orElse(null))
                .dueCount(enrollment.isPresent()
                        ? stateRepository.countByStudentUserIdAndItem_Deck_IdAndDueAtLessThanEqualAndStatusNot(
                        studentUserId, deckId, now, StudyStatus.SUSPENDED)
                        : 0L)
                .createdAt(deck.getCreatedAt())
                .build();
    }

    @Transactional(readOnly = true)
    public List<VocabularyItemResponse> getDeckItems(Long deckId) {
        Long studentUserId = SecurityUtils.getCurrentUserId();
        Deck deck = findVisibleDeck(deckId);
        List<VocabularyItemResponse> items = cachedVocabularyService.getActiveItems(deck.getId());
        if (items.isEmpty()) {
            return List.of();
        }

        Map<Long, StudentItemState> states = stateRepository
                .findByStudentUserIdAndItem_IdIn(studentUserId, items.stream().map(VocabularyItemResponse::getId).toList())
                .stream()
                .collect(Collectors.toMap(s -> s.getItem().getId(), Function.identity()));

        return items.stream()
                .map(item -> withStudyStatus(item, states.get(item.getId())))
                .toList();
    }

    @Transactional
    public EnrollDeckResponse enrollDeck(Long deckId) {
        Long studentUserId = SecurityUtils.getCurrentUserId();
        Deck deck = findVisibleDeck(deckId);
        List<VocabularyItem> activeItems = vocabularyItemRepository.findByDeck_IdAndActiveTrueOrderByOrderInDeckAscIdAsc(deckId);
        if (activeItems.isEmpty()) {
            throw new BadRequestException("Deck has no active vocabulary items");
        }

        Optional<StudentDeckEnrollment> existingEnrollment = enrollmentRepository.findByStudentUserIdAndDeck_Id(studentUserId, deckId);
        StudentDeckEnrollment enrollment = existingEnrollment.orElseGet(() -> StudentDeckEnrollment.builder()
                .studentUserId(studentUserId)
                .deck(deck)
                .status(EnrollmentStatus.active)
                .build());
        enrollment.setStatus(EnrollmentStatus.active);
        enrollment = enrollmentRepository.save(enrollment);

        long created = ensureStatesForActiveItems(studentUserId, activeItems);
        long total = stateRepository.countByStudentUserIdAndItem_Deck_Id(studentUserId, deckId);

        log.info("Student user {} enrolled deck {} with {} new item states", studentUserId, deckId, created);
        return EnrollDeckResponse.builder()
                .enrollmentId(enrollment.getId())
                .deckId(deckId)
                .status(enrollment.getStatus().name())
                .createdStateCount(created)
                .totalStateCount(total)
                .alreadyEnrolled(existingEnrollment.isPresent())
                .startedAt(enrollment.getStartedAt())
                .build();
    }

    @Transactional(readOnly = true)
    public List<DueReviewResponse> getDueReviews(Long deckId, Integer limit) {
        Long studentUserId = SecurityUtils.getCurrentUserId();
        Integer normalizedLimit = normalizeLimit(limit);
        if (deckId != null) {
            findVisibleDeck(deckId);
            requireEnrollment(studentUserId, deckId);
        }

        List<StudentItemState> dueStates = stateRepository.findDueStates(
                studentUserId,
                deckId,
                Instant.now(),
                StudyStatus.SUSPENDED,
                PageRequest.of(0, normalizedLimit)
        );
        return dueStates.stream().map(this::toDueReviewResponse).toList();
    }

    @Transactional
    public ReviewResponse submitReview(SubmitReviewRequest request) {
        Long studentUserId = SecurityUtils.getCurrentUserId();
        ReviewRating rating = parseRating(request.getRating());
        String requestId = request.getRequestId().trim();

        Optional<FlashcardReview> existing = reviewRepository.findByStudentUserIdAndRequestId(studentUserId, requestId);
        if (existing.isPresent()) {
            return toReviewResponse(existing.get(), existing.get().getStudentItemState(), true);
        }

        StudentItemState state = stateRepository.lockByStudentUserIdAndItemId(studentUserId, request.getItemId())
                .orElseThrow(() -> new BadRequestException("Enroll the deck before reviewing this item"));
        VocabularyItem item = state.getItem();
        if (!item.isActive() || !item.getDeck().isActive()) {
            throw new BadRequestException("This vocabulary item is not available for review");
        }
        requireEnrollment(studentUserId, item.getDeck().getId());

        Integer prevInterval = state.getIntervalDays();
        var prevEase = state.getEaseFactor();
        var outcome = spacedRepetitionPolicy.next(
                rating,
                state.getIntervalDays(),
                state.getEaseFactor(),
                state.getStreak(),
                state.getLapseCount()
        );
        Instant now = Instant.now();
        Instant nextDueAt = now.plusSeconds(outcome.intervalDays() * 86_400L);

        state.setIntervalDays(outcome.intervalDays());
        state.setEaseFactor(outcome.easeFactor());
        state.setStreak(outcome.streak());
        state.setLapseCount(outcome.lapseCount());
        state.setStatus(outcome.status());
        state.setLastReviewedAt(now);
        state.setDueAt(nextDueAt);
        state = stateRepository.save(state);

        FlashcardReview review = FlashcardReview.builder()
                .studentItemState(state)
                .studentUserId(studentUserId)
                .itemId(item.getId())
                .requestId(requestId)
                .rating(rating)
                .prevIntervalDays(prevInterval)
                .nextIntervalDays(outcome.intervalDays())
                .prevEaseFactor(prevEase)
                .nextEaseFactor(outcome.easeFactor())
                .reviewedAt(now)
                .build();
        review = reviewRepository.save(review);
        enrollmentRepository.touchLastStudiedAt(studentUserId, item.getDeck().getId(), now);

        return toReviewResponse(review, state, false);
    }

    @Transactional(readOnly = true)
    public LearningProgressResponse getProgress() {
        Long studentUserId = SecurityUtils.getCurrentUserId();
        Instant now = Instant.now();
        Instant startOfToday = startOfTodayUtc();
        Instant startOfTomorrow = startOfToday.plusSeconds(86_400L);

        return LearningProgressResponse.builder()
                .enrolledDecks(enrollmentRepository.countByStudentUserIdAndStatus(studentUserId, EnrollmentStatus.active))
                .dueCount(stateRepository.countByStudentUserIdAndDueAtLessThanEqualAndStatusNot(studentUserId, now, StudyStatus.SUSPENDED))
                .newCount(stateRepository.countByStudentUserIdAndStatus(studentUserId, StudyStatus.NEW))
                .learningCount(stateRepository.countByStudentUserIdAndStatus(studentUserId, StudyStatus.LEARNING))
                .reviewCount(stateRepository.countByStudentUserIdAndStatus(studentUserId, StudyStatus.REVIEW))
                .reviewedToday(reviewRepository.countByStudentUserIdAndReviewedAtBetween(studentUserId, startOfToday, startOfTomorrow))
                .build();
    }

    @Transactional(readOnly = true)
    public DeckProgressResponse getDeckProgress(Long deckId) {
        Long studentUserId = SecurityUtils.getCurrentUserId();
        Deck deck = findVisibleDeck(deckId);
        Optional<StudentDeckEnrollment> enrollment = enrollmentRepository.findByStudentUserIdAndDeck_Id(studentUserId, deckId);
        Instant now = Instant.now();
        Instant startOfToday = startOfTodayUtc();
        Instant startOfTomorrow = startOfToday.plusSeconds(86_400L);

        return DeckProgressResponse.builder()
                .deckId(deck.getId())
                .deckName(deck.getName())
                .enrolled(enrollment.isPresent())
                .enrollmentStatus(enrollment.map(e -> e.getStatus().name()).orElse(null))
                .totalItems(vocabularyItemRepository.countByDeck_IdAndActiveTrue(deckId))
                .trackedItems(stateRepository.countByStudentUserIdAndItem_Deck_Id(studentUserId, deckId))
                .dueCount(stateRepository.countByStudentUserIdAndItem_Deck_IdAndDueAtLessThanEqualAndStatusNot(
                        studentUserId, deckId, now, StudyStatus.SUSPENDED))
                .newCount(stateRepository.countByStudentUserIdAndItem_Deck_IdAndStatus(studentUserId, deckId, StudyStatus.NEW))
                .learningCount(stateRepository.countByStudentUserIdAndItem_Deck_IdAndStatus(studentUserId, deckId, StudyStatus.LEARNING))
                .reviewCount(stateRepository.countByStudentUserIdAndItem_Deck_IdAndStatus(studentUserId, deckId, StudyStatus.REVIEW))
                .reviewedToday(reviewRepository.countDeckReviewsBetween(studentUserId, deckId, startOfToday, startOfTomorrow))
                .build();
    }

    private long ensureStatesForActiveItems(Long studentUserId, List<VocabularyItem> activeItems) {
        List<Long> itemIds = activeItems.stream().map(VocabularyItem::getId).toList();
        Set<Long> existingItemIds = stateRepository.findByStudentUserIdAndItem_IdIn(studentUserId, itemIds).stream()
                .map(s -> s.getItem().getId())
                .collect(Collectors.toSet());

        Instant now = Instant.now();
        List<StudentItemState> newStates = activeItems.stream()
                .filter(item -> !existingItemIds.contains(item.getId()))
                .map(item -> StudentItemState.builder()
                        .studentUserId(studentUserId)
                        .item(item)
                        .dueAt(now)
                        .build())
                .toList();
        stateRepository.saveAll(newStates);
        return newStates.size();
    }

    private Deck findVisibleDeck(Long deckId) {
        return deckRepository.findByIdAndActiveTrue(deckId)
                .orElseThrow(() -> new NotFoundException("Deck", deckId));
    }

    private StudentDeckEnrollment requireEnrollment(Long studentUserId, Long deckId) {
        return enrollmentRepository.findByStudentUserIdAndDeck_Id(studentUserId, deckId)
                .filter(e -> e.getStatus() == EnrollmentStatus.active)
                .orElseThrow(() -> new BadRequestException("Enroll the deck before reviewing"));
    }

    private VocabularyItemResponse withStudyStatus(VocabularyItemResponse item, StudentItemState state) {
        return VocabularyItemResponse.builder()
                .id(item.getId())
                .deckId(item.getDeckId())
                .word(item.getWord())
                .phonetic(item.getPhonetic())
                .partOfSpeech(item.getPartOfSpeech())
                .definitionEn(item.getDefinitionEn())
                .definitionVi(item.getDefinitionVi())
                .exampleSentence(item.getExampleSentence())
                .exampleSentenceVi(item.getExampleSentenceVi())
                .imageUrl(item.getImageUrl())
                .orderInDeck(item.getOrderInDeck())
                .studyStatus(state != null ? state.getStatus().value() : null)
                .build();
    }

    private DueReviewResponse toDueReviewResponse(StudentItemState state) {
        VocabularyItem item = state.getItem();
        Deck deck = item.getDeck();
        return DueReviewResponse.builder()
                .stateId(state.getId())
                .itemId(item.getId())
                .deckId(deck.getId())
                .deckName(deck.getName())
                .word(item.getWord())
                .phonetic(item.getPhonetic())
                .partOfSpeech(item.getPartOfSpeech())
                .definitionEn(item.getDefinitionEn())
                .definitionVi(item.getDefinitionVi())
                .exampleSentence(item.getExampleSentence())
                .exampleSentenceVi(item.getExampleSentenceVi())
                .imageUrl(item.getImageUrl())
                .status(state.getStatus().value())
                .easeFactor(state.getEaseFactor())
                .intervalDays(state.getIntervalDays())
                .streak(state.getStreak())
                .lapseCount(state.getLapseCount())
                .dueAt(state.getDueAt())
                .build();
    }

    private ReviewResponse toReviewResponse(FlashcardReview review, StudentItemState state, boolean idempotent) {
        return ReviewResponse.builder()
                .reviewId(review.getId())
                .stateId(state.getId())
                .itemId(review.getItemId())
                .deckId(state.getItem().getDeck().getId())
                .rating(review.getRating().name())
                .prevIntervalDays(review.getPrevIntervalDays())
                .nextIntervalDays(review.getNextIntervalDays())
                .prevEaseFactor(review.getPrevEaseFactor())
                .nextEaseFactor(review.getNextEaseFactor())
                .nextStatus(state.getStatus().value())
                .nextDueAt(state.getDueAt())
                .idempotent(idempotent)
                .build();
    }

    private ReviewRating parseRating(String rating) {
        try {
            return ReviewRating.valueOf(rating.trim().toLowerCase(Locale.ROOT));
        } catch (Exception e) {
            throw new BadRequestException("rating must be one of: again, hard, good, easy");
        }
    }

    private Integer normalizeLimit(Integer limit) {
        if (limit == null) {
            return DEFAULT_DUE_LIMIT;
        }
        if (limit < 1) {
            throw new BadRequestException("limit must be greater than 0");
        }
        return Math.min(limit, MAX_DUE_LIMIT);
    }

    private Instant startOfTodayUtc() {
        return LocalDate.now(ZoneOffset.UTC).atStartOfDay().toInstant(ZoneOffset.UTC);
    }

    private String blankToNull(String value) {
        return StringUtils.hasText(value) ? value.trim() : null;
    }
}
