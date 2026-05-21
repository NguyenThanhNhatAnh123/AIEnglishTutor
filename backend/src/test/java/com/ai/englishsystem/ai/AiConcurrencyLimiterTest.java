package com.ai.englishsystem.ai;

import com.ai.englishsystem.ai.service.AiConcurrencyLimiter;
import com.ai.englishsystem.common.exception.ServiceUnavailableException;
import org.junit.jupiter.api.Test;

import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class AiConcurrencyLimiterTest {

    @Test
    void saturatedLimiterUsesServiceUnavailable() throws Exception {
        AiConcurrencyLimiter limiter = new AiConcurrencyLimiter(1);
        CountDownLatch entered = new CountDownLatch(1);
        CountDownLatch release = new CountDownLatch(1);

        Thread worker = new Thread(() -> limiter.run(() -> {
            entered.countDown();
            try {
                release.await(5, TimeUnit.SECONDS);
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
            }
            return "ok";
        }));
        worker.start();

        assertThat(entered.await(5, TimeUnit.SECONDS)).isTrue();
        assertThatThrownBy(() -> limiter.run(() -> "second"))
                .isInstanceOf(ServiceUnavailableException.class)
                .hasMessageContaining("AI service is busy");

        release.countDown();
        worker.join(5_000);
    }
}
