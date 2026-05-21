package com.ai.englishsystem.config;

import jakarta.servlet.FilterChain;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.List;
import java.util.concurrent.atomic.AtomicInteger;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class RateLimitFilterTest {

    @AfterEach
    void tearDown() {
        SecurityContextHolder.clearContext();
    }

    @Test
    void teacherBypassesRateLimit() throws Exception {
        RateLimitFilter filter = newFilter();
        authenticate("42", "ROLE_TEACHER");
        AtomicInteger chainCalls = new AtomicInteger();

        for (int i = 0; i < 3; i++) {
            MockHttpServletResponse response = new MockHttpServletResponse();

            filter.doFilter(aiRequest(), response, countingChain(chainCalls));

            assertThat(response.getStatus()).isNotEqualTo(429);
        }
        assertThat(chainCalls).hasValue(3);
    }

    @Test
    void nonTeacherStillReceivesRateLimit() throws Exception {
        RateLimitFilter filter = newFilter();
        authenticate("42", "ROLE_STUDENT");
        AtomicInteger chainCalls = new AtomicInteger();

        filter.doFilter(aiRequest(), new MockHttpServletResponse(), countingChain(chainCalls));
        MockHttpServletResponse limitedResponse = new MockHttpServletResponse();
        filter.doFilter(aiRequest(), limitedResponse, countingChain(chainCalls));

        assertThat(chainCalls).hasValue(1);
        assertThat(limitedResponse.getStatus()).isEqualTo(429);
    }

    private RateLimitFilter newFilter() {
        @SuppressWarnings("unchecked")
        ObjectProvider<StringRedisTemplate> redisProvider = mock(ObjectProvider.class);
        when(redisProvider.getIfAvailable()).thenReturn(null);

        RateLimitFilter filter = new RateLimitFilter(redisProvider);
        ReflectionTestUtils.setField(filter, "aiMaxRequests", 1);
        ReflectionTestUtils.setField(filter, "aiWindowSeconds", 60);
        ReflectionTestUtils.setField(filter, "generalMaxRequests", 1);
        ReflectionTestUtils.setField(filter, "generalWindowSeconds", 60);
        ReflectionTestUtils.setField(filter, "rateLimitBackend", "memory");
        ReflectionTestUtils.setField(filter, "bypassRoles", "TEACHER");
        return filter;
    }

    private void authenticate(String userId, String role) {
        var authentication = new UsernamePasswordAuthenticationToken(
                userId,
                null,
                List.of(new SimpleGrantedAuthority(role))
        );
        SecurityContextHolder.getContext().setAuthentication(authentication);
    }

    private MockHttpServletRequest aiRequest() {
        MockHttpServletRequest request = new MockHttpServletRequest("POST", "/api/ai/score-writing");
        request.setRemoteAddr("127.0.0.1");
        return request;
    }

    private FilterChain countingChain(AtomicInteger calls) {
        return (request, response) -> calls.incrementAndGet();
    }
}
