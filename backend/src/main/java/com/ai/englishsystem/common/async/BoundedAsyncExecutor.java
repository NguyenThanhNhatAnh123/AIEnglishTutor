package com.ai.englishsystem.common.async;

import com.ai.englishsystem.common.exception.ServiceUnavailableException;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.security.core.context.SecurityContext;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;

import java.util.concurrent.CompletableFuture;
import java.util.concurrent.Executor;
import java.util.concurrent.RejectedExecutionException;
import java.util.function.Supplier;

@Component
public class BoundedAsyncExecutor {

    private final Executor executor;

    public BoundedAsyncExecutor(@Qualifier("aiScoringExecutor") Executor executor) {
        this.executor = executor;
    }

    public <T> CompletableFuture<T> submit(Supplier<T> supplier) {
        SecurityContext capturedContext = SecurityContextHolder.getContext();
        try {
            return CompletableFuture.supplyAsync(() -> {
                SecurityContext previousContext = SecurityContextHolder.getContext();
                try {
                    SecurityContextHolder.setContext(capturedContext);
                    return supplier.get();
                } finally {
                    SecurityContextHolder.setContext(previousContext);
                }
            }, executor);
        } catch (RejectedExecutionException ex) {
            return CompletableFuture.failedFuture(
                    new ServiceUnavailableException("Server is busy processing long-running tasks. Please retry shortly.")
            );
        }
    }
}
