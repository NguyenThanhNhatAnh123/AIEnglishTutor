package com.ai.learningservice.learning.service;

import com.ai.learningservice.learning.entity.ReviewRating;
import com.ai.learningservice.learning.entity.StudyStatus;

import java.math.BigDecimal;
import java.math.RoundingMode;

public class SpacedRepetitionPolicy {

    private static final double MIN_EASE = 1.30d;

    public ReviewOutcome next(ReviewRating rating, int currentIntervalDays, BigDecimal currentEaseFactor, int currentStreak, int currentLapseCount) {
        double ease = currentEaseFactor.doubleValue();
        int interval = Math.max(1, currentIntervalDays);
        int nextInterval;
        double nextEase = ease;
        int nextStreak = currentStreak;
        int nextLapseCount = currentLapseCount;
        StudyStatus nextStatus;

        switch (rating) {
            case again -> {
                nextInterval = 1;
                nextEase = Math.max(MIN_EASE, ease - 0.20d);
                nextStreak = 0;
                nextLapseCount = currentLapseCount + 1;
                nextStatus = StudyStatus.LEARNING;
            }
            case hard -> {
                nextInterval = Math.max(1, (int) Math.ceil(interval * 1.20d));
                nextEase = Math.max(MIN_EASE, ease - 0.15d);
                nextStreak = currentStreak + 1;
                nextStatus = StudyStatus.LEARNING;
            }
            case good -> {
                nextInterval = Math.max(1, (int) Math.ceil(interval * ease));
                nextStreak = currentStreak + 1;
                nextStatus = StudyStatus.REVIEW;
            }
            case easy -> {
                nextInterval = Math.max(1, (int) Math.ceil(interval * ease * 1.30d));
                nextEase = ease + 0.10d;
                nextStreak = currentStreak + 1;
                nextStatus = StudyStatus.REVIEW;
            }
            default -> throw new IllegalArgumentException("Unsupported rating: " + rating);
        }

        return new ReviewOutcome(
                nextInterval,
                BigDecimal.valueOf(nextEase).setScale(2, RoundingMode.HALF_UP),
                nextStreak,
                nextLapseCount,
                nextStatus
        );
    }

    public record ReviewOutcome(
            int intervalDays,
            BigDecimal easeFactor,
            int streak,
            int lapseCount,
            StudyStatus status
    ) {
    }
}
