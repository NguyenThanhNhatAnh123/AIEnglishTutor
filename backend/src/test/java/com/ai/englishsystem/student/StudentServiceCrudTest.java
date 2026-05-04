package com.ai.englishsystem.student;

import com.ai.englishsystem.auth.entity.Role;
import com.ai.englishsystem.auth.repository.RoleRepository;
import com.ai.englishsystem.common.exception.BadRequestException;
import com.ai.englishsystem.student.dto.StudentUpdateRequest;
import com.ai.englishsystem.student.entity.Student;
import com.ai.englishsystem.student.repository.StudentRepository;
import com.ai.englishsystem.student.service.StudentService;
import com.ai.englishsystem.user.entity.User;
import com.ai.englishsystem.user.repository.UserRepository;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.security.authentication.TestingAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.annotation.Transactional;

import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

@SpringBootTest
@ActiveProfiles("test")
@Transactional
class StudentServiceCrudTest {

    @Autowired
    private StudentService studentService;
    @Autowired
    private RoleRepository roleRepository;
    @Autowired
    private UserRepository userRepository;
    @Autowired
    private StudentRepository studentRepository;

    @AfterEach
    void clearSecurity() {
        SecurityContextHolder.clearContext();
    }

    @Test
    void teacherCanUpdateStudentAndDuplicateCodeRejected() {
        Role teacherRole = roleRepository.findByName("TEACHER").orElseThrow();
        Role studentRole = roleRepository.findByName("STUDENT").orElseThrow();
        String suffix = UUID.randomUUID().toString().substring(0, 8);

        User teacherUser = userRepository.save(User.builder()
                .username("crud-t-" + suffix)
                .email("crud-t-" + suffix + "@example.com")
                .password("x")
                .fullName("Teacher CRUD")
                .role(teacherRole)
                .status("ACTIVE")
                .build());

        User u1 = userRepository.save(User.builder()
                .username("crud-s1-" + suffix)
                .email("crud-s1-" + suffix + "@example.com")
                .password("x")
                .fullName("Student One")
                .role(studentRole)
                .status("ACTIVE")
                .build());
        User u2 = userRepository.save(User.builder()
                .username("crud-s2-" + suffix)
                .email("crud-s2-" + suffix + "@example.com")
                .password("x")
                .fullName("Student Two")
                .role(studentRole)
                .status("ACTIVE")
                .build());

        Student s1 = studentRepository.save(Student.builder().user(u1).studentCode("C1-" + suffix).build());
        studentRepository.save(Student.builder().user(u2).studentCode("C2-" + suffix).build());

        authenticateAs(teacherUser.getId(), "ROLE_TEACHER");

        var updated = studentService.update(s1.getId(), StudentUpdateRequest.builder()
                .fullName("Updated Name")
                .studentCode("C1b-" + suffix)
                .build());
        assertThat(updated.getFullName()).isEqualTo("Updated Name");
        assertThat(updated.getStudentCode()).isEqualTo("C1b-" + suffix);

        assertThatThrownBy(() -> studentService.update(s1.getId(), StudentUpdateRequest.builder()
                .studentCode("C2-" + suffix)
                .build()))
                .isInstanceOf(BadRequestException.class)
                .hasMessageContaining("Student code already exists");
    }

    private void authenticateAs(Integer userId, String authority) {
        TestingAuthenticationToken authentication =
                new TestingAuthenticationToken(String.valueOf(userId), null, authority);
        authentication.setAuthenticated(true);
        SecurityContextHolder.getContext().setAuthentication(authentication);
    }
}
