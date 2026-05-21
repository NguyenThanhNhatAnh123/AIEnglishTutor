package com.ai.englishsystem.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.cache.RedisCacheManagerBuilderCustomizer;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.cache.annotation.EnableCaching;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.data.redis.cache.RedisCacheConfiguration;

import java.time.Duration;
import java.util.Map;

@Configuration
@EnableCaching
public class CacheConfig {

    @Bean
    @ConditionalOnProperty(name = "spring.cache.type", havingValue = "redis")
    RedisCacheManagerBuilderCustomizer redisCacheCustomizer(
            @Value("${app.cache.roles-ttl-seconds:3600}") long rolesTtlSeconds,
            @Value("${app.cache.teachers-ttl-seconds:300}") long teachersTtlSeconds) {
        Map<String, RedisCacheConfiguration> cacheConfigurations = Map.of(
                CacheNames.ROLES, redisCacheConfig(rolesTtlSeconds),
                CacheNames.TEACHERS, redisCacheConfig(teachersTtlSeconds)
        );
        return builder -> builder
                .cacheDefaults(redisCacheConfig(300))
                .withInitialCacheConfigurations(cacheConfigurations)
                .enableStatistics();
    }

    private RedisCacheConfiguration redisCacheConfig(long ttlSeconds) {
        long safeTtl = Math.max(1, ttlSeconds);
        return RedisCacheConfiguration.defaultCacheConfig()
                .entryTtl(Duration.ofSeconds(safeTtl))
                .disableCachingNullValues()
                .prefixCacheNameWith("aienglishtutor::");
    }
}
