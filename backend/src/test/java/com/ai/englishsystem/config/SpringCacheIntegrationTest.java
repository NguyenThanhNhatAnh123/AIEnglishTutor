package com.ai.englishsystem.config;

import com.ai.englishsystem.auth.service.RoleService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.cache.Cache;
import org.springframework.cache.CacheManager;
import org.springframework.cache.interceptor.SimpleKey;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.annotation.Transactional;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest
@ActiveProfiles("test")
@Transactional
class SpringCacheIntegrationTest {

    @Autowired
    private RoleService roleService;

    @Autowired
    private CacheManager cacheManager;

    @Test
    void roleListIsCachedThroughSpringCache() {
        Cache roles = cacheManager.getCache(CacheNames.ROLES);
        assertThat(roles).isNotNull();
        roles.clear();

        roleService.findAll();

        assertThat(roles.get(SimpleKey.EMPTY)).isNotNull();
    }
}
