package com.ai.englishsystem.result;

import com.ai.englishsystem.ai.dto.AiScoreResponse;
import com.ai.englishsystem.ai.dto.WritingScoreRequest;
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
import com.ai.englishsystem.result.entity.Score;
import com.ai.englishsystem.result.repository.ScoreRepository;
import com.ai.englishsystem.result.service.ScoreService;
import com.ai.englishsystem.result.service.WritingReviewService;
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
import org.mockito.ArgumentCaptor;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.security.authentication.TestingAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@SpringBootTest
@ActiveProfiles("test")
@Transactional
class WritingReviewFlowTest {

    @Autowired
    private WritingReviewService writingReviewService;

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
    private ExamSectionRepository examSectionRepository;

    @Autowired
    private QuestionRepository questionRepository;

    @Autowired
    private SubmissionRepository submissionRepository;

    @Autowired
    private AnswerRepository answerRepository;

    @Autowired
    private ScoreRepository scoreRepository;

    @MockBean
    private AiScoringService aiScoringService;

    @AfterEach
    void clearSecurity() {
        SecurityContextHolder.clearContext();
    }

    @Test
    void teacherCanGenerateDraftWithCustomPrompt() {
        TestFixture fixture = createFixture();
        when(aiScoringService.scoreWriting(any(WritingScoreRequest.class), eq(true)))
                .thenReturn(AiScoreResponse.builder()
                        .overallScore(8.2f)
                        .feedback("AI draft feedback")
                        .build());

        authenticateAs(fixture.ownerTeacherUser().getId(), "ROLE_TEACHER");
        var response = writingReviewService.generateDraft(fixture.answer().getId(), "Focus on cohesion first.");

        ArgumentCaptor<WritingScoreRequest> captor = ArgumentCaptor.forClass(WritingScoreRequest.class);
        verify(aiScoringService).scoreWriting(captor.capture(), eq(true));
        assertThat(captor.getValue().getCustomPrompt()).isEqualTo("Focus on cohesion first.");
        assertThat(response.getStatus()).isEqualTo("DRAFT");
        assertThat(response.getDraftScore()).isEqualTo(82.0f);
    }

    @Test
    void studentCannotSeeWritingBeforePublishButCanSeeAfterPublish() {
        TestFixture fixture = createFixture();
        when(aiScoringService.scoreWriting(any(WritingScoreRequest.class), eq(true)))
                .thenReturn(AiScoreResponse.builder()
                        .overallScore(8.2f)
                        .feedback("AI draft feedback")
                        .build());

        authenticateAs(fixture.ownerTeacherUser().getId(), "ROLE_TEACHER");
        writingReviewService.generateDraft(fixture.answer().getId(), "Use strict IELTS style.");

        authenticateAs(fixture.studentUser().getId(), "ROLE_STUDENT");
        var beforePublish = scoreService.getBySubmissionId(fixture.submission().getId());
        assertThat(beforePublish.getWritingReviewPublished()).isFalse();
        assertThat(beforePublish.getWritingScore()).isNull();
        assertThat(beforePublish.getWritingReviewMessage()).isEqualTo("Awaiting teacher review and publication.");

        authenticateAs(fixture.ownerTeacherUser().getId(), "ROLE_TEACHER");
        writingReviewService.approveAndPublish(fixture.answer().getId());

        authenticateAs(fixture.studentUser().getId(), "ROLE_STUDENT");
        var afterPublish = scoreService.getBySubmissionId(fixture.submission().getId());
        assertThat(afterPublish.getWritingReviewPublished()).isTrue();
        assertThat(afterPublish.getWritingScore()).isEqualTo(82.0f);
        assertThat(afterPublish.getFeedback()).contains("AI draft feedback");
    }

    @Test
    void nonOwnerTeacherCannotManageWritingReview() {
        TestFixture fixture = createFixture();
        authenticateAs(fixture.otherTeacherUser().getId(), "ROLE_TEACHER");

        assertThatThrownBy(() -> writingReviewService.generateDraft(fixture.answer().getId(), null))
                .isInstanceOf(ForbiddenException.class)
                .hasMessage("Cannot manage writing reviews for another teacher's exam");
    }

    private TestFixture createFixture() {
        Role teacherRole = roleRepository.findByName("TEACHER").orElseThrow();
        Role studentRole = roleRepository.findByName("STUDENT").orElseThrow();
        String suffix = UUID.randomUUID().toString().substring(0, 8);

        User ownerTeacherUser = userRepository.save(User.builder()
                .username("wr-owner-" + suffix)
                .email("wr-owner-" + suffix + "@example.com")
                .password("hashed")
                .fullName("Writing Owner Teacher")
                .role(teacherRole)
                .status("ACTIVE")
                .build());

        User otherTeacherUser = userRepository.save(User.builder()
                .username("wr-other-" + suffix)
                .email("wr-other-" + suffix + "@example.com")
                .password("hashed")
                .fullName("Writing Other Teacher")
                .role(teacherRole)
                .status("ACTIVE")
                .build());

        User studentUser = userRepository.save(User.builder()
                .username("wr-student-" + suffix)
                .email("wr-student-" + suffix + "@example.com")
                .password("hashed")
                .fullName("Writing Student")
                .role(studentRole)
                .status("ACTIVE")
                .build());

        Teacher ownerTeacher = teacherRepository.save(Teacher.builder()
                .user(ownerTeacherUser)
                .teacherCode("WR-" + suffix + "-1")
                .department("English")
                .build());

        teacherRepository.save(Teacher.builder()
                .user(otherTeacherUser)
                .teacherCode("WR-" + suffix + "-2")
                .department("English")
                .build());

        Student student = studentRepository.save(Student.builder()
                .user(studentUser)
                .studentCode("WRS-" + suffix)
                .build());

        Exam exam = examRepository.save(Exam.builder()
                .title("Writing Review Exam " + suffix)
                .description("Writing review flow")
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
                .questionText("Write about your hometown.")
                .questionType("WRITING")
                .points(10)
                .minWords(50)
                .maxWords(180)
                .build());

        Submission submission = submissionRepository.save(Submission.builder()
                .exam(exam)
                .student(student)
                .startTime(LocalDateTime.now().minusMinutes(30))
                .submitTime(LocalDateTime.now().minusMinutes(10))
                .endTime(LocalDateTime.now().minusMinutes(10))
                .duration(1200)
                .status(SubmissionStatus.SUBMITTED)
                .build());

        scoreRepository.save(Score.builder()
                .submission(submission)
                .mcScore(70f)
                .writingScore(null)
                .speakingScore(null)
                .totalScore(70f)
                .gradedAt(LocalDateTime.now().minusMinutes(9))
                .build());

        Answer answer = answerRepository.save(Answer.builder()
                .submission(submission)
                .question(question)
                .answerText("My hometown is peaceful and full of friendly people.")
                .build());

        return new TestFixture(ownerTeacherUser, otherTeacherUser, studentUser, submission, answer);
    }

    private void authenticateAs(Integer userId, String authority) {
        TestingAuthenticationToken authentication =
                new TestingAuthenticationToken(String.valueOf(userId), null, authority);
        authentication.setAuthenticated(true);
        SecurityContextHolder.getContext().setAuthentication(authentication);
    }

    private record TestFixture(
            User ownerTeacherUser,
            User otherTeacherUser,
            User studentUser,
            Submission submission,
            Answer answer
    ) {
    }
}
