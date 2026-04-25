package com.ai.englishsystem.ai.service;

import com.ai.englishsystem.ai.dto.ImageOcrTtsResponse;
import com.ai.englishsystem.common.exception.BadRequestException;
import com.ai.englishsystem.media.audio.FfmpegAudioService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.TimeUnit;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class ImageOcrTtsService {

    private static final long MAX_IMAGE_BYTES = 10 * 1024 * 1024L;
    private static final Set<String> ALLOWED_IMAGE_MIME = Set.of(
            "image/png",
            "image/jpeg",
            "image/jpg",
            "image/webp"
    );
    private static final Pattern CHOICE_PREFIX = Pattern.compile("^(?:[A-Da-d][\\).]|\\d+[\\).]|[-*•])\\s+");

    private final FfmpegAudioService ffmpegAudioService;

    @Value("${app.upload.dir:uploads}")
    private String uploadDir;

    @Value("${app.ocr.tesseract.binary:tesseract}")
    private String tesseractBinary;

    @Value("${app.ocr.tesseract.lang:eng}")
    private String tesseractLang;

    @Value("${app.tts.espeak.binary:espeak}")
    private String espeakBinary;

    public ImageOcrTtsResponse processImage(MultipartFile file) {
        validateInput(file);
        String unique = UUID.randomUUID().toString().replace("-", "");

        Path imageDir = Paths.get(uploadDir).toAbsolutePath().normalize().resolve("audio").resolve("images");
        Path ttsDir = Paths.get(uploadDir).toAbsolutePath().normalize().resolve("audio").resolve("tts");
        Path imagePath = imageDir.resolve(unique + imageExt(file.getContentType())).normalize();
        Path wavPath = ttsDir.resolve(unique + ".wav").normalize();
        Path mp3Path = ttsDir.resolve(unique + ".mp3").normalize();

        ensureSafePath(imagePath, imageDir);
        ensureSafePath(wavPath, ttsDir);
        ensureSafePath(mp3Path, ttsDir);

        try {
            Files.createDirectories(imageDir);
            Files.createDirectories(ttsDir);
            file.transferTo(imagePath.toFile());
            assertValidImageMagic(imagePath, file.getContentType());

            String extractedText = normalizeWhitespace(runOcr(imagePath));
            if (extractedText.isBlank()) {
                throw new BadRequestException("OCR extracted empty text from image");
            }
            OcrParsed parsed = parseQuestionAndChoices(extractedText);

            runEspeak(parsed.questionText(), wavPath);
            ffmpegAudioService.transcodeToMp3(wavPath, mp3Path);

            String imageUrl = "/uploads/audio/images/" + imagePath.getFileName();
            String audioUrl = "/uploads/audio/tts/" + mp3Path.getFileName();

            log.info("Image OCR+TTS completed: image={}, audio={}", imageUrl, audioUrl);
            return ImageOcrTtsResponse.builder()
                    .imageUrl(imageUrl)
                    .extractedText(extractedText)
                    .questionText(parsed.questionText())
                    .choices(parsed.choices())
                    .audioUrl(audioUrl)
                    .build();
        } catch (BadRequestException e) {
            log.warn("Image OCR+TTS rejected: {}", e.getMessage());
            throw e;
        } catch (Exception e) {
            log.error("Image OCR+TTS failed", e);
            throw new BadRequestException("Image OCR/TTS processing failed: " + e.getMessage());
        } finally {
            try {
                Files.deleteIfExists(wavPath);
            } catch (IOException ignored) {
                // ignore cleanup errors
            }
        }
    }

    public String synthesizeTextToAudio(String text) {
        String cleanText = normalizeWhitespace(text);
        if (cleanText.isBlank()) {
            throw new BadRequestException("text cannot be blank");
        }
        String unique = UUID.randomUUID().toString().replace("-", "");
        Path ttsDir = Paths.get(uploadDir).toAbsolutePath().normalize().resolve("audio").resolve("tts");
        Path wavPath = ttsDir.resolve(unique + ".wav").normalize();
        Path mp3Path = ttsDir.resolve(unique + ".mp3").normalize();
        ensureSafePath(wavPath, ttsDir);
        ensureSafePath(mp3Path, ttsDir);
        try {
            Files.createDirectories(ttsDir);
            runEspeak(cleanText, wavPath);
            ffmpegAudioService.transcodeToMp3(wavPath, mp3Path);
            String audioUrl = "/uploads/audio/tts/" + mp3Path.getFileName();
            log.info("Generated TTS audio: {}", audioUrl);
            return audioUrl;
        } catch (BadRequestException e) {
            throw e;
        } catch (Exception e) {
            log.error("Text-to-speech failed", e);
            throw new BadRequestException("TTS processing failed: " + e.getMessage());
        } finally {
            try {
                Files.deleteIfExists(wavPath);
            } catch (IOException ignored) {
                // ignore cleanup errors
            }
        }
    }

    private void validateInput(MultipartFile file) {
        if (file == null || file.isEmpty()) {
            throw new BadRequestException("Image file is empty");
        }
        if (file.getSize() > MAX_IMAGE_BYTES) {
            throw new BadRequestException("Image must be 10 MB or smaller");
        }
        String contentType = file.getContentType();
        if (contentType == null || !ALLOWED_IMAGE_MIME.contains(contentType.toLowerCase(Locale.ROOT))) {
            throw new BadRequestException("Unsupported image Content-Type (allowed: png/jpg/jpeg/webp)");
        }
    }

    private static void ensureSafePath(Path target, Path parent) {
        if (!target.startsWith(parent)) {
            throw new BadRequestException("Invalid path");
        }
    }

    private static String imageExt(String contentType) {
        String ct = contentType == null ? "" : contentType.toLowerCase(Locale.ROOT);
        return switch (ct) {
            case "image/png" -> ".png";
            case "image/jpeg", "image/jpg" -> ".jpg";
            case "image/webp" -> ".webp";
            default -> ".img";
        };
    }

    private static void assertValidImageMagic(Path file, String contentType) {
        try {
            byte[] head = Files.readAllBytes(file);
            if (head.length < 12) {
                throw new BadRequestException("Image file is too small");
            }
            String ct = contentType == null ? "" : contentType.toLowerCase(Locale.ROOT);
            boolean ok = switch (ct) {
                case "image/png" -> isPng(head);
                case "image/jpeg", "image/jpg" -> isJpeg(head);
                case "image/webp" -> isWebp(head);
                default -> false;
            };
            if (!ok) {
                throw new BadRequestException("Image content does not match declared type");
            }
        } catch (IOException e) {
            throw new BadRequestException("Cannot read uploaded image: " + e.getMessage());
        }
    }

    private static boolean isPng(byte[] b) {
        return b.length > 8
                && (b[0] & 0xFF) == 0x89
                && b[1] == 0x50
                && b[2] == 0x4E
                && b[3] == 0x47
                && b[4] == 0x0D
                && b[5] == 0x0A
                && b[6] == 0x1A
                && b[7] == 0x0A;
    }

    private static boolean isJpeg(byte[] b) {
        return b.length > 4
                && (b[0] & 0xFF) == 0xFF
                && (b[1] & 0xFF) == 0xD8
                && (b[b.length - 2] & 0xFF) == 0xFF
                && (b[b.length - 1] & 0xFF) == 0xD9;
    }

    private static boolean isWebp(byte[] b) {
        return b.length > 12
                && b[0] == 'R' && b[1] == 'I' && b[2] == 'F' && b[3] == 'F'
                && b[8] == 'W' && b[9] == 'E' && b[10] == 'B' && b[11] == 'P';
    }

    private String runOcr(Path imagePath) {
        List<String> cmd = List.of(
                tesseractBinary,
                imagePath.toAbsolutePath().toString(),
                "stdout",
                "-l",
                tesseractLang
        );
        String stdout = runCommandCaptureStdout(cmd, "OCR");
        if (stdout == null || stdout.isBlank()) {
            throw new BadRequestException("OCR returned empty result. Check image quality or OCR language.");
        }
        return stdout;
    }

    private void runEspeak(String text, Path wavPath) {
        List<String> cmd = new ArrayList<>();
        cmd.add(espeakBinary);
        cmd.add("-w");
        cmd.add(wavPath.toAbsolutePath().toString());
        cmd.add(text);
        runCommandCaptureStdout(cmd, "TTS");
        try {
            if (!Files.exists(wavPath) || Files.size(wavPath) == 0) {
                throw new BadRequestException("TTS produced no audio output");
            }
        } catch (IOException e) {
            throw new BadRequestException("Cannot verify TTS output: " + e.getMessage());
        }
    }

    private String runCommandCaptureStdout(List<String> command, String label) {
        ProcessBuilder pb = new ProcessBuilder(command);
        pb.redirectErrorStream(false);
        try {
            Process p = pb.start();
            String stdout;
            try (BufferedReader r = new BufferedReader(new InputStreamReader(p.getInputStream(), StandardCharsets.UTF_8))) {
                StringBuilder sb = new StringBuilder();
                String line;
                while ((line = r.readLine()) != null) {
                    sb.append(line).append('\n');
                }
                stdout = sb.toString();
            }
            String stderr;
            try (BufferedReader r = new BufferedReader(new InputStreamReader(p.getErrorStream(), StandardCharsets.UTF_8))) {
                StringBuilder sb = new StringBuilder();
                String line;
                while ((line = r.readLine()) != null) {
                    sb.append(line).append('\n');
                }
                stderr = sb.toString();
            }
            boolean done = p.waitFor(120, TimeUnit.SECONDS);
            if (!done) {
                p.destroyForcibly();
                throw new BadRequestException(label + " timed out");
            }
            if (p.exitValue() != 0) {
                String lower = stderr.toLowerCase(Locale.ROOT);
                if (lower.contains("not found") || lower.contains("is not recognized")) {
                    throw new BadRequestException(label + " provider is missing. Install and configure " +
                            (label.equals("OCR") ? "app.ocr.tesseract.binary" : "app.tts.espeak.binary"));
                }
                throw new BadRequestException(label + " failed: " + stderr.trim());
            }
            return stdout;
        } catch (IOException e) {
            throw new BadRequestException(label + " provider is not available: " + e.getMessage());
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new BadRequestException(label + " was interrupted");
        }
    }

    private static String normalizeWhitespace(String raw) {
        if (raw == null) {
            return "";
        }
        return raw.replace("\r", "")
                .lines()
                .map(String::trim)
                .filter(s -> !s.isBlank())
                .collect(Collectors.joining("\n"))
                .trim();
    }

    private OcrParsed parseQuestionAndChoices(String extractedText) {
        List<String> lines = extractedText.lines()
                .map(String::trim)
                .filter(s -> !s.isBlank())
                .collect(Collectors.toList());
        List<String> choices = new ArrayList<>();
        List<String> questionLines = new ArrayList<>();
        for (String line : lines) {
            if (CHOICE_PREFIX.matcher(line).find()) {
                String choice = CHOICE_PREFIX.matcher(line).replaceFirst("").trim();
                if (!choice.isBlank()) {
                    choices.add(choice);
                }
            } else if (choices.isEmpty()) {
                questionLines.add(line);
            }
        }
        String questionText = questionLines.isEmpty() ? extractedText : String.join(" ", questionLines).trim();
        return new OcrParsed(questionText, choices);
    }

    private record OcrParsed(String questionText, List<String> choices) {}
}
