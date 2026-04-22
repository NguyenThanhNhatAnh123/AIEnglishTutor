package com.ai.englishsystem.speaking.service;

import com.ai.englishsystem.common.exception.BadRequestException;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;

/**
 * Resolves and deletes speaking files under {@code {uploadDir}/audio/speaking/}.
 */
@Service
@Slf4j
public class SpeakingFileStorage {

    @Value("${app.upload.dir:uploads}")
    private String uploadDir;

    public Path resolveFromPublicUrl(String publicUrl) {
        if (publicUrl == null || publicUrl.isBlank()) {
            return null;
        }
        String prefix = "/uploads/audio/speaking/";
        if (!publicUrl.startsWith(prefix)) {
            return null;
        }
        String filename = publicUrl.substring(prefix.length());
        if (filename.contains("..") || filename.contains("/") || filename.contains("\\")) {
            throw new BadRequestException("Invalid speaking file path");
        }
        Path base = Paths.get(uploadDir).toAbsolutePath().normalize().resolve("audio").resolve("speaking");
        Path file = base.resolve(filename).normalize();
        if (!file.startsWith(base)) {
            throw new BadRequestException("Invalid speaking file path");
        }
        return file;
    }

    public void deleteIfExists(String publicUrl) {
        Path p = resolveFromPublicUrl(publicUrl);
        if (p == null) {
            return;
        }
        try {
            if (Files.deleteIfExists(p)) {
                log.info("Deleted speaking file {}", p);
            }
        } catch (IOException e) {
            log.warn("Could not delete speaking file {}: {}", p, e.getMessage());
        }
    }
}
