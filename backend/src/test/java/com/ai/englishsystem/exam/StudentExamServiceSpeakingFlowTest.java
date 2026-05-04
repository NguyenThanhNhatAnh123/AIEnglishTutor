package com.ai.englishsystem.exam;

import com.ai.englishsystem.auth.entity.Role;
import com.ai.englishsystem.auth.repository.RoleRepository;
import com.ai.englishsystem.exam.entity.Exam;
import com.ai.englishsystem.exam.entity.ExamSection;
import com.ai.englishsystem.exam.entity.ExamSectionType;
import com.ai.englishsystem.exam.entity.Question;
import com.ai.englishsystem.exam.repository.ExamRepository;
import com.ai.englishsystem.exam.repository.ExamSectionRepository;
import com.ai.englishsystem.exam.repository.QuestionRepository;
import com.ai.englishsystem.exam.service.StudentExamService;
import com.ai.englishsystem.student.entity.Student;
import com.ai.englishsystem.student.repository.StudentRepository;
import com.ai.englishsystem.submission.entity.Answer;
import com.ai.englishsystem.submission.entity.Submission;
import com.ai.englishsystem.submission.entity.SubmissionStatus;
import com.ai.englishsystem.submission.repository.AnswerRepository;
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

@SpringBootTest
@ActiveProfiles("test")
@Transactional
class StudentExamServiceSpeakingFlowTest {

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
    private ExamSectionRepository examSectionRepository;

    @Autowired
    private QuestionRepository questionRepository;

    @Autowired
    private SubmissionRepository submissionRepository;

    @Autowired
    private AnswerRepository answerRepository;

    @AfterEach
    void clearSecurity() {
        SecurityContextHolder.clearContext();
    }

    @Test
    void submitDoesNotAutoExposeSpeakingScoreBeforeTeacherPublish() {
        TestFixture fixture = createFixture();
        authenticateAs(fixture.studentUser().getId(), "ROLE_STUDENT");

        var response = studentExamService.submitExam(fixture.submission().getId());

        assertThat(response.getSpeakingScore()).isNull();
    }

    private TestFixture createFixture() {
        Role teacherRole = roleRepository.findByName("TEACHER").orElseThrow();
        Role studentRole = roleRepository.findByName("STUDENT").orElseThrow();
        String suffix = UUID.randomUUID().toString().substring(0, 8);

        User teacherUser = userRepository.save(User.builder()
                .username("speak-owner-" + suffix)
                .email("speak-owner-" + suffix + "@example.com")
                .password("hashed")
                .fullName("Speaking Owner Teacher")
                .role(teacherRole)
                .status("ACTIVE")
                .build());

        User studentUser = userRepository.save(User.builder()
                .username("speak-student-" + suffix)
                .email("speak-student-" + suffix + "@example.com")
                .password("hashed")
                .fullName("Speaking Student")
                .role(studentRole)
                .status("ACTIVE")
                .build());

        Teacher teacher = teacherRepository.save(Teacher.builder()
                .user(teacherUser)
                .teacherCode("SP-" + suffix)
                .department("English")
                .build());

        Student student = studentRepository.save(Student.builder()
                .user(studentUser)
                .studentCode("SPS-" + suffix)
                .build());

        Exam exam = examRepository.save(Exam.builder()
                .title("Submit Speaking Exam " + suffix)
                .description("Speaking submit test")
                .teacher(teacher)
                .durationMinutes(60)
                .status("ACTIVE")
                .build());

        ExamSection section = examSectionRepository.save(ExamSection.builder()
                .exam(exam)
                .name("Speaking")
                .sectionType(ExamSectionType.SPEAKING)
                .orderIndex(1)
                .build());

        Question question = questionRepository.save(Question.builder()
                .section(section)
                .questionText("Describe a memorable trip.")
                .questionType("SPEAKING")
                .points(10)
                .build());

        Submission submission = submissionRepository.save(Submission.builder()
                .exam(exam)
                .student(student)
                .startTime(LocalDateTime.now().minusMinutes(10))
                .status(SubmissionStatus.IN_PROGRESS)
                .build());

        answerRepository.save(Answer.builder()
                .submission(submission)
                .question(question)
                .speakingAudioUrl("/uploads/audio/speaking/sample.mp3")
                .speakingDurationSeconds(30)
                .speakingFormat("mp3")
                .build());

        return new TestFixture(studentUser, submission);
    }

    private void authenticateAs(Integer userId, String authority) {
        TestingAuthenticationToken authentication =
                new TestingAuthenticationToken(String.valueOf(userId), null, authority);
        authentication.setAuthenticated(true);
        SecurityContextHolder.getContext().setAuthentication(authentication);
    }

    private record TestFixture(User studentUser, Submission submission) {
    }
}
