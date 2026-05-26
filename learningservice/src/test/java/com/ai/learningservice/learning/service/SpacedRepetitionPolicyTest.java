package com.ai.learningservice.learning.service;

import com.ai.learningservice.learning.entity.ReviewRating;
import com.ai.learningservice.learning.entity.StudyStatus;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;

import static org.assertj.core.api.Assertions.assertThat;

class SpacedRepetitionPolicyTest {

    private final SpacedRepetitionPolicy policy = new SpacedRepetitionPolicy();

    @Test
    void againResetsIntervalAndLowersEaseWithFloor() {
        var outcome = policy.next(ReviewRating.again, 10, BigDecimal.valueOf(1.35), 3, 1);

        assertThat(outcome.intervalDays()).isEqualTo(1);
        assertThat(outcome.easeFactor()).isEqualByComparingTo("1.30");
        assertThat(outcome.streak()).isZero();
        assertThat(outcome.lapseCount()).isEqualTo(2);
        assertThat(outcome.status()).isEqualTo(StudyStatus.LEARNING);
    }

    @Test
    void goodMovesItemToReviewWithEaseBasedInterval() {
        var outcome = policy.next(ReviewRating.good, 2, BigDecimal.valueOf(2.50), 1, 0);

        assertThat(outcome.intervalDays()).isEqualTo(5);
        assertThat(outcome.easeFactor()).isEqualByComparingTo("2.50");
        assertThat(outcome.streak()).isEqualTo(2);
        assertThat(outcome.status()).isEqualTo(StudyStatus.REVIEW);
    }
}
