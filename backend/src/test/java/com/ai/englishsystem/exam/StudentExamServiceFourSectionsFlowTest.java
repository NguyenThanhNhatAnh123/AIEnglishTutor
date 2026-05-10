package com.ai.englishsystem.exam;

import com.ai.englishsystem.auth.entity.Role;
import com.ai.englishsystem.auth.repository.RoleRepository;
import com.ai.englishsystem.exam.entity.Exam;
import com.ai.englishsystem.exam.entity.ExamSection;
import com.ai.englishsystem.exam.entity.ExamSectionType;
import com.ai.englishsystem.exam.entity.Question;
import com.ai.englishsystem.exam.entity.QuestionOption;
import com.ai.englishsystem.exam.repository.ExamRepository;
import com.ai.englishsystem.exam.repository.ExamSectionRepository;
import com.ai.englishsystem.exam.repository.QuestionRepository;
import com.ai.englishsystem.exam.dto.student.StudentExamDetailResponse;
import com.ai.englishsystem.exam.service.StudentExamService;
import com.ai.englishsystem.student.entity.Student;
import com.ai.englishsystem.student.repository.StudentRepository;
import com.ai.englishsystem.submission.dto.AnswerRequest;
import com.ai.englishsystem.submission.entity.Submission;
import com.ai.englishsystem.submission.entity.SubmissionStatus;
import com.ai.englishsystem.submission.repository.SubmissionRepository;
import com.ai.englishsystem.submission.service.AnswerService;
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
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest
@ActiveProfiles("test")
@Transactional
class StudentExamServiceFourSectionsFlowTest {

    @Autowired
    private StudentExamService studentExamService;
    @Autowired
    private AnswerService answerService;
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

    @AfterEach
    void clearSecurity() {
        SecurityContextHolder.clearContext();
    }

    @Test
    void studentCanStartAnswerAndSubmitExamAcrossFourSections() {
        Fixture fixture = createFixture();
        authenticateAs(fixture.studentUser().getId(), "ROLE_STUDENT");

        var started = studentExamService.startExam(fixture.exam().getId());
        Integer submissionId = started.getId();

        answerService.saveOrUpdate(AnswerRequest.builder()
                .submissionId(submissionId)
                .questionId(fixture.readingQuestion().getId())
                .selectedOptionId(fixture.readingCorrectOptionId())
                .build());

        answerService.saveOrUpdate(AnswerRequest.builder()
                .submissionId(submissionId)
                .questionId(fixture.listeningQuestion().getId())
                .selectedOptionId(fixture.listeningCorrectOptionId())
                .build());

        answerService.saveOrUpdate(AnswerRequest.builder()
                .submissionId(submissionId)
                .questionId(fixture.writingQuestion().getId())
                .answerText("This is a valid writing answer with enough content for submission checks.")
                .build());

        answerService.saveOrUpdate(AnswerRequest.builder()
                .submissionId(submissionId)
                .questionId(fixture.speakingQuestion().getId())
                .speakingAudioUrl("/uploads/audio/speaking/four-sections.mp3")
                .speakingDurationSeconds(45)
                .speakingFormat("mp3")
                .build());

        var submitted = studentExamService.submitExam(submissionId);

        assertThat(submitted.getStatus()).isEqualTo(SubmissionStatus.SUBMITTED.name());
        assertThat(submitted.getMcScore()).isEqualTo(100f);
        assertThat(submitted.getWritingScore()).isNull();
        assertThat(submitted.getSpeakingScore()).isNull();
        assertThat(submitted.getTotalScore()).isEqualTo(100f);

        Submission persisted = submissionRepository.findWithAssociationsById(submissionId).orElseThrow();
        assertThat(persisted.getCompletionPercent()).isEqualTo(100);
        assertThat(persisted.getAnsweredQuestions()).isEqualTo(4);
        assertThat(persisted.getTotalQuestions()).isEqualTo(4);
    }

    @Test
    void listeningTranscriptIsNotExposedToStudentExamPayload() {
        Fixture fixture = createFixture();
        authenticateAs(fixture.studentUser().getId(), "ROLE_STUDENT");

        StudentExamDetailResponse detail = studentExamService.getExamForStudent(fixture.exam().getId());

        var listeningQuestion = detail.getSections().stream()
                .filter(section -> "LISTENING".equals(section.getSectionType()))
                .flatMap(section -> section.getQuestions().stream())
                .findFirst()
                .orElseThrow();

        assertThat(listeningQuestion.getTranscript()).isNull();
    }

