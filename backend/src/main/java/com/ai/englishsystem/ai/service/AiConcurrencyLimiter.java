package com.ai.englishsystem.ai.service;

import com.ai.englishsystem.common.exception.BadRequestException;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.util.concurrent.Semaphore;
import java.util.function.Supplier;

@Component
public class AiConcurrencyLimiter {

    private final Semaphore semaphore;

    public AiConcurrencyLimiter(@Value("${app.ai.max-concurrent-requests:8}") int maxConcurrentRequests) {
        this.semaphore = new Semaphore(Math.max(1, maxConcurrentRequests));
    }

    public <T> T run(Supplier<T> work) {
        if (!semaphore.tryAcquire()) {
            throw new BadRequestException("AI service is busy. Please retry in a moment.");
        }
        try {
            return work.get();
        } finally {
            semaphore.release();
        }
    }
}
