package com.ai.englishsystem.classmodule;

import com.ai.englishsystem.auth.entity.Role;
import com.ai.englishsystem.auth.repository.RoleRepository;
import com.ai.englishsystem.classmodule.dto.ClassRequest;
import com.ai.englishsystem.classmodule.entity.ClassEntity;
import com.ai.englishsystem.classmodule.repository.ClassRepository;
import com.ai.englishsystem.classmodule.service.ClassService;
import com.ai.englishsystem.common.exception.ForbiddenException;
import com.ai.englishsystem.teacher.entity.Teacher;
import com.ai.englishsystem.teacher.repository.TeacherRepository;
import com.ai.englishsystem.user.entity.User;
import com.ai.englishsystem.user.repository.UserRepository;
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
class ClassServiceAccessTest {

    @Autowired
    private ClassService classService;
    @Autowired
    private ClassRepository classRepository;
    @Autowired
    private RoleRepository roleRepository;
    @Autowired
    private UserRepository userRepository;
    @Autowired
    private TeacherRepository teacherRepository;

    @AfterEach
    void clearSecurity() {
        SecurityContextHolder.clearContext();
    }

    @Test
    void teacherCannotAccessAnotherTeachersClass() {
        Role teacherRole = roleRepository.findByName("TEACHER").orElseThrow();
        String suffix = UUID.randomUUID().toString().substring(0, 8);

        User teacherA = saveTeacherUser(teacherRole, "ca-" + suffix, "ca-" + suffix + "@example.com");
        User teacherB = saveTeacherUser(teacherRole, "cb-" + suffix, "cb-" + suffix + "@example.com");
        Teacher profileB = teacherRepository.findFirstByUser(teacherB).orElseThrow();

        ClassEntity classB = classRepository.save(ClassEntity.builder()
                .name("Class B " + suffix)
                .teacher(profileB)
                .description("owned by B")
                .build());

        SecurityContextHolder.getContext().setAuthentication(new TestingAuthenticationToken(
                String.valueOf(teacherA.getId()),
                "pw",
                List.of(new SimpleGrantedAuthority("ROLE_TEACHER"))));

        assertThatThrownBy(() -> classService.findById(classB.getId()))
                .isInstanceOf(ForbiddenException.class);
    }

    @Test
    void teacherCannotCreateClassForAnotherTeacher() {
        Role teacherRole = roleRepository.findByName("TEACHER").orElseThrow();
        String suffix = UUID.randomUUID().toString().substring(0, 8);

        User teacherA = saveTeacherUser(teacherRole, "cc-" + suffix, "cc-" + suffix + "@example.com");
        User teacherB = saveTeacherUser(teacherRole, "cd-" + suffix, "cd-" + suffix + "@example.com");
        Teacher profileB = teacherRepository.findFirstByUser(teacherB).orElseThrow();

        SecurityContextHolder.getContext().setAuthentication(new TestingAuthenticationToken(
                String.valueOf(teacherA.getId()),
                "pw",
                List.of(new SimpleGrantedAuthority("ROLE_TEACHER"))));

        ClassRequest request = ClassRequest.builder()
                .name("Hijacked class")
                .teacherId(profileB.getId())
                .description("should fail")
                .build();

        assertThatThrownBy(() -> classService.create(request))
                .isInstanceOf(ForbiddenException.class);
    }

    private User saveTeacherUser(Role teacherRole, String username, String email) {
        User user = userRepository.save(User.builder()
                .username(username)
                .email(email)
                .password("encoded")
                .fullName("Teacher " + username)
                .role(teacherRole)
                .status("ACTIVE")
                .build());
        teacherRepository.save(Teacher.builder()
                .user(user)
                .teacherCode("T-" + username)
                .build());
        return user;
    }
}
