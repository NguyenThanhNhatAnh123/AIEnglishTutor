package com.ai.englishsystem.result;

import com.ai.englishsystem.auth.entity.Role;
import com.ai.englishsystem.auth.repository.RoleRepository;
import com.ai.englishsystem.common.exception.ForbiddenException;
import com.ai.englishsystem.exam.entity.Exam;
import com.ai.englishsystem.exam.repository.ExamRepository;
import com.ai.englishsystem.result.entity.Score;
import com.ai.englishsystem.result.service.ScoreService;
import com.ai.englishsystem.student.entity.Student;
import com.ai.englishsystem.student.repository.StudentRepository;
import com.ai.englishsystem.submission.entity.Submission;
import com.ai.englishsystem.submission.entity.SubmissionStatus;
import com.ai.englishsystem.submission.repository.SubmissionRepository;
import com.ai.englishsystem.teacher.entity.Teacher;
import com.ai.englishsystem.teacher.repository.TeacherRepository;
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

import java.time.LocalDateTime;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

@SpringBootTest
@ActiveProfiles("test")
@Transactional
class ScoreServiceAccessTest {

    @Autowired
    private ScoreService scoreService;

    @Autowired
    private RoleRepository roleRepository;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private TeacherRepository teacherRepository;

    @Autowired
    private StudentRepository studentRepository;

    @Autowired
    private ExamRepository examRepository;

    @Autowired
    private SubmissionRepository submissionRepository;

    @Autowired
    private com.ai.englishsystem.result.repository.ScoreRepository scoreRepository;

    @AfterEach
    void clearSecurity() {
        SecurityContextHolder.clearContext();
    }

    @Test
    void teacherCannotViewAnotherTeachersSubmissionScore() {
        TestFixture fixture = createFixture();
        authenticateAs(fixture.otherTeacherUser().getId(), "ROLE_TEACHER");

        assertThatThrownBy(() -> scoreService.getBySubmissionId(fixture.submission().getId()))
                .isInstanceOf(ForbiddenException.class)
                .hasMessage("Cannot view scores for another teacher's exam");
    }

    @Test
    void examOwnerCanViewSubmissionScore() {
        TestFixture fixture = createFixture();
        authenticateAs(fixture.ownerTeacherUser().getId(), "ROLE_TEACHER");

        var response = scoreService.getBySubmissionId(fixture.submission().getId());

        assertThat(response.getSubmissionId()).isEqualTo(fixture.submission().getId());
        assertThat(response.getTotalScore()).isEqualTo(85.0f);
    }

    private TestFixture createFixture() {
        Role teacherRole = roleRepository.findByName("TEACHER").orElseThrow();
        Role studentRole = roleRepository.findByName("STUDENT").orElseThrow();
        String suffix = UUID.randomUUID().toString().substring(0, 8);

        User ownerTeacherUser = userRepository.save(User.builder()
                .username("owner-" + suffix)
                .email("owner-" + suffix + "@example.com")
                .password("hashed")
                .fullName("Owner Teacher")
                .role(teacherRole)
                .status("ACTIVE")
                .build());

        User otherTeacherUser = userRepository.save(User.builder()
                .username("other-" + suffix)
                .email("other-" + suffix + "@example.com")
                .password("hashed")
                .fullName("Other Teacher")
                .role(teacherRole)
                .status("ACTIVE")
                .build());

        User studentUser = userRepository.save(User.builder()
                .username("student-" + suffix)
                .email("student-" + suffix + "@example.com")
                .password("hashed")
                .fullName("Student User")
                .role(studentRole)
                .status("ACTIVE")
                .build());

        Teacher ownerTeacher = teacherRepository.save(Teacher.builder()
                .user(ownerTeacherUser)
                .teacherCode("T-" + suffix + "-1")
                .department("English")
                .build());

        teacherRepository.save(Teacher.builder()
                .user(otherTeacherUser)
                .teacherCode("T-" + suffix + "-2")
                .department("English")
                .build());

        Student student = studentRepository.save(Student.builder()
                .user(studentUser)
                .studentCode("S-" + suffix)
                .build());

        Exam exam = examRepository.save(Exam.builder()
                .title("Owned Exam " + suffix)
                .description("Owner visibility test")
                .teacher(ownerTeacher)
                .durationMinutes(60)
                .status("ACTIVE")
                .build());

        Submission submission = submissionRepository.save(Submission.builder()
                .exam(exam)
                .student(student)
                .startTime(LocalDateTime.now().minusMinutes(20))
                .submitTime(LocalDateTime.now().minusMinutes(5))
                .endTime(LocalDateTime.now().minusMinutes(5))
                .duration(900)
                .status(SubmissionStatus.SUBMITTED)
                .build());

        scoreRepository.save(Score.builder()
                .submission(submission)
                .mcScore(85.0f)
                .totalScore(85.0f)
                .build());

        return new TestFixture(ownerTeacherUser, otherTeacherUser, submission);
    }

    private void authenticateAs(Integer userId, String authority) {
        TestingAuthenticationToken authentication =
                new TestingAuthenticationToken(String.valueOf(userId), null, authority);
        authentication.setAuthenticated(true);
        SecurityContextHolder.getContext().setAuthentication(authentication);
    }

    private record TestFixture(User ownerTeacherUser, User otherTeacherUser, Submission submission) {
    }
}
