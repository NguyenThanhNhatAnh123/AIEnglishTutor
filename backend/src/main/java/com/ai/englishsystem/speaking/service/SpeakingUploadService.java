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
import com.ai.englishsystem.submission.entity.Submission;
import com.ai.englishsystem.submission.entity.SubmissionStatus;
import com.ai.englishsystem.submission.repository.SubmissionRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
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
            "audio/ogg",
            "application/octet-stream"
    );

    private final SubmissionRepository submissionRepository;
    private final QuestionRepository questionRepository;
    private final StudentRepository studentRepository;
    private final StudentExamService studentExamService;
    private final FfmpegAudioService ffmpegAudioService;

    @Value("${app.upload.dir:uploads}")
    private String uploadDir;

    public SpeakingUploadResponse upload(Integer submissionId, Integer questionId, MultipartFile file) {
        if (file == null || file.isEmpty()) {
            throw new BadRequestException("File is empty");
        }
        if (file.getSize() > MAX_BYTES) {
            throw new BadRequestException("Audio must be 5 MB or smaller");
        }

        String contentType = file.getContentType();
        if (contentType == null || !ALLOWED_DECLARED_TYPES.contains(contentType.toLowerCase(Locale.ROOT))) {
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
        if (submission.getStatus() != SubmissionStatus.IN_PROGRESS) {
            throw new BadRequestException("Submission is not in progress");
        }
        studentExamService.assertWithinDeadline(submission);

        Question question = questionRepository.findById(questionId)
                .orElseThrow(() -> new NotFoundException("Question", questionId));

        if (!questionBelongsToExam(question, submission)) {
            throw new BadRequestException("Question does not belong to this exam");
        }

        Path dir = Paths.get(uploadDir).toAbsolutePath().normalize().resolve("audio").resolve("speaking");
        String unique = UUID.randomUUID().toString().replace("-", "");
        Path raw = dir.resolve(unique + "_raw.bin");

        try {
            Files.createDirectories(dir);
            file.transferTo(raw.toFile());
            AudioMagicValidator.assertRecognized(raw);
            byte[] head = AudioMagicValidator.readHead(raw, 32);
            DetectedAudioFormat magic = AudioMagicValidator.detectFormat(head);
            assertDeclaredMimeMatchesMagic(contentType, magic);

            Path outMp3 = dir.resolve(unique + "_" + student.getId() + "_" + questionId + ".mp3").normalize();
            if (!outMp3.startsWith(dir)) {
                throw new BadRequestException("Invalid path");
            }

            ffmpegAudioService.transcodeToMp3(raw, outMp3);
            Files.deleteIfExists(raw);

            int duration = ffmpegAudioService.probeDurationSeconds(outMp3);
            String url = "/uploads/audio/speaking/" + outMp3.getFileName();
            log.info("Speaking audio stored as mp3: {}", url);
            return SpeakingUploadResponse.builder()
                    .url(url)
                    .durationSeconds(duration)
                    .format("mp3")
                    .build();
        } catch (BadRequestException | ForbiddenException | NotFoundException e) {
            try {
                Files.deleteIfExists(raw);
            } catch (IOException ignored) {
                // ignore
            }
            throw e;
        } catch (Exception e) {
            try {
                Files.deleteIfExists(raw);
            } catch (IOException ignored) {
                // ignore
            }
            log.error("Speaking upload failed", e);
            throw new BadRequestException("Failed to process audio: " + e.getMessage());
        }
    }

    private static void assertDeclaredMimeMatchesMagic(String contentType, DetectedAudioFormat magic) {
        String ct = contentType.toLowerCase(Locale.ROOT);
        if ("application/octet-stream".equals(ct)) {
            return;
        }
        DetectedAudioFormat expected = switch (ct) {
            case "audio/webm", "video/webm" -> DetectedAudioFormat.WEBM;
            case "audio/wav", "audio/x-wav" -> DetectedAudioFormat.WAV;
            case "audio/mpeg", "audio/mp3" -> DetectedAudioFormat.MP3;
            case "audio/ogg" -> DetectedAudioFormat.OGG;
            default -> DetectedAudioFormat.UNKNOWN;
        };
        if (expected != DetectedAudioFormat.UNKNOWN && expected != magic) {
            throw new BadRequestException("File content does not match declared type (possible spoofing)");
        }
    }

    private static boolean questionBelongsToExam(Question question, Submission submission) {
        ExamSection section = question.getSection();
        return section != null
                && section.getExam() != null
                && section.getExam().getId().equals(submission.getExam().getId());
    }
}
