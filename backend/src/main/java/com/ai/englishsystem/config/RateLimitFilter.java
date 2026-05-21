package com.ai.englishsystem.config;

import jakarta.annotation.PostConstruct;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.time.Duration;
import java.util.Arrays;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.stream.Collectors;

/**
 * Rate limiter per authenticated user (or per IP for unauthenticated requests).
 *
 * Backends:
 * - memory (default): simple process-local counters.
 * - redis: shared counters across instances using Redis INCR + TTL.
 */
@Component
public class RateLimitFilter extends OncePerRequestFilter {

    private static final Logger log = LoggerFactory.getLogger(RateLimitFilter.class);

    @Value("${app.rate-limit.ai.max-requests:30}")
    private int aiMaxRequests;

    @Value("${app.rate-limit.ai.window-seconds:60}")
    private int aiWindowSeconds;

    @Value("${app.rate-limit.general.max-requests:200}")
    private int generalMaxRequests;

    @Value("${app.rate-limit.general.window-seconds:60}")
    private int generalWindowSeconds;

    @Value("${app.rate-limit.backend:memory}")
    private String rateLimitBackend;

    @Value("${app.rate-limit.bypass-roles:TEACHER}")
    private String bypassRoles;

    private final StringRedisTemplate redisTemplate;
    private final AtomicBoolean redisFallbackLogged = new AtomicBoolean(false);
    private final Map<String, WindowCounter> memoryCounters = new ConcurrentHashMap<>();
    private volatile long redisBackendDisabledUntilMs = 0L;

    public RateLimitFilter(ObjectProvider<StringRedisTemplate> redisTemplateProvider) {
        this.redisTemplate = redisTemplateProvider.getIfAvailable();
    }

    @PostConstruct
    void logBackendMode() {
        if (useRedisBackend()) {
            log.info("RateLimitFilter using REDIS backend for shared counters.");
            return;
        }
        if ("redis".equalsIgnoreCase(rateLimitBackend)) {
            log.warn("RateLimitFilter configured for redis, but Redis template is unavailable. Falling back to memory.");
            return;
        }
        log.warn("RateLimitFilter using IN-MEMORY counters. For shared counters use app.rate-limit.backend=redis.");
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request,
                                    HttpServletResponse response,
                                    FilterChain filterChain) throws ServletException, IOException {

        String path = request.getRequestURI();
        String method = request.getMethod();

        if ("OPTIONS".equalsIgnoreCase(method)
                || path.startsWith("/actuator/")
                || path.startsWith("/uploads/")
                || path.startsWith("/api/media/files/")) {
            filterChain.doFilter(request, response);
            return;
        }

        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (hasBypassRole(auth)) {
            filterChain.doFilter(request, response);
            return;
        }

        String clientKey = resolveClientKey(request);
        boolean aiEndpoint = path.contains("/ai/")
                || path.contains("/speaking-reviews/")
                || path.contains("/writing-reviews/");

        int maxRequests = aiEndpoint ? aiMaxRequests : generalMaxRequests;
        int windowSeconds = aiEndpoint ? aiWindowSeconds : generalWindowSeconds;

        if (isRateLimited(clientKey, maxRequests, windowSeconds)) {
            log.warn("Rate limit exceeded: client={}, path={}", maskKey(clientKey), path);
            response.setStatus(HttpStatus.TOO_MANY_REQUESTS.value());
            response.setContentType("application/json");
            response.getWriter().write(
                    "{\"error\":\"Too Many Requests\",\"message\":\"Please wait before making more requests.\",\"retryAfterSeconds\":"
                            + windowSeconds + "}"
            );
            return;
        }

        filterChain.doFilter(request, response);
    }

    private String resolveClientKey(HttpServletRequest request) {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth != null && auth.isAuthenticated() && auth.getPrincipal() instanceof String userId) {
            return "user:" + userId;
        }
        String ip = request.getHeader("X-Forwarded-For");
        if (ip == null || ip.isBlank()) {
            ip = request.getRemoteAddr();
        }
        return "ip:" + ip;
    }

    private boolean isRateLimited(String key, int maxRequests, int windowSeconds) {
        if (useRedisBackend()) {
            return isRateLimitedRedis(key, maxRequests, windowSeconds);
        }
        return isRateLimitedMemory(key, maxRequests, windowSeconds);
    }

    private boolean isRateLimitedRedis(String key, int maxRequests, int windowSeconds) {
        String redisKey = "rate_limit:" + key;
        try {
            Long count = redisTemplate.opsForValue().increment(redisKey);
            if (count == null) {
                return false;
            }
            if (count == 1L) {
                redisTemplate.expire(redisKey, Duration.ofSeconds(windowSeconds));
            }
            return count > maxRequests;
        } catch (Exception ex) {
            redisBackendDisabledUntilMs = System.currentTimeMillis() + 30_000L;
            if (redisFallbackLogged.compareAndSet(false, true)) {
                log.warn("Redis rate-limit backend failed. Falling back to in-memory counters.", ex);
            }
            return isRateLimitedMemory(key, maxRequests, windowSeconds);
        }
    }

    private boolean isRateLimitedMemory(String key, int maxRequests, int windowSeconds) {
        long now = System.currentTimeMillis();
        long windowMs = windowSeconds * 1000L;

        WindowCounter counter = memoryCounters.computeIfAbsent(key, ignored -> new WindowCounter(now));
        synchronized (counter) {
            if (now - counter.windowStart >= windowMs) {
                counter.windowStart = now;
                counter.count.set(0);
            }
            int current = counter.count.incrementAndGet();
            if (current % 1000 == 0) {
                cleanupStaleEntries(now, windowMs);
            }
            return current > maxRequests;
        }
    }

    private boolean hasBypassRole(Authentication auth) {
        if (auth == null || auth.getAuthorities() == null || bypassRoles == null || bypassRoles.isBlank()) {
            return false;
        }
        Set<String> normalizedBypassRoles = Arrays.stream(bypassRoles.split(","))
                .map(String::trim)
                .filter(role -> !role.isBlank())
                .map(role -> role.startsWith("ROLE_") ? role : "ROLE_" + role)
                .map(String::toUpperCase)
                .collect(Collectors.toSet());
        if (normalizedBypassRoles.isEmpty()) {
            return false;
        }
        return auth.getAuthorities().stream()
                .anyMatch(authority -> normalizedBypassRoles.contains(authority.getAuthority().toUpperCase()));
    }

    private void cleanupStaleEntries(long now, long windowMs) {
        memoryCounters.entrySet().removeIf(entry -> {
            synchronized (entry.getValue()) {
                return now - entry.getValue().windowStart > windowMs * 2;
            }
        });
    }

    private boolean useRedisBackend() {
        if (!"redis".equalsIgnoreCase(rateLimitBackend) || redisTemplate == null) {
            return false;
        }
        return System.currentTimeMillis() >= redisBackendDisabledUntilMs;
    }

    private String maskKey(String key) {
        if (key == null || key.length() <= 8) {
            return "***";
        }
        return key.substring(0, 8) + "***";
    }

    private static class WindowCounter {
        volatile long windowStart;
        final AtomicInteger count;

        WindowCounter(long start) {
            this.windowStart = start;
            this.count = new AtomicInteger(0);
        }
    }
}
