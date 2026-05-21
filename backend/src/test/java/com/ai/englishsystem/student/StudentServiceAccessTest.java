package com.ai.englishsystem.student;

import com.ai.englishsystem.auth.entity.Role;
import com.ai.englishsystem.auth.repository.RoleRepository;
import com.ai.englishsystem.classmodule.entity.ClassEntity;
import com.ai.englishsystem.classmodule.entity.ClassStudent;
import com.ai.englishsystem.classmodule.repository.ClassRepository;
import com.ai.englishsystem.classmodule.repository.ClassStudentRepository;
import com.ai.englishsystem.common.exception.ForbiddenException;
import com.ai.englishsystem.student.entity.Student;
import com.ai.englishsystem.student.repository.StudentRepository;
import com.ai.englishsystem.student.service.StudentService;
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

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

@SpringBootTest
@ActiveProfiles("test")
@Transactional
class StudentServiceAccessTest {

    @Autowired
    private StudentService studentService;
    @Autowired
    private RoleRepository roleRepository;
    @Autowired
    private UserRepository userRepository;
    @Autowired
    private TeacherRepository teacherRepository;
    @Autowired
    private StudentRepository studentRepository;
    @Autowired
    private ClassRepository classRepository;
    @Autowired
    private ClassStudentRepository classStudentRepository;

    @AfterEach
    void clearSecurity() {
        SecurityContextHolder.clearContext();
    }

    @Test
    void teacherOnlySeesStudentsEnrolledInOwnClasses() {
        Role teacherRole = roleRepository.findByName("TEACHER").orElseThrow();
        Role studentRole = roleRepository.findByName("STUDENT").orElseThrow();
        String suffix = UUID.randomUUID().toString().substring(0, 8);

        User teacherA = saveTeacherUser(teacherRole, "sa-ta-" + suffix);
        User teacherB = saveTeacherUser(teacherRole, "sa-tb-" + suffix);
        Teacher profileA = teacherRepository.findFirstByUser(teacherA).orElseThrow();
        Teacher profileB = teacherRepository.findFirstByUser(teacherB).orElseThrow();

        Student studentA = saveStudent(studentRole, "sa-sa-" + suffix);
        Student studentB = saveStudent(studentRole, "sa-sb-" + suffix);

        ClassEntity classA = classRepository.save(ClassEntity.builder()
                .name("Class A " + suffix)
                .teacher(profileA)
                .build());
        ClassEntity classB = classRepository.save(ClassEntity.builder()
                .name("Class B " + suffix)
                .teacher(profileB)
                .build());

        classStudentRepository.save(ClassStudent.builder().classEntity(classA).student(studentA).build());
        classStudentRepository.save(ClassStudent.builder().classEntity(classB).student(studentB).build());

        SecurityContextHolder.getContext().setAuthentication(auth(teacherA.getId()));

        assertThat(studentService.findAll())
                .extracting(r -> r.getId())
                .containsExactly(studentA.getId());

        assertThatThrownBy(() -> studentService.findById(studentB.getId()))
                .isInstanceOf(ForbiddenException.class);
    }

    private User saveTeacherUser(Role teacherRole, String username) {
        User user = userRepository.save(User.builder()
                .username(username)
                .email(username + "@example.com")
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

    private Student saveStudent(Role studentRole, String username) {
        User user = userRepository.save(User.builder()
                .username(username)
                .email(username + "@example.com")
                .password("encoded")
                .fullName("Student " + username)
                .role(studentRole)
                .status("ACTIVE")
                .build());
        return studentRepository.save(Student.builder()
                .user(user)
                .studentCode("S-" + username)
                .build());
    }

    private TestingAuthenticationToken auth(Integer userId) {
        return new TestingAuthenticationToken(
                String.valueOf(userId),
                "pw",
                List.of(new SimpleGrantedAuthority("ROLE_TEACHER")));
    }
}
