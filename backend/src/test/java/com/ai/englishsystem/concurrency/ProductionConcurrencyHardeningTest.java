package com.ai.englishsystem.concurrency;

import com.ai.englishsystem.auth.entity.Role;
import com.ai.englishsystem.auth.repository.RoleRepository;
import com.ai.englishsystem.common.exception.BadRequestException;
import com.ai.englishsystem.exam.entity.Exam;
import com.ai.englishsystem.exam.entity.ExamSection;
import com.ai.englishsystem.exam.entity.ExamSectionType;
import com.ai.englishsystem.exam.entity.Question;
import com.ai.englishsystem.exam.entity.QuestionOption;
import com.ai.englishsystem.exam.repository.ExamRepository;
import com.ai.englishsystem.exam.repository.ExamSectionRepository;
import com.ai.englishsystem.exam.repository.QuestionRepository;
import com.ai.englishsystem.exam.service.StudentExamService;
import com.ai.englishsystem.media.audio.FfmpegAudioService;
import com.ai.englishsystem.speaking.service.SpeakingUploadService;
import com.ai.englishsystem.student.entity.Student;
import com.ai.englishsystem.student.repository.StudentRepository;
import com.ai.englishsystem.submission.dto.AnswerRequest;
import com.ai.englishsystem.submission.entity.Answer;
import com.ai.englishsystem.submission.entity.Submission;
import com.ai.englishsystem.submission.entity.SubmissionStatus;
import com.ai.englishsystem.submission.repository.AnswerRepository;
import com.ai.englishsystem.submission.repository.SubmissionRepository;
import com.ai.englishsystem.submission.service.AnswerService;
import com.ai.englishsystem.teacher.entity.Teacher;
import com.ai.englishsystem.teacher.repository.TeacherRepository;
import com.ai.englishsystem.user.entity.User;
import com.ai.englishsystem.user.repository.UserRepository;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.security.authentication.TestingAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.util.ReflectionTestUtils;

import java.nio.file.Path;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.Callable;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

@SpringBootTest
@ActiveProfiles("test")
class ProductionConcurrencyHardeningTest {

    private static final int CONCURRENCY = 12;

    @Autowired
    private StudentExamService studentExamService;
    @Autowired
    private AnswerService answerService;
    @Autowired
    private SpeakingUploadService speakingUploadService;
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

    @MockBean
    private FfmpegAudioService ffmpegAudioService;

    @TempDir
    Path uploadRoot;

    @AfterEach
    void clearSecurity() {
        SecurityContextHolder.clearContext();
    }

    @Test
    void concurrentStartExamReturnsOneInProgressSubmission() throws Exception {
        Fixture fixture = createFixture(ExamSectionType.READING, "MULTIPLE_CHOICE");

        List<Result<Integer>> results = runConcurrently(() -> {
            authenticateAs(fixture.studentUser().getId(), "ROLE_STUDENT");
            return studentExamService.startExam(fixture.exam().getId()).getId();
        });

        assertThat(results).allMatch(Result::success);
        assertThat(new HashSet<>(results.stream().map(Result::value).toList())).hasSize(1);
        Student student = studentRepository.findByUser_Id(fixture.studentUser().getId()).orElseThrow();
        assertThat(submissionRepository.findByExamAndStudentAndStatus(
                fixture.exam(), student, SubmissionStatus.IN_PROGRESS)).isPresent();
    }

