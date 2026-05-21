package com.ai.englishsystem.config;

import com.ai.englishsystem.auth.entity.Role;
import com.ai.englishsystem.auth.repository.RoleRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.cache.annotation.CacheEvict;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
@Slf4j
public class DataInitializer implements ApplicationRunner {

    private final RoleRepository roleRepository;

    @Override
    @CacheEvict(value = CacheNames.ROLES, allEntries = true)
    public void run(ApplicationArguments args) {
        if (roleRepository.count() == 0) {
            roleRepository.save(Role.builder().name("ADMIN").description("Administrator").build());
            roleRepository.save(Role.builder().name("TEACHER").description("Teacher").build());
            roleRepository.save(Role.builder().name("STUDENT").description("Student").build());
            log.info("Initial roles created");
        }
    }
}
