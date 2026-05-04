package com.ai.englishsystem.result;

import com.ai.englishsystem.ai.dto.AiScoreResponse;
import com.ai.englishsystem.ai.dto.SpeakingScoreRequest;
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
import com.ai.englishsystem.result.service.SpeakingReviewService;
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

import java.nio.file.Path;
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
class SpeakingReviewFlowTest {

    @Autowired
    private SpeakingReviewService speakingReviewService;

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
    void teacherCanGenerateSpeakingDraftWithCustomPromptAndTranscript() {
        TestFixture fixture = createFixture();
        when(aiScoringService.scoreSpeaking(any(SpeakingScoreRequest.class), eq(true)))
                .thenReturn(AiScoreResponse.builder()
                        .overallScore(7.8f)
                        .feedback("Speaking draft feedback")
                        .build());
        when(aiScoringService.transcribeSpeakingAudio(any(Path.class), eq("en")))
                .thenReturn("Generated transcript text");

        authenticateAs(fixture.ownerTeacherUser().getId(), "ROLE_TEACHER");
        var response = speakingReviewService.generateDraft(fixture.answer().getId(), "Focus on pronunciation and fluency.", "en");

        ArgumentCaptor<SpeakingScoreRequest> captor = ArgumentCaptor.forClass(SpeakingScoreRequest.class);
        verify(aiScoringService).scoreSpeaking(captor.capture(), eq(true));
        assertThat(captor.getValue().getCustomPrompt()).isEqualTo("Focus on pronunciation and fluency.");
        assertThat(response.getStatus()).isEqualTo("DRAFT");
        assertThat(response.getDraftScore()).isEqualTo(78.0f);
        assertThat(response.getDraftTranscript()).isEqualTo("Generated transcript text");
    }

    @Test
    void studentCannotSeeSpeakingBeforePublishButCanSeeAfterPublish() {
        TestFixture fixture = createFixture();
        when(aiScoringService.scoreSpeaking(any(SpeakingScoreRequest.class), eq(true)))
                .thenReturn(AiScoreResponse.builder()
                        .overallScore(7.8f)
                        .feedback("Speaking draft feedback")
                        .build());
        when(aiScoringService.transcribeSpeakingAudio(any(Path.class), eq("en")))
                .thenReturn("Generated transcript text");

        authenticateAs(fixture.ownerTeacherUser().getId(), "ROLE_TEACHER");
        speakingReviewService.generateDraft(fixture.answer().getId(), null, "en");

        authenticateAs(fixture.studentUser().getId(), "ROLE_STUDENT");
        var beforePublish = scoreService.getBySubmissionId(fixture.submission().getId());
        assertThat(beforePublish.getSpeakingReviewPublished()).isFalse();
        assertThat(beforePublish.getSpeakingScore()).isNull();

        authenticateAs(fixture.ownerTeacherUser().getId(), "ROLE_TEACHER");
        speakingReviewService.approveAndPublish(fixture.answer().getId());

        authenticateAs(fixture.studentUser().getId(), "ROLE_STUDENT");
        var afterPublish = scoreService.getBySubmissionId(fixture.submission().getId());
        assertThat(afterPublish.getSpeakingReviewPublished()).isTrue();
        assertThat(afterPublish.getSpeakingScore()).isEqualTo(78.0f);
        assertThat(afterPublish.getFeedback()).contains("Speaking draft feedback");
    }

    @Test
    void nonOwnerTeacherCannotManageSpeakingReview() {
        TestFixture fixture = createFixture();
        authenticateAs(fixture.otherTeacherUser().getId(), "ROLE_TEACHER");

        assertThatThrownBy(() -> speakingReviewService.generateDraft(fixture.answer().getId(), null, "en"))
                .isInstanceOf(ForbiddenException.class)
                .hasMessage("Cannot manage speaking reviews for another teacher's exam");
    }

    private TestFixture createFixture() {
        Role teacherRole = roleRepository.findByName("TEACHER").orElseThrow();
        Role studentRole = roleRepository.findByName("STUDENT").orElseThrow();
        String suffix = UUID.randomUUID().toString().substring(0, 8);

        User ownerTeacherUser = userRepository.save(User.builder()
                .username("sp-owner-" + suffix)
                .email("sp-owner-" + suffix + "@example.com")
                .password("hashed")
                .fullName("Speaking Owner Teacher")
                .role(teacherRole)
                .status("ACTIVE")
                .build());

        User otherTeacherUser = userRepository.save(User.builder()
                .username("sp-other-" + suffix)
                .email("sp-other-" + suffix + "@example.com")
                .password("hashed")
                .fullName("Speaking Other Teacher")
                .role(teacherRole)
                .status("ACTIVE")
                .build());

        User studentUser = userRepository.save(User.builder()
                .username("sp-student-" + suffix)
                .email("sp-student-" + suffix + "@example.com")
                .password("hashed")
                .fullName("Speaking Student")
                .role(studentRole)
                .status("ACTIVE")
                .build());

        Teacher ownerTeacher = teacherRepository.save(Teacher.builder()
                .user(ownerTeacherUser)
                .teacherCode("SPR-" + suffix + "-1")
                .department("English")
                .build());

        teacherRepository.save(Teacher.builder()
                .user(otherTeacherUser)
                .teacherCode("SPR-" + suffix + "-2")
                .department("English")
                .build());

        Student student = studentRepository.save(Student.builder()
                .user(studentUser)
                .studentCode("SPSR-" + suffix)
                .build());

        Exam exam = examRepository.save(Exam.builder()
                .title("Speaking Review Exam " + suffix)
                .description("Speaking review flow")
                .teacher(ownerTeacher)
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
                .questionText("Describe your favorite city.")
                .questionType("SPEAKING")
                .points(10)
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
                .mcScore(72f)
                .writingScore(null)
                .speakingScore(null)
                .totalScore(72f)
                .gradedAt(LocalDateTime.now().minusMinutes(9))
                .build());

        Answer answer = answerRepository.save(Answer.builder()
                .submission(submission)
                .question(question)
                .speakingAudioUrl("/uploads/audio/speaking/sample-test.mp3")
                .speakingDurationSeconds(42)
                .speakingFormat("mp3")
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