    @Test
    void concurrentSaveAnswerKeepsSingleAnswerRow() throws Exception {
        Fixture fixture = createFixture(ExamSectionType.READING, "MULTIPLE_CHOICE");
        authenticateAs(fixture.studentUser().getId(), "ROLE_STUDENT");
        Integer submissionId = studentExamService.startExam(fixture.exam().getId()).getId();

        List<Result<Integer>> results = runConcurrently(() -> {
            authenticateAs(fixture.studentUser().getId(), "ROLE_STUDENT");
            return answerService.saveOrUpdate(AnswerRequest.builder()
                    .submissionId(submissionId)
                    .questionId(fixture.question().getId())
                    .selectedOptionId(fixture.correctOptionId())
                    .build()).getId();
        });

        assertThat(results).allMatch(Result::success);
        Submission submission = submissionRepository.findById(submissionId).orElseThrow();
        List<Answer> answers = answerRepository.findBySubmission(submission).stream()
                .filter(answer -> fixture.question().getId().equals(answer.getQuestion().getId()))
                .toList();
        assertThat(answers).hasSize(1);
        assertThat(new HashSet<>(results.stream().map(Result::value).toList())).containsExactly(answers.getFirst().getId());
    }

    @Test
    void concurrentSubmitExamHasOneSuccessAndNoServerErrors() throws Exception {
        Fixture fixture = createFixture(ExamSectionType.READING, "MULTIPLE_CHOICE");
        authenticateAs(fixture.studentUser().getId(), "ROLE_STUDENT");
        Integer submissionId = studentExamService.startExam(fixture.exam().getId()).getId();
        answerService.saveOrUpdate(AnswerRequest.builder()
                .submissionId(submissionId)
                .questionId(fixture.question().getId())
                .selectedOptionId(fixture.correctOptionId())
                .build());

        List<Result<String>> results = runConcurrently(() -> {
            authenticateAs(fixture.studentUser().getId(), "ROLE_STUDENT");
            return studentExamService.submitExam(submissionId).getStatus();
        });

        assertThat(results.stream().filter(Result::success)).hasSize(1);
        assertThat(results.stream().filter(result -> !result.success())
                .allMatch(result -> result.error() instanceof BadRequestException)).isTrue();
        assertThat(submissionRepository.findById(submissionId).orElseThrow().getStatus())
                .isEqualTo(SubmissionStatus.SUBMITTED);
    }

    @Test
    void concurrentSpeakingUploadKeepsSingleAnswerRow() throws Exception {
        Fixture fixture = createFixture(ExamSectionType.SPEAKING, "SPEAKING");
        authenticateAs(fixture.studentUser().getId(), "ROLE_STUDENT");
        Integer submissionId = studentExamService.startExam(fixture.exam().getId()).getId();
        ReflectionTestUtils.setField(speakingUploadService, "uploadDir", uploadRoot.toString());
        when(ffmpegAudioService.probeDurationSeconds(any(Path.class))).thenReturn(12);

        List<Result<String>> results = runConcurrently(() -> {
            authenticateAs(fixture.studentUser().getId(), "ROLE_STUDENT");
            return speakingUploadService.upload(submissionId, fixture.question().getId(), webmFile()).getUrl();
        });

        assertThat(results).allMatch(Result::success);
        Submission submission = submissionRepository.findById(submissionId).orElseThrow();
        List<Answer> answers = answerRepository.findBySubmission(submission).stream()
                .filter(answer -> fixture.question().getId().equals(answer.getQuestion().getId()))
                .toList();
        assertThat(answers).hasSize(1);
        assertThat(answers.getFirst().getSpeakingAudioUrl()).startsWith("/uploads/audio/speaking/");
    }

    private <T> List<Result<T>> runConcurrently(Callable<T> task) throws Exception {
        ExecutorService executor = Executors.newFixedThreadPool(CONCURRENCY);
        CountDownLatch ready = new CountDownLatch(CONCURRENCY);
        CountDownLatch start = new CountDownLatch(1);
        List<Future<Result<T>>> futures = new ArrayList<>();
        for (int i = 0; i < CONCURRENCY; i++) {
            futures.add(executor.submit(() -> {
                ready.countDown();
                assertThat(start.await(5, TimeUnit.SECONDS)).isTrue();
                try {
                    return Result.ok(task.call());
                } catch (Throwable ex) {
                    return Result.failed(ex);
                } finally {
                    SecurityContextHolder.clearContext();
                }
            }));
        }
        assertThat(ready.await(5, TimeUnit.SECONDS)).isTrue();
        start.countDown();
        List<Result<T>> results = new ArrayList<>();
        for (Future<Result<T>> future : futures) {
            results.add(future.get(20, TimeUnit.SECONDS));
        }
        executor.shutdownNow();
        return results;
    }

