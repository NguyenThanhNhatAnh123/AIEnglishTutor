package com.ai.englishsystem.config;

import com.ai.englishsystem.auth.entity.Role;
import com.ai.englishsystem.auth.repository.RoleRepository;
import com.ai.englishsystem.user.entity.User;
import com.ai.englishsystem.user.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.cache.annotation.CacheEvict;
import org.springframework.core.env.Environment;
import org.springframework.core.env.Profiles;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
@Slf4j
public class DataInitializer implements ApplicationRunner {

    private final RoleRepository roleRepository;
    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final Environment environment;

    @Override
    @CacheEvict(value = CacheNames.ROLES, allEntries = true)
    public void run(ApplicationArguments args) {
        if (roleRepository.count() == 0) {
            roleRepository.save(Role.builder().name("ADMIN").description("Administrator").build());
            roleRepository.save(Role.builder().name("TEACHER").description("Teacher").build());
            roleRepository.save(Role.builder().name("STUDENT").description("Student").build());
            log.info("Initial roles created");
        }
        seedSmokeAdminForTestProfile();
    }

    private void seedSmokeAdminForTestProfile() {
        if (!environment.acceptsProfiles(Profiles.of("test"))) {
            return;
        }
        if (userRepository.existsByEmail("smoke-admin@example.com")) {
            return;
        }
        Role adminRole = roleRepository.findByName("ADMIN")
                .orElseThrow(() -> new IllegalStateException("ADMIN role is missing"));
        userRepository.save(User.builder()
                .username("smoke_admin")
                .email("smoke-admin@example.com")
                .password(passwordEncoder.encode("Smoke123!"))
                .fullName("Smoke Admin")
                .role(adminRole)
                .status("ACTIVE")
                .build());
        log.info("Smoke admin created for test profile");
    }
}