    private Fixture createFixture() {
        Role teacherRole = roleRepository.findByName("TEACHER").orElseThrow();
        Role studentRole = roleRepository.findByName("STUDENT").orElseThrow();
        String suffix = UUID.randomUUID().toString().substring(0, 8);

        User teacherUser = userRepository.save(User.builder()
                .username("four-t-" + suffix)
                .email("four-t-" + suffix + "@example.com")
                .password("hashed")
                .fullName("Four Sections Teacher")
                .role(teacherRole)
                .status("ACTIVE")
                .build());
        User studentUser = userRepository.save(User.builder()
                .username("four-s-" + suffix)
                .email("four-s-" + suffix + "@example.com")
                .password("hashed")
                .fullName("Four Sections Student")
                .role(studentRole)
                .status("ACTIVE")
                .build());

        Teacher teacher = teacherRepository.save(Teacher.builder()
                .user(teacherUser)
                .teacherCode("F4T-" + suffix)
                .department("English")
                .build());
        studentRepository.save(Student.builder()
                .user(studentUser)
                .studentCode("F4S-" + suffix)
                .build());

        Exam exam = examRepository.save(Exam.builder()
                .title("Four Sections Exam " + suffix)
                .description("READING + LISTENING + WRITING + SPEAKING flow")
                .teacher(teacher)
                .durationMinutes(60)
                .status("ACTIVE")
                .build());

        ExamSection reading = examSectionRepository.save(ExamSection.builder()
                .exam(exam)
                .name("Reading")
                .sectionType(ExamSectionType.READING)
                .orderIndex(1)
                .build());
        ExamSection listening = examSectionRepository.save(ExamSection.builder()
                .exam(exam)
                .name("Listening")
                .sectionType(ExamSectionType.LISTENING)
                .orderIndex(2)
                .build());
        ExamSection writing = examSectionRepository.save(ExamSection.builder()
                .exam(exam)
                .name("Writing")
                .sectionType(ExamSectionType.WRITING)
                .orderIndex(3)
                .build());
        ExamSection speaking = examSectionRepository.save(ExamSection.builder()
                .exam(exam)
                .name("Speaking")
                .sectionType(ExamSectionType.SPEAKING)
                .orderIndex(4)
                .build());
        exam.getSections().add(reading);
        exam.getSections().add(listening);
        exam.getSections().add(writing);
        exam.getSections().add(speaking);

        Question readingQuestion = saveMcqQuestion(reading, "Reading: best title?");
        Question listeningQuestion = saveListeningQuestion(listening, "Listening: what is said?");
        Question writingQuestion = questionRepository.save(Question.builder()
                .section(writing)
                .questionText("Writing: describe your city")
                .questionType("WRITING")
                .points(5)
                .minWords(50)
                .maxWords(200)
                .build());
        Question speakingQuestion = questionRepository.save(Question.builder()
                .section(speaking)
                .questionText("Speaking: describe a memorable event")
                .questionType("SPEAKING")
                .points(5)
                .listeningAudioUrl("/uploads/audio/tts/speaking-prompt.mp3")
                .build());
        writing.getQuestions().add(writingQuestion);
        speaking.getQuestions().add(speakingQuestion);

        Integer readingCorrectOptionId = readingQuestion.getOptions().stream()
                .filter(QuestionOption::getIsCorrect)
                .findFirst()
                .orElseThrow()
                .getId();
        Integer listeningCorrectOptionId = listeningQuestion.getOptions().stream()
                .filter(QuestionOption::getIsCorrect)
                .findFirst()
                .orElseThrow()
                .getId();

        return new Fixture(
                exam,
                studentUser,
                readingQuestion,
                listeningQuestion,
                writingQuestion,
                speakingQuestion,
                readingCorrectOptionId,
                listeningCorrectOptionId
        );
    }

    private Question saveMcqQuestion(ExamSection section, String text) {
        Question question = Question.builder()
                .section(section)
                .questionText(text)
                .questionType("MULTIPLE_CHOICE")
                .points(1)
                .build();
        return saveWithTwoOptions(question);
    }

    private Question saveListeningQuestion(ExamSection section, String text) {
        Question question = Question.builder()
                .section(section)
                .questionText(text)
                .questionType("LISTENING")
                .points(1)
                .listeningAudioUrl("/uploads/audio/tts/listening-prompt.mp3")
                .transcript("Sensitive listening transcript should stay hidden from students.")
                .build();
        return saveWithTwoOptions(question);
    }

    private Question saveWithTwoOptions(Question question) {
        Question persisted = questionRepository.save(question);
        if (persisted.getSection() != null) {
            persisted.getSection().getQuestions().add(persisted);
        }
        List<QuestionOption> options = new ArrayList<>();
        options.add(QuestionOption.builder().question(persisted).optionText("Correct").isCorrect(true).build());
        options.add(QuestionOption.builder().question(persisted).optionText("Wrong").isCorrect(false).build());
        persisted.getOptions().clear();
        persisted.getOptions().addAll(options);
        return questionRepository.save(persisted);
    }

    private static void authenticateAs(Integer userId, String authority) {
        TestingAuthenticationToken authentication =
                new TestingAuthenticationToken(String.valueOf(userId), null, authority);
        authentication.setAuthenticated(true);
        SecurityContextHolder.getContext().setAuthentication(authentication);
    }

    private record Fixture(
            Exam exam,
            User studentUser,
            Question readingQuestion,
            Question listeningQuestion,
            Question writingQuestion,
            Question speakingQuestion,
            Integer readingCorrectOptionId,
            Integer listeningCorrectOptionId
    ) {
    }
}
