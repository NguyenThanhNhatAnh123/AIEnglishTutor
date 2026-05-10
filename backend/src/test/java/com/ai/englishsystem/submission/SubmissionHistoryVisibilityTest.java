package com.ai.englishsystem.submission;

import com.ai.englishsystem.auth.entity.Role;
import com.ai.englishsystem.auth.repository.RoleRepository;
import com.ai.englishsystem.exam.entity.Exam;
import com.ai.englishsystem.exam.entity.ExamSection;
import com.ai.englishsystem.exam.entity.ExamSectionType;
import com.ai.englishsystem.exam.entity.Question;
import com.ai.englishsystem.exam.repository.ExamRepository;
import com.ai.englishsystem.exam.repository.ExamSectionRepository;
import com.ai.englishsystem.exam.repository.QuestionRepository;
import com.ai.englishsystem.result.entity.Feedback;
import com.ai.englishsystem.result.entity.Score;
import com.ai.englishsystem.result.entity.WritingReviewStatus;
import com.ai.englishsystem.result.repository.FeedbackRepository;
import com.ai.englishsystem.result.repository.ScoreRepository;
import com.ai.englishsystem.student.entity.Student;
import com.ai.englishsystem.student.repository.StudentRepository;
import com.ai.englishsystem.submission.dto.SubmissionListResponse;
import com.ai.englishsystem.submission.entity.Answer;
import com.ai.englishsystem.submission.entity.Submission;
import com.ai.englishsystem.submission.entity.SubmissionStatus;
import com.ai.englishsystem.submission.repository.AnswerRepository;
import com.ai.englishsystem.submission.repository.SubmissionRepository;
import com.ai.englishsystem.submission.service.SubmissionService;
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
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest
@ActiveProfiles("test")
@Transactional
class SubmissionHistoryVisibilityTest {

    @Autowired
    private SubmissionService submissionService;
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
    private FeedbackRepository feedbackRepository;
    @Autowired
    private ScoreRepository scoreRepository;

    @AfterEach
    void clearSecurity() {
        SecurityContextHolder.clearContext();
    }

    @Test
    void studentHistoryHidesTotalScoreWhileWritingReviewIsStillDraft() {
        Fixture fixture = createFixture(WritingReviewStatus.DRAFT);
        authenticateAsStudent(fixture.studentUser().getId());

        List<SubmissionListResponse> history = submissionService.listMySubmissions();

        assertThat(history).hasSize(1);
        assertThat(history.getFirst().getTotalScore()).isNull();
    }

    @Test
    void studentHistoryShowsTotalScoreAfterWritingReviewIsPublished() {
        Fixture fixture = createFixture(WritingReviewStatus.PUBLISHED);
        authenticateAsStudent(fixture.studentUser().getId());

        List<SubmissionListResponse> history = submissionService.listMySubmissions();

        assertThat(history).hasSize(1);
        assertThat(history.getFirst().getTotalScore()).isEqualTo(88f);
    }

    private Fixture createFixture(WritingReviewStatus reviewStatus) {
        Role teacherRole = roleRepository.findByName("TEACHER").orElseThrow();
        Role studentRole = roleRepository.findByName("STUDENT").orElseThrow();
        String suffix = UUID.randomUUID().toString().substring(0, 8);

        User teacherUser = userRepository.save(User.builder()
                .username("hist-teacher-" + suffix)
                .email("hist-teacher-" + suffix + "@example.com")
                .password("hashed")
                .fullName("History Teacher")
                .role(teacherRole)
                .status("ACTIVE")
                .build());
        User studentUser = userRepository.save(User.builder()
                .username("hist-student-" + suffix)
                .email("hist-student-" + suffix + "@example.com")
                .password("hashed")
                .fullName("History Student")
                .role(studentRole)
                .status("ACTIVE")
                .build());

        Teacher teacher = teacherRepository.save(Teacher.builder()
                .user(teacherUser)
                .teacherCode("HT-" + suffix)
                .department("English")
                .build());
        Student student = studentRepository.save(Student.builder()
                .user(studentUser)
                .studentCode("HS-" + suffix)
                .build());

        Exam exam = examRepository.save(Exam.builder()
                .title("History Visibility Exam " + suffix)
                .description("Student history visibility")
                .teacher(teacher)
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
                .questionText("Describe your learning routine.")
                .questionType("WRITING")
                .points(10)
                .minWords(50)
                .maxWords(200)
                .build());

        Submission submission = submissionRepository.save(Submission.builder()
                .exam(exam)
                .student(student)
                .startTime(LocalDateTime.now().minusMinutes(20))
                .submitTime(LocalDateTime.now().minusMinutes(5))
                .endTime(LocalDateTime.now().minusMinutes(5))
                .status(SubmissionStatus.SUBMITTED)
                .answeredQuestions(1)
                .totalQuestions(1)
                .completionPercent(100)
                .duration(900)
                .build());

        Answer answer = answerRepository.save(Answer.builder()
                .submission(submission)
                .question(question)
                .answerText("This is a full writing answer that should require teacher publication before score release.")
                .build());

        feedbackRepository.save(Feedback.builder()
                .answer(answer)
                .reviewStatus(reviewStatus)
                .draftScore(88f)
                .publishedScore(reviewStatus == WritingReviewStatus.PUBLISHED ? 88f : null)
                .aiFeedback("Draft feedback")
                .teacherFeedback(reviewStatus == WritingReviewStatus.PUBLISHED ? "Published feedback" : null)
                .publishedAt(reviewStatus == WritingReviewStatus.PUBLISHED ? LocalDateTime.now().minusMinutes(1) : null)
                .publishedBy(reviewStatus == WritingReviewStatus.PUBLISHED ? teacherUser.getId() : null)
                .build());

        scoreRepository.save(Score.builder()
                .submission(submission)
                .writingScore(reviewStatus == WritingReviewStatus.PUBLISHED ? 88f : null)
                .totalScore(88f)
                .gradedAt(LocalDateTime.now().minusMinutes(1))
                .gradedBy(teacherUser.getId())
                .build());

        return new Fixture(studentUser);
    }

    private void authenticateAsStudent(Integer userId) {
        TestingAuthenticationToken authentication =
                new TestingAuthenticationToken(String.valueOf(userId), null, "ROLE_STUDENT");
        authentication.setAuthenticated(true);
        SecurityContextHolder.getContext().setAuthentication(authentication);
    }

    private record Fixture(User studentUser) {
    }
}
