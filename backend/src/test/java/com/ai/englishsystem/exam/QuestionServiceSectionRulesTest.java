package com.ai.englishsystem.exam;

import com.ai.englishsystem.auth.entity.Role;
import com.ai.englishsystem.auth.repository.RoleRepository;
import com.ai.englishsystem.common.exception.BadRequestException;
import com.ai.englishsystem.exam.dto.QuestionOptionRequest;
import com.ai.englishsystem.exam.dto.QuestionRequest;
import com.ai.englishsystem.exam.entity.Exam;
import com.ai.englishsystem.exam.entity.ExamSection;
import com.ai.englishsystem.exam.entity.ExamSectionType;
import com.ai.englishsystem.exam.repository.ExamRepository;
import com.ai.englishsystem.exam.repository.ExamSectionRepository;
import com.ai.englishsystem.exam.service.QuestionService;
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

import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

@SpringBootTest
@ActiveProfiles("test")
@Transactional
class QuestionServiceSectionRulesTest {

    @Autowired
    private QuestionService questionService;
    @Autowired
    private RoleRepository roleRepository;
    @Autowired
    private UserRepository userRepository;
    @Autowired
    private TeacherRepository teacherRepository;
    @Autowired
    private ExamRepository examRepository;
    @Autowired
    private ExamSectionRepository examSectionRepository;

    @AfterEach
    void clearSecurity() {
        SecurityContextHolder.clearContext();
    }

    @Test
    void teacherCanCreateQuestionForEachSectionTypeWithCorrectShape() {
        Fixture fixture = createFixture();
        authenticateAs(fixture.teacherUser().getId(), "ROLE_TEACHER");

        var reading = questionService.create(QuestionRequest.builder()
                .sectionId(fixture.reading().getId())
                .questionText("Reading: choose best title")
                .questionType("MULTIPLE_CHOICE")
                .points(2)
                .options(List.of(
                        opt("Title A", false),
                        opt("Title B", true),
                        opt("Title C", false)
                ))
                .build());
        assertThat(reading.getQuestionType()).isEqualTo("MULTIPLE_CHOICE");

        var listening = questionService.create(QuestionRequest.builder()
                .sectionId(fixture.listening().getId())
                .questionText("Listening: what did the speaker buy?")
                .questionType("LISTENING")
                .points(2)
                .listeningAudioUrl("/uploads/audio/tts/sample-listening.mp3")
                .options(List.of(
                        opt("A book", true),
                        opt("A hat", false)
                ))
                .build());
        assertThat(listening.getQuestionType()).isEqualTo("LISTENING");

        var writing = questionService.create(QuestionRequest.builder()
                .sectionId(fixture.writing().getId())
                .questionText("Writing: describe your hometown")
                .questionType("WRITING")
                .points(5)
                .minWords(80)
                .maxWords(180)
                .build());
        assertThat(writing.getQuestionType()).isEqualTo("WRITING");

        var speaking = questionService.create(QuestionRequest.builder()
                .sectionId(fixture.speaking().getId())
                .questionText("Speaking: describe a challenge")
                .questionType("SPEAKING")
                .points(5)
                .listeningAudioUrl("/uploads/audio/tts/sample-speaking.mp3")
                .build());
        assertThat(speaking.getQuestionType()).isEqualTo("SPEAKING");
    }

    @Test
    void rejectsQuestionTypeThatDoesNotMatchSection() {
        Fixture fixture = createFixture();
        authenticateAs(fixture.teacherUser().getId(), "ROLE_TEACHER");

        assertThatThrownBy(() -> questionService.create(QuestionRequest.builder()
                .sectionId(fixture.writing().getId())
                .questionText("Wrong type in writing section")
                .questionType("LISTENING")
                .listeningAudioUrl("/uploads/audio/tts/wrong.mp3")
                .options(List.of(
                        opt("A", true),
                        opt("B", false)
                ))
                .build()))
                .isInstanceOf(BadRequestException.class)
                .hasMessageContaining("WRITING sections only support WRITING questions");
    }

    @Test
    void rejectsListeningQuestionWithoutAudio() {
        Fixture fixture = createFixture();
        authenticateAs(fixture.teacherUser().getId(), "ROLE_TEACHER");

        assertThatThrownBy(() -> questionService.create(QuestionRequest.builder()
                .sectionId(fixture.listening().getId())
                .questionText("Listening question without audio")
                .questionType("LISTENING")
                .options(List.of(
                        opt("A", true),
                        opt("B", false)
                ))
                .build()))
                .isInstanceOf(BadRequestException.class)
                .hasMessageContaining("Listening questions require an uploaded audio URL");
    }

    private Fixture createFixture() {
        Role teacherRole = roleRepository.findByName("TEACHER").orElseThrow();
        String suffix = UUID.randomUUID().toString().substring(0, 8);

        User teacherUser = userRepository.save(User.builder()
                .username("qsr-teacher-" + suffix)
                .email("qsr-teacher-" + suffix + "@example.com")
                .password("hashed")
                .fullName("Question Rules Teacher")
                .role(teacherRole)
                .status("ACTIVE")
                .build());

        Teacher teacher = teacherRepository.save(Teacher.builder()
                .user(teacherUser)
                .teacherCode("QSR-" + suffix)
                .department("English")
                .build());

        Exam exam = examRepository.save(Exam.builder()
                .title("Question Rules Exam " + suffix)
                .description("Question section validation")
                .teacher(teacher)
                .durationMinutes(60)
                .status("ACTIVE")
                .build());

        ExamSection reading = examSectionRepository.save(ExamSection.builder()
                .exam(exam)
                .name("Reading Section")
                .sectionType(ExamSectionType.READING)
                .orderIndex(1)
                .build());
        ExamSection listening = examSectionRepository.save(ExamSection.builder()
                .exam(exam)
                .name("Listening Section")
                .sectionType(ExamSectionType.LISTENING)
                .orderIndex(2)
                .build());
        ExamSection writing = examSectionRepository.save(ExamSection.builder()
                .exam(exam)
                .name("Writing Section")
                .sectionType(ExamSectionType.WRITING)
                .orderIndex(3)
                .build());
        ExamSection speaking = examSectionRepository.save(ExamSection.builder()
                .exam(exam)
                .name("Speaking Section")
                .sectionType(ExamSectionType.SPEAKING)
                .orderIndex(4)
                .build());

        return new Fixture(teacherUser, reading, listening, writing, speaking);
    }

    private static QuestionOptionRequest opt(String text, boolean isCorrect) {
        return QuestionOptionRequest.builder()
                .optionText(text)
                .isCorrect(isCorrect)
                .build();
    }

    private static void authenticateAs(Integer userId, String authority) {
        TestingAuthenticationToken authentication =
                new TestingAuthenticationToken(String.valueOf(userId), null, authority);
        authentication.setAuthenticated(true);
        SecurityContextHolder.getContext().setAuthentication(authentication);
    }

    private record Fixture(
            User teacherUser,
            ExamSection reading,
            ExamSection listening,
            ExamSection writing,
            ExamSection speaking
    ) {
    }
}