    private Fixture createFixture(ExamSectionType sectionType, String questionType) {
        Role teacherRole = roleRepository.findByName("TEACHER").orElseThrow();
        Role studentRole = roleRepository.findByName("STUDENT").orElseThrow();
        String suffix = UUID.randomUUID().toString().substring(0, 8);

        User teacherUser = userRepository.save(User.builder()
                .username("conc-t-" + suffix)
                .email("conc-t-" + suffix + "@example.com")
                .password("hashed")
                .fullName("Concurrency Teacher")
                .role(teacherRole)
                .status("ACTIVE")
                .build());
        User studentUser = userRepository.save(User.builder()
                .username("conc-s-" + suffix)
                .email("conc-s-" + suffix + "@example.com")
                .password("hashed")
                .fullName("Concurrency Student")
                .role(studentRole)
                .status("ACTIVE")
                .build());

        Teacher teacher = teacherRepository.save(Teacher.builder()
                .user(teacherUser)
                .teacherCode("CT-" + suffix)
                .department("English")
                .build());
        Student student = studentRepository.save(Student.builder()
                .user(studentUser)
                .studentCode("CS-" + suffix)
                .build());

        Exam exam = examRepository.save(Exam.builder()
                .title("Concurrency Exam " + suffix)
                .teacher(teacher)
                .durationMinutes(60)
                .status("ACTIVE")
                .build());
        ExamSection section = examSectionRepository.save(ExamSection.builder()
                .exam(exam)
                .name(sectionType.name())
                .sectionType(sectionType)
                .orderIndex(1)
                .build());
        exam.getSections().add(section);

        Question question = Question.builder()
                .section(section)
                .questionText("Concurrency question")
                .questionType(questionType)
                .points(1)
                .build();
        if ("SPEAKING".equals(questionType)) {
            question = questionRepository.save(question);
            section.getQuestions().add(question);
            return new Fixture(exam, studentUser, student, question, null);
        }

        question = questionRepository.save(question);
        section.getQuestions().add(question);
        QuestionOption correct = QuestionOption.builder()
                .question(question)
                .optionText("Correct")
                .isCorrect(true)
                .build();
        QuestionOption wrong = QuestionOption.builder()
                .question(question)
                .optionText("Wrong")
                .isCorrect(false)
                .build();
        question.getOptions().add(correct);
        question.getOptions().add(wrong);
        question = questionRepository.save(question);
        Integer correctId = question.getOptions().stream()
                .filter(QuestionOption::getIsCorrect)
                .findFirst()
                .orElseThrow()
                .getId();
        return new Fixture(exam, studentUser, student, question, correctId);
    }

    private MockMultipartFile webmFile() {
        byte[] bytes = new byte[32];
        bytes[0] = 0x1A;
        bytes[1] = 0x45;
        bytes[2] = (byte) 0xDF;
        bytes[3] = (byte) 0xA3;
        return new MockMultipartFile("file", "recording.webm", "audio/webm;codecs=opus", bytes);
    }

    private void authenticateAs(Integer userId, String authority) {
        TestingAuthenticationToken authentication =
                new TestingAuthenticationToken(String.valueOf(userId), null, authority);
        authentication.setAuthenticated(true);
        SecurityContextHolder.getContext().setAuthentication(authentication);
    }

    private record Fixture(Exam exam, User studentUser, Student student, Question question, Integer correctOptionId) {
    }

    private record Result<T>(boolean success, T value, Throwable error) {
        static <T> Result<T> ok(T value) {
            return new Result<>(true, value, null);
        }

        static <T> Result<T> failed(Throwable error) {
            return new Result<>(false, null, error);
        }
    }
}
