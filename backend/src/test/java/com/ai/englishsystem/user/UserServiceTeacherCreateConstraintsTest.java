package com.ai.englishsystem.user;

import com.ai.englishsystem.auth.entity.Role;
import com.ai.englishsystem.auth.repository.RoleRepository;
import com.ai.englishsystem.common.exception.ForbiddenException;
import com.ai.englishsystem.user.dto.UserRequest;
import com.ai.englishsystem.user.entity.User;
import com.ai.englishsystem.user.repository.UserRepository;
import com.ai.englishsystem.user.service.UserService;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.security.authentication.TestingAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThatThrownBy;

@SpringBootTest
@ActiveProfiles("test")
@Transactional
class UserServiceTeacherCreateConstraintsTest {

    @Autowired
    private UserService userService;
    @Autowired
    private RoleRepository roleRepository;
    @Autowired
    private UserRepository userRepository;

    @AfterEach
    void clearSecurity() {
        SecurityContextHolder.clearContext();
    }

    @Test
    void teacherMayCreateStudentUserButNotTeacherUser() {
        Role teacherRole = roleRepository.findByName("TEACHER").orElseThrow();
        Role studentRole = roleRepository.findByName("STUDENT").orElseThrow();
        String suffix = UUID.randomUUID().toString().substring(0, 8);

        User teacherUser = userRepository.save(User.builder()
                .username("uc-t-" + suffix)
                .email("uc-t-" + suffix + "@example.com")
                .password("encoded")
                .fullName("Teacher UC")
                .role(teacherRole)
                .status("ACTIVE")
                .build());

        SecurityContextHolder.getContext().setAuthentication(new TestingAuthenticationToken(
                String.valueOf(teacherUser.getId()),
                "pw",
                List.of(new SimpleGrantedAuthority("ROLE_TEACHER"))));

        UserRequest ok = UserRequest.builder()
                .username("new-stu-" + suffix)
                .email("new-stu-" + suffix + "@example.com")
                .password("secret12")
                .fullName("New Student")
                .roleId(studentRole.getId())
                .status("ACTIVE")
                .build();
        userService.create(ok);

        UserRequest bad = UserRequest.builder()
                .username("new-tea-" + suffix)
                .email("new-tea-" + suffix + "@example.com")
                .password("secret12")
                .fullName("Bad")
                .roleId(teacherRole.getId())
                .status("ACTIVE")
                .build();

        assertThatThrownBy(() -> userService.create(bad))
                .isInstanceOf(ForbiddenException.class)
                .hasMessageContaining("STUDENT");
    }
}
