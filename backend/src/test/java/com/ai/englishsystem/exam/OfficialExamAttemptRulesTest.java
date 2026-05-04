package com.ai.englishsystem.exam;

import com.ai.englishsystem.auth.entity.Role;
import com.ai.englishsystem.auth.repository.RoleRepository;
import com.ai.englishsystem.common.exception.BadRequestException;
import com.ai.englishsystem.exam.entity.Exam;
import com.ai.englishsystem.exam.entity.ExamAttempt;
import com.ai.englishsystem.exam.entity.ExamType;
import com.ai.englishsystem.exam.repository.ExamAttemptRepository;
import com.ai.englishsystem.exam.repository.ExamRepository;
import com.ai.englishsystem.exam.service.StudentExamService;
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
class OfficialExamAttemptRulesTest {

    @Autowired
    private StudentExamService studentExamService;
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
    private ExamAttemptRepository examAttemptRepository;

    @AfterEach
    void clearSecurity() {
        SecurityContextHolder.clearContext();
    }

    @Test
    void officialExamBlocksSecondStartAfterSubmittedSubmission() {
        Fixture f = buildOfficialExamFixture();
        authenticateAs(f.studentUserId(), "ROLE_STUDENT");

        assertThatThrownBy(() -> studentExamService.startExam(f.exam().getId()))
                .isInstanceOf(BadRequestException.class)
                .hasMessageContaining("official exam");
    }

    @Test
    void practiceExamAllowsMultipleStartsAfterSubmittedSubmission() {
        Fixture f = buildPracticeExamFixture();
        authenticateAs(f.studentUserId(), "ROLE_STUDENT");

        var next = studentExamService.startExam(f.exam().getId());
        assertThat(next.getId()).isNotEqualTo(f.submission().getId());
    }

    private Fixture buildOfficialExamFixture() {
        String suffix = UUID.randomUUID().toString().substring(0, 8);
        Role teacherRole = roleRepository.findByName("TEACHER").orElseThrow();
        Role studentRole = roleRepository.findByName("STUDENT").orElseThrow();

        User teacherUser = userRepository.save(User.builder()
                .username("off-t-" + suffix)
                .email("off-t-" + suffix + "@example.com")
                .password("x")
                .fullName("Teacher")
                .role(teacherRole)
                .status("ACTIVE")
                .build());
        User studentUser = userRepository.save(User.builder()
                .username("off-s-" + suffix)
                .email("off-s-" + suffix + "@example.com")
                .password("x")
                .fullName("Student")
                .role(studentRole)
                .status("ACTIVE")
                .build());

        Teacher teacher = teacherRepository.save(Teacher.builder()
                .user(teacherUser)
                .teacherCode("OT-" + suffix)
                .department("English")
                .build());
        Student student = studentRepository.save(Student.builder()
                .user(studentUser)
                .studentCode("OS-" + suffix)
                .build());

        Exam exam = examRepository.save(Exam.builder()
                .title("Official " + suffix)
                .teacher(teacher)
                .durationMinutes(30)
                .status("ACTIVE")
                .examType(ExamType.OFFICIAL)
                .build());

        ExamAttempt attempt = examAttemptRepository.save(ExamAttempt.builder()
                .exam(exam)
                .student(student)
                .attemptNumber(1)
                .startTime(LocalDateTime.now().minusHours(1))
                .endTime(LocalDateTime.now())
                .build());

        Submission submission = submissionRepository.save(Submission.builder()
                .exam(exam)
                .student(student)
                .examAttempt(attempt)
                .startTime(LocalDateTime.now().minusHours(1))
                .submitTime(LocalDateTime.now())
                .status(SubmissionStatus.SUBMITTED)
                .build());

        return new Fixture(exam, submission, studentUser.getId());
    }

    private Fixture buildPracticeExamFixture() {
        String suffix = UUID.randomUUID().toString().substring(0, 8);
        Role teacherRole = roleRepository.findByName("TEACHER").orElseThrow();
        Role studentRole = roleRepository.findByName("STUDENT").orElseThrow();

        User teacherUser = userRepository.save(User.builder()
                .username("pr-t-" + suffix)
                .email("pr-t-" + suffix + "@example.com")
                .password("x")
                .fullName("Teacher")
                .role(teacherRole)
                .status("ACTIVE")
                .build());
        User studentUser = userRepository.save(User.builder()
                .username("pr-s-" + suffix)
                .email("pr-s-" + suffix + "@example.com")
                .password("x")
                .fullName("Student")
                .role(studentRole)
                .status("ACTIVE")
                .build());

        Teacher teacher = teacherRepository.save(Teacher.builder()
                .user(teacherUser)
                .teacherCode("PT-" + suffix)
                .department("English")
                .build());
        Student student = studentRepository.save(Student.builder()
                .user(studentUser)
                .studentCode("PS-" + suffix)
                .build());

        Exam exam = examRepository.save(Exam.builder()
                .title("Practice " + suffix)
                .teacher(teacher)
                .durationMinutes(30)
                .status("ACTIVE")
                .examType(ExamType.PRACTICE)
                .build());

        ExamAttempt attempt = examAttemptRepository.save(ExamAttempt.builder()
                .exam(exam)
                .student(student)
                .attemptNumber(1)
                .startTime(LocalDateTime.now().minusHours(1))
                .endTime(LocalDateTime.now())
                .build());

        Submission submission = submissionRepository.save(Submission.builder()
                .exam(exam)
                .student(student)
                .examAttempt(attempt)
                .startTime(LocalDateTime.now().minusHours(1))
                .submitTime(LocalDateTime.now())
                .status(SubmissionStatus.SUBMITTED)
                .build());

        return new Fixture(exam, submission, studentUser.getId());
    }

    private void authenticateAs(Integer userId, String authority) {
        TestingAuthenticationToken authentication =
                new TestingAuthenticationToken(String.valueOf(userId), null, authority);
        authentication.setAuthenticated(true);
        SecurityContextHolder.getContext().setAuthentication(authentication);
    }

    private record Fixture(Exam exam, Submission submission, Integer studentUserId) {
    }
}
