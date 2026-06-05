package com.ai.englishsystem.speaking.service;

import com.ai.englishsystem.common.exception.BadRequestException;
import com.ai.englishsystem.common.exception.ForbiddenException;
import com.ai.englishsystem.common.exception.NotFoundException;
import com.ai.englishsystem.common.util.SecurityUtils;
import com.ai.englishsystem.exam.entity.ExamSection;
import com.ai.englishsystem.exam.entity.Question;
import com.ai.englishsystem.exam.repository.QuestionRepository;
import com.ai.englishsystem.exam.service.StudentExamService;
import com.ai.englishsystem.media.audio.AudioMagicValidator;
import com.ai.englishsystem.media.audio.DetectedAudioFormat;
import com.ai.englishsystem.media.audio.FfmpegAudioService;
import com.ai.englishsystem.speaking.dto.SpeakingUploadResponse;
import com.ai.englishsystem.student.entity.Student;
import com.ai.englishsystem.student.repository.StudentRepository;
import com.ai.englishsystem.submission.entity.Answer;
import com.ai.englishsystem.submission.entity.AnswerType;
import com.ai.englishsystem.submission.entity.Submission;
import com.ai.englishsystem.submission.entity.SubmissionStatus;
import com.ai.englishsystem.submission.repository.AnswerRepository;
import com.ai.englishsystem.submission.repository.SubmissionRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.time.LocalDateTime;
import java.util.Locale;
import java.util.Set;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@Slf4j
public class SpeakingUploadService {

    private static final long MAX_BYTES = 5 * 1024 * 1024;

    private static final Set<String> ALLOWED_DECLARED_TYPES = Set.of(
            "audio/mpeg",
            "audio/mp3",
            "audio/wav",
            "audio/x-wav",
            "audio/webm",
            "video/webm",
            "audio/mp4",
            "audio/x-m4a",
            "audio/ogg",
            "application/octet-stream"
    );

    private final SubmissionRepository submissionRepository;
    private final QuestionRepository questionRepository;
    private final StudentRepository studentRepository;
    private final StudentExamService studentExamService;
    private final FfmpegAudioService ffmpegAudioService;
    private final AnswerRepository answerRepository;
    private final SpeakingFileStorage speakingFileStorage;
    private final TransactionTemplate transactionTemplate;

    @Value("${app.upload.dir:uploads}")
    private String uploadDir;

    @Value("${app.speaking.upload-grace-seconds:180}")
    private int uploadGraceSeconds;

    public SpeakingUploadResponse upload(Integer submissionId, Integer questionId, MultipartFile file) {
        if (file == null || file.isEmpty()) {
            throw new BadRequestException("File is empty");
        }
        if (file.getSize() > MAX_BYTES) {
            throw new BadRequestException("Audio must be 5 MB or smaller");
        }

        String contentType = normalizeContentType(file.getContentType());
        if (contentType == null || !ALLOWED_DECLARED_TYPES.contains(contentType)) {
            throw new BadRequestException("Unsupported Content-Type for audio upload");
        }

        Integer userId = SecurityUtils.getCurrentUserId();
        Student student = studentRepository.findByUser_Id(userId)
                .orElseThrow(() -> new ForbiddenException("Student profile not found for current user"));

        Submission submission = submissionRepository.findWithAssociationsById(submissionId)
                .orElseThrow(() -> new NotFoundException("Submission", submissionId));

        if (!submission.getStudent().getId().equals(student.getId())) {
            throw new ForbiddenException("Cannot upload for another student's submission");
        }
        studentExamService.assertStudentCanAccessExam(student, submission.getExam().getId());
        if (submission.getStatus() != SubmissionStatus.IN_PROGRESS) {
            throw new BadRequestException("Submission is not in progress");
        }
        assertWithinUploadWindow(submission);

        Question question = questionRepository.findByIdWithSectionExam(questionId)
                .orElseThrow(() -> new NotFoundException("Question", questionId));

        if (!questionBelongsToExam(question, submission)) {
            throw new BadRequestException("Question does not belong to this exam");
        }
        if (!"SPEAKING".equals(normalizeQuestionType(question.getQuestionType()))) {
            throw new BadRequestException("Audio uploads are only allowed for speaking questions");
        }

        Path dir = Paths.get(uploadDir).toAbsolutePath().normalize().resolve("audio").resolve("speaking");
        String unique = UUID.randomUUID().toString().replace("-", "");
        Path raw = dir.resolve(unique + "_raw.bin");
        Path outMp3 = null;

        try {
            Files.createDirectories(dir);
            file.transferTo(raw.toFile());
            AudioMagicValidator.assertRecognized(raw);
            byte[] head = AudioMagicValidator.readHead(raw, 32);
            DetectedAudioFormat magic = AudioMagicValidator.detectFormat(head);
            assertDeclaredMimeMatchesMagic(contentType, magic);

            outMp3 = dir.resolve(unique + "_" + student.getId() + "_" + questionId + ".mp3").normalize();
            if (!outMp3.startsWith(dir)) {
                throw new BadRequestException("Invalid path");
            }

            ffmpegAudioService.transcodeToMp3(raw, outMp3);
            Files.deleteIfExists(raw);

            int duration = ffmpegAudioService.probeDurationSeconds(outMp3);
            String url = "/uploads/audio/speaking/" + outMp3.getFileName();
            String previousUrl = transactionTemplate.execute(status -> persistSpeakingAnswer(submission, question, url, duration));
            if (previousUrl != null && !previousUrl.equals(url)) {
                speakingFileStorage.deleteIfExists(previousUrl);
            }
            log.info("Speaking audio stored as mp3: {}", url);
            return SpeakingUploadResponse.builder()
                    .url(url)
                    .durationSeconds(duration)
                    .format("mp3")
                    .build();
        } catch (BadRequestException | ForbiddenException | NotFoundException e) {
            try {
                Files.deleteIfExists(raw);
                if (outMp3 != null) {
                    Files.deleteIfExists(outMp3);
                }
            } catch (IOException ignored) {
                // ignore
            }
            throw e;
        } catch (Exception e) {
            try {
                Files.deleteIfExists(raw);
                if (outMp3 != null) {
                    Files.deleteIfExists(outMp3);
                }
            } catch (IOException ignored) {
                // ignore
            }
            log.error("Speaking upload failed", e);
            throw new BadRequestException("Failed to process audio: " + e.getMessage());
        }
    }

