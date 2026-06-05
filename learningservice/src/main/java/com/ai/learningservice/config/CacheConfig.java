package com.ai.learningservice.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.cache.RedisCacheManagerBuilderCustomizer;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.cache.annotation.EnableCaching;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.data.redis.cache.RedisCacheConfiguration;
import org.springframework.data.redis.serializer.GenericJackson2JsonRedisSerializer;
import org.springframework.data.redis.serializer.RedisSerializationContext;

import java.time.Duration;
import java.util.Map;

@Configuration
@EnableCaching
public class CacheConfig {

    @Bean
    @ConditionalOnProperty(name = "spring.cache.type", havingValue = "redis")
    RedisCacheManagerBuilderCustomizer redisCacheCustomizer(
            @Value("${app.cache.learning.vocabulary-ttl-seconds:1800}") long vocabularyTtlSeconds) {
        RedisCacheConfiguration vocabularyConfig = redisCacheConfig(vocabularyTtlSeconds);
        return builder -> builder
                .cacheDefaults(redisCacheConfig(300))
                .withInitialCacheConfigurations(Map.of(
                        CacheNames.VOCABULARY_DECK_ITEMS, vocabularyConfig
                ))
                .enableStatistics();
    }

    private RedisCacheConfiguration redisCacheConfig(long ttlSeconds) {
        long safeTtl = Math.max(1, ttlSeconds);
        GenericJackson2JsonRedisSerializer serializer = new GenericJackson2JsonRedisSerializer();
        return RedisCacheConfiguration.defaultCacheConfig()
                .entryTtl(Duration.ofSeconds(safeTtl))
                .disableCachingNullValues()
                .prefixCacheNameWith("aienglishtutor::")
                .serializeValuesWith(RedisSerializationContext.SerializationPair.fromSerializer(serializer));
    }
}
