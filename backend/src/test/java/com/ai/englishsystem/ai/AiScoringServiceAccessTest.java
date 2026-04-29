package com.ai.englishsystem.ai;

import com.ai.englishsystem.ai.dto.WritingScoreRequest;
import com.ai.englishsystem.ai.entity.AiResult;
import com.ai.englishsystem.ai.repository.AiResultRepository;
import com.ai.englishsystem.ai.service.AiScoringService;
import com.ai.englishsystem.auth.entity.Role;
import com.ai.englishsystem.auth.repository.RoleRepository;
import com.ai.englishsystem.common.exception.ForbiddenException;
import com.ai.englishsystem.exam.entity.Exam;
import com.ai.englishsystem.exam.entity.ExamSection;
import com.ai.englishsystem.exam.entity.ExamSectionType;
import com.ai.englishsystem.exam.entity.Question;
import com.ai.englishsystem.exam.repository.ExamRepository;
import com.ai.englishsystem.exam.repository.ExamSectionRepository;
import com.ai.englishsystem.exam.repository.QuestionRepository;
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
import static org.assertj.core.api.Assertions.assertThatThrownBy;

@SpringBootTest
@ActiveProfiles("test")
@Transactional
class AiScoringServiceAccessTest {

    @Autowired
    private AiScoringService aiScoringService;

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

    @Autowired
    private AiResultRepository aiResultRepository;

    @AfterEach
    void clearSecurity() {
        SecurityContextHolder.clearContext();
    }

    @Test
    void teacherCannotScoreAnswerForAnotherTeachersExam() {
        TestFixture fixture = createFixture();
        authenticateAs(fixture.otherTeacherUser().getId(), "ROLE_TEACHER");

        assertThatThrownBy(() -> aiScoringService.scoreWriting(WritingScoreRequest.builder()
                        .answerId(fixture.answer().getId())
                        .essayText("Tampered essay")
                        .build()))
                .isInstanceOf(ForbiddenException.class)
                .hasMessage("Cannot score answers for another teacher's exam");
    }

    @Test
    void ownerTeacherGetsExistingAiResultForOwnedAnswer() {
        TestFixture fixture = createFixture();
        authenticateAs(fixture.ownerTeacherUser().getId(), "ROLE_TEACHER");

        var response = aiScoringService.scoreWriting(WritingScoreRequest.builder()
                .answerId(fixture.answer().getId())
                .essayText("Ignored because stored answer exists")
                .build());

        assertThat(response.getAiResultId()).isEqualTo(fixture.aiResult().getId());
        assertThat(response.getOverallScore()).isEqualTo(8.5f);
    }

    private TestFixture createFixture() {
        Role teacherRole = roleRepository.findByName("TEACHER").orElseThrow();
        Role studentRole = roleRepository.findByName("STUDENT").orElseThrow();
        String suffix = UUID.randomUUID().toString().substring(0, 8);

        User ownerTeacherUser = userRepository.save(User.builder()
                .username("ais-owner-" + suffix)
                .email("ais-owner-" + suffix + "@example.com")
                .password("hashed")
                .fullName("AI Owner Teacher")
                .role(teacherRole)
                .status("ACTIVE")
                .build());

        User otherTeacherUser = userRepository.save(User.builder()
                .username("ais-other-" + suffix)
                .email("ais-other-" + suffix + "@example.com")
                .password("hashed")
                .fullName("AI Other Teacher")
                .role(teacherRole)
                .status("ACTIVE")
                .build());

        User studentUser = userRepository.save(User.builder()
                .username("ais-student-" + suffix)
                .email("ais-student-" + suffix + "@example.com")
                .password("hashed")
                .fullName("AI Student")
                .role(studentRole)
                .status("ACTIVE")
                .build());

        Teacher ownerTeacher = teacherRepository.save(Teacher.builder()
                .user(ownerTeacherUser)
                .teacherCode("AT-" + suffix + "-1")
                .department("English")
                .build());

        teacherRepository.save(Teacher.builder()
                .user(otherTeacherUser)
                .teacherCode("AT-" + suffix + "-2")
                .department("English")
                .build());

        Student student = studentRepository.save(Student.builder()
                .user(studentUser)
                .studentCode("AS-" + suffix)
                .build());

        Exam exam = examRepository.save(Exam.builder()
                .title("AI Owned Exam " + suffix)
                .description("AI access test")
                .teacher(ownerTeacher)
                .durationMinutes(60)
                .status("ACTIVE")
                .build());

        ExamSection section = examSectionRepository.save(ExamSection.builder()
                .exam(exam)
                .name("Writing")
                .sectionType(ExamSectionType.WRITING)
                .orderIndex(1)
                .build());

        Question question = questionRepository.save(Question.builder()
                .section(section)
                .questionText("Write an essay")
                .questionType("WRITING")
                .points(10)
                .minWords(50)
                .maxWords(150)
                .build());

        Submission submission = submissionRepository.save(Submission.builder()
                .exam(exam)
                .student(student)
                .startTime(LocalDateTime.now().minusMinutes(15))
                .submitTime(LocalDateTime.now().minusMinutes(5))
                .endTime(LocalDateTime.now().minusMinutes(5))
                .duration(600)
                .status(SubmissionStatus.SUBMITTED)
                .build());

        Answer answer = answerRepository.save(Answer.builder()
                .submission(submission)
                .question(question)
                .answerText("Stored essay answer")
                .build());

        AiResult aiResult = aiResultRepository.save(AiResult.builder()
                .answer(answer)
                .grammarScore(8.0f)
                .vocabularyScore(8.5f)
                .coherenceScore(9.0f)
                .overallScore(8.5f)
                .feedback("Stored AI feedback")
                .build());

        return new TestFixture(ownerTeacherUser, otherTeacherUser, answer, aiResult);
    }

    private void authenticateAs(Integer userId, String authority) {
        TestingAuthenticationToken authentication =
                new TestingAuthenticationToken(String.valueOf(userId), null, authority);
        authentication.setAuthenticated(true);
        SecurityContextHolder.getContext().setAuthentication(authentication);
    }

    private record TestFixture(User ownerTeacherUser, User otherTeacherUser, Answer answer, AiResult aiResult) {
    }
}