    private String persistSpeakingAnswer(Submission submission, Question question, String url, int duration) {
        Submission lockedSubmission = submissionRepository.findWithAssociationsByIdForUpdate(submission.getId())
                .orElseThrow(() -> new NotFoundException("Submission", submission.getId()));
        if (lockedSubmission.getStatus() != SubmissionStatus.IN_PROGRESS) {
            throw new BadRequestException("Submission is not in progress");
        }
        assertWithinUploadWindow(lockedSubmission);
        if (!questionBelongsToExam(question, lockedSubmission)) {
            throw new BadRequestException("Question does not belong to this exam");
        }
        Answer answer = answerRepository.findBySubmissionAndQuestion(lockedSubmission, question)
                .orElseGet(() -> Answer.builder()
                        .submission(lockedSubmission)
                        .question(question)
                        .build());
        String previousUrl = answer.getSpeakingAudioUrl();
        answer.setAnswerType(AnswerType.AUDIO);
        answer.setSpeakingAudioUrl(url);
        answer.setSpeakingDurationSeconds(duration);
        answer.setSpeakingFormat("mp3");
        answerRepository.save(answer);
        return previousUrl;
    }

    private void assertWithinUploadWindow(Submission submission) {
        LocalDateTime deadline = studentExamService.resolveDeadline(submission);
        int graceSeconds = Math.max(0, uploadGraceSeconds);
        if (LocalDateTime.now().isAfter(deadline.plusSeconds(graceSeconds))) {
            throw new BadRequestException("Exam time has expired");
        }
    }

    private static void assertDeclaredMimeMatchesMagic(String contentType, DetectedAudioFormat magic) {
        String ct = normalizeContentType(contentType);
        if (ct == null) {
            throw new BadRequestException("Unsupported Content-Type for audio upload");
        }
        if ("application/octet-stream".equals(ct)) {
            return;
        }
        DetectedAudioFormat expected = switch (ct) {
            case "audio/webm", "video/webm" -> DetectedAudioFormat.WEBM;
            case "audio/wav", "audio/x-wav" -> DetectedAudioFormat.WAV;
            case "audio/mpeg", "audio/mp3" -> DetectedAudioFormat.MP3;
            case "audio/mp4", "audio/x-m4a" -> DetectedAudioFormat.MP4;
            case "audio/ogg" -> DetectedAudioFormat.OGG;
            default -> DetectedAudioFormat.UNKNOWN;
        };
        if (expected != DetectedAudioFormat.UNKNOWN && expected != magic) {
            throw new BadRequestException("File content does not match declared type (possible spoofing)");
        }
    }

    private static String normalizeContentType(String contentType) {
        if (contentType == null || contentType.isBlank()) {
            return null;
        }
        return contentType.split(";", 2)[0].trim().toLowerCase(Locale.ROOT);
    }

    private static String normalizeQuestionType(String questionType) {
        return questionType == null ? "" : questionType.trim().toUpperCase(Locale.ROOT);
    }

    private static boolean questionBelongsToExam(Question question, Submission submission) {
        ExamSection section = question.getSection();
        return section != null
                && section.getExam() != null
                && section.getExam().getId().equals(submission.getExam().getId());
    }
}
