package com.ai.englishsystem.media.service;

import com.ai.englishsystem.common.exception.BadRequestException;
import com.ai.englishsystem.common.util.SecurityUtils;
import com.ai.englishsystem.media.audio.AudioMagicValidator;
import com.ai.englishsystem.media.audio.DetectedAudioFormat;
import com.ai.englishsystem.media.entity.MediaFile;
import com.ai.englishsystem.media.repository.MediaFileRepository;
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
public class MediaService {

    private final MediaFileRepository mediaFileRepository;

    @Value("${app.upload.dir:uploads}")
    private String uploadDir;

    private static final Set<String> ALLOWED_AUDIO_TYPES = Set.of(
            "audio/webm", "audio/ogg", "audio/mpeg", "audio/mp3",
            "audio/wav", "audio/mp4", "audio/x-m4a"
    );

    private static final long MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

    /**
     * Saves an uploaded file to disk and records metadata in the database.
     * Returns the public URL for accessing the file.
     */
    public String uploadAudio(MultipartFile file) {
        if (file == null || file.isEmpty()) {
            throw new BadRequestException("File is empty");
        }
        if (file.getSize() > MAX_FILE_SIZE) {
            throw new BadRequestException("File exceeds 10 MB limit");
        }

        String contentType = normalizeContentType(file.getContentType());
        if (contentType == null || !ALLOWED_AUDIO_TYPES.contains(contentType)) {
            throw new BadRequestException("Invalid audio file type: " + contentType);
        }

        Path target = null;
        try {
            Path uploadPath = Paths.get(uploadDir).toAbsolutePath().normalize();
            Path listeningDir = uploadPath.resolve("audio").resolve("listening").normalize();
            if (!listeningDir.startsWith(uploadPath)) {
                throw new BadRequestException("Invalid upload directory");
            }
            Files.createDirectories(listeningDir);

            String ext = getExtension(contentType);
            String filename = UUID.randomUUID() + ext;
            target = listeningDir.resolve(filename).normalize();
            if (!target.startsWith(listeningDir)) {
                throw new BadRequestException("Invalid filename");
            }
            file.transferTo(target.toFile());
            validateAudioMagic(target, contentType);

            String url = "/uploads/audio/listening/" + filename;

            Integer userId = SecurityUtils.getCurrentUserIdOrNull();
            MediaFile mediaFile = MediaFile.builder()
                    .fileUrl(url)
                    .fileType(contentType)
                    .uploadedBy(userId)
                    .build();
            mediaFileRepository.save(mediaFile);

            log.info("Uploaded audio file: {} -> {}", file.getOriginalFilename(), url);
            return url;
        } catch (BadRequestException e) {
            deletePartialFile(target);
            throw e;
        } catch (IOException e) {
            deletePartialFile(target);
            log.error("Failed to upload file", e);
            throw new BadRequestException("Failed to save file: " + e.getMessage());
        }
    }

    /**
     * Resolves the absolute path for a stored file.
     */
    public Path resolveFile(String filename) {
        Path uploadPath = Paths.get(uploadDir).toAbsolutePath().normalize();
        Path filePath = uploadPath.resolve(filename).normalize();
        // Guard against path traversal (e.g. "../../etc/passwd")
        if (!filePath.startsWith(uploadPath)) {
            throw new BadRequestException("Invalid filename");
        }
        if (!Files.exists(filePath)) {
            throw new BadRequestException("File not found: " + filename);
        }
        return filePath;
    }

    private void validateAudioMagic(Path target, String contentType) throws IOException {
        AudioMagicValidator.assertRecognized(target);
        byte[] head = AudioMagicValidator.readHead(target, 32);
        DetectedAudioFormat detected = AudioMagicValidator.detectFormat(head);
        DetectedAudioFormat expected = switch (contentType) {
            case "audio/webm" -> DetectedAudioFormat.WEBM;
            case "audio/ogg" -> DetectedAudioFormat.OGG;
            case "audio/mpeg", "audio/mp3" -> DetectedAudioFormat.MP3;
            case "audio/wav" -> DetectedAudioFormat.WAV;
            case "audio/mp4", "audio/x-m4a" -> DetectedAudioFormat.MP4;
            default -> DetectedAudioFormat.UNKNOWN;
        };
        if (expected != DetectedAudioFormat.UNKNOWN && expected != detected) {
            throw new BadRequestException("Audio content does not match declared type");
        }
    }

    private void deletePartialFile(Path target) {
        if (target == null) {
            return;
        }
        try {
            Files.deleteIfExists(target);
        } catch (IOException ex) {
            log.warn("Could not delete rejected media file {}: {}", target, ex.getMessage());
        }
    }

    private String getExtension(String contentType) {
        return switch (contentType) {
            case "audio/webm" -> ".webm";
            case "audio/ogg" -> ".ogg";
            case "audio/mpeg", "audio/mp3" -> ".mp3";
            case "audio/wav" -> ".wav";
            case "audio/mp4", "audio/x-m4a" -> ".m4a";
            default -> ".bin";
        };
    }

    private String normalizeContentType(String contentType) {
        if (contentType == null || contentType.isBlank()) {
            return null;
        }
        return contentType.split(";", 2)[0].trim().toLowerCase(Locale.ROOT);
    }
}
