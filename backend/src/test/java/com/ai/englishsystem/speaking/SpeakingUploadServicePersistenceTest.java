package com.ai.englishsystem.speaking;

import com.ai.englishsystem.auth.entity.Role;
import com.ai.englishsystem.auth.repository.RoleRepository;
import com.ai.englishsystem.exam.entity.Exam;
import com.ai.englishsystem.exam.entity.ExamSection;
import com.ai.englishsystem.exam.entity.ExamSectionType;
import com.ai.englishsystem.exam.entity.Question;
import com.ai.englishsystem.exam.repository.ExamRepository;
import com.ai.englishsystem.exam.repository.ExamSectionRepository;
import com.ai.englishsystem.exam.repository.QuestionRepository;
import com.ai.englishsystem.media.audio.FfmpegAudioService;
import com.ai.englishsystem.speaking.service.SpeakingUploadService;
import com.ai.englishsystem.student.entity.Student;
import com.ai.englishsystem.student.repository.StudentRepository;
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
import org.junit.jupiter.api.io.TempDir;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.security.authentication.TestingAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.transaction.annotation.Transactional;

import java.nio.file.Path;
import java.time.LocalDateTime;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

@SpringBootTest
@ActiveProfiles("test")
@Transactional
class SpeakingUploadServicePersistenceTest {

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
    void uploadPersistsSpeakingUrlOnAnswer() {
        TestFixture fixture = createFixture();
        authenticateAs(fixture.studentUser().getId(), "ROLE_STUDENT");
        ReflectionTestUtils.setField(speakingUploadService, "uploadDir", uploadRoot.toString());
        when(ffmpegAudioService.probeDurationSeconds(any(Path.class))).thenReturn(12);

        var response = speakingUploadService.upload(
                fixture.submission().getId(),
                fixture.question().getId(),
                webmFile()
        );

        var answer = answerRepository.findBySubmissionAndQuestion(fixture.submission(), fixture.question())
                .orElseThrow();
        assertThat(response.getUrl()).startsWith("/uploads/audio/speaking/");
        assertThat(answer.getSpeakingAudioUrl()).isEqualTo(response.getUrl());
        assertThat(answer.getSpeakingDurationSeconds()).isEqualTo(12);
        assertThat(answer.getSpeakingFormat()).isEqualTo("mp3");
    }

    private MockMultipartFile webmFile() {
        byte[] bytes = new byte[32];
        bytes[0] = 0x1A;
        bytes[1] = 0x45;
        bytes[2] = (byte) 0xDF;
        bytes[3] = (byte) 0xA3;
        return new MockMultipartFile(
                "file",
                "recording.webm",
                "audio/webm;codecs=opus",
                bytes
        );
    }

    private TestFixture createFixture() {
        Role teacherRole = roleRepository.findByName("TEACHER").orElseThrow();
        Role studentRole = roleRepository.findByName("STUDENT").orElseThrow();
        String suffix = UUID.randomUUID().toString().substring(0, 8);

        User teacherUser = userRepository.save(User.builder()
                .username("upload-owner-" + suffix)
                .email("upload-owner-" + suffix + "@example.com")
                .password("hashed")
                .fullName("Upload Owner Teacher")
                .role(teacherRole)
                .status("ACTIVE")
                .build());

        User studentUser = userRepository.save(User.builder()
                .username("upload-student-" + suffix)
                .email("upload-student-" + suffix + "@example.com")
                .password("hashed")
                .fullName("Upload Student")
                .role(studentRole)
                .status("ACTIVE")
                .build());

        Teacher teacher = teacherRepository.save(Teacher.builder()
                .user(teacherUser)
                .teacherCode("UPT-" + suffix)
                .department("English")
                .build());

        Student student = studentRepository.save(Student.builder()
                .user(studentUser)
                .studentCode("UPS-" + suffix)
                .build());

        Exam exam = examRepository.save(Exam.builder()
                .title("Speaking Upload Exam " + suffix)
                .description("Upload persistence test")
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
                .questionText("Describe your favorite place.")
                .questionType("SPEAKING")
                .points(10)
                .build());

        Submission submission = submissionRepository.save(Submission.builder()
                .exam(exam)
                .student(student)
                .startTime(LocalDateTime.now().minusMinutes(5))
                .status(SubmissionStatus.IN_PROGRESS)
                .build());

        return new TestFixture(studentUser, submission, question);
    }

    private void authenticateAs(Integer userId, String authority) {
        TestingAuthenticationToken authentication =
                new TestingAuthenticationToken(String.valueOf(userId), null, authority);
        authentication.setAuthenticated(true);
        SecurityContextHolder.getContext().setAuthentication(authentication);
    }

    private record TestFixture(User studentUser, Submission submission, Question question) {
    }
}
