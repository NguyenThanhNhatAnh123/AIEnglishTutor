package com.ai.englishsystem.ai.service;

import com.ai.englishsystem.ai.dto.ImageOcrTtsResponse;
import com.ai.englishsystem.common.exception.BadRequestException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.UUID;
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

    private final ObjectMapper objectMapper;

    @Value("${app.upload.dir:uploads}")
    private String uploadDir;

    /** Unified local AI service base (aiservice). Overrides per-endpoint when blank. */
    @Value("${app.ai.local.base-url:}")
    private String aiLocalBaseUrl;

    @Value("${app.ai.local.ocr.base-url:}")
    private String ocrLocalOverrideUrl;

    @Value("${app.ai.local.tts.base-url:}")
    private String ttsLocalOverrideUrl;

    /** Backward compatibility: used when {@code app.ai.local.base-url} and override are blank. */
    @Value("${app.ocr.local.base-url:}")
    private String legacyOcrLocalBaseUrl;

    @Value("${app.ai.http.connect-timeout-seconds:15}")
    private int httpConnectTimeoutSeconds;

    @Value("${app.ai.http.request-timeout-seconds:120}")
    private int httpRequestTimeoutSeconds;

    // Optional external OCR fallback (when local OCR is missing or returns empty).
    @Value("${app.ocr.external.api-key:}")
    private String ocrSpaceApiKey;

    @Value("${app.ocr.external.base-url:https://api.ocr.space}")
    private String ocrSpaceBaseUrl;

    @Value("${app.ocr.external.language:eng}")
    private String ocrSpaceLanguage;

    private HttpClient httpClient() {
        return HttpClient.newBuilder()
                .connectTimeout(Duration.ofSeconds(Math.max(1, httpConnectTimeoutSeconds)))
                .build();
    }

    private String resolveOcrBaseUrl() {
        String u = trimToNull(ocrLocalOverrideUrl);
        if (u != null) {
            return stripTrailingSlash(u);
        }
        u = trimToNull(aiLocalBaseUrl);
        if (u != null) {
            return stripTrailingSlash(u);
        }
        u = trimToNull(legacyOcrLocalBaseUrl);
        return u != null ? stripTrailingSlash(u) : null;
    }

    private String resolveTtsBaseUrl() {
        String u = trimToNull(ttsLocalOverrideUrl);
        if (u != null) {
            return stripTrailingSlash(u);
        }
        u = trimToNull(aiLocalBaseUrl);
        return u != null ? stripTrailingSlash(u) : null;
    }

    private static String trimToNull(String s) {
        if (s == null) {
            return null;
        }
        String t = s.trim();
        return t.isEmpty() ? null : t;
    }

    private static String stripTrailingSlash(String base) {
        if (base.endsWith("/")) {
            return base.substring(0, base.length() - 1);
        }
        return base;
    }

    public ImageOcrTtsResponse processImage(MultipartFile file) {
        validateInput(file);
        String unique = UUID.randomUUID().toString().replace("-", "");

        Path imageDir = Paths.get(uploadDir).toAbsolutePath().normalize().resolve("audio").resolve("images");
        Path ttsDir = Paths.get(uploadDir).toAbsolutePath().normalize().resolve("audio").resolve("tts");
        Path imagePath = imageDir.resolve(unique + imageExt(file.getContentType())).normalize();
        Path mp3Path = ttsDir.resolve(unique + ".mp3").normalize();

        ensureSafePath(imagePath, imageDir);
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

            synthesizeTextToMp3ViaLocalApi(parsed.questionText(), mp3Path);

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
        }
    }

    public String synthesizeTextToAudio(String text) {
        String cleanText = normalizeWhitespace(text);
        if (cleanText.isBlank()) {
            throw new BadRequestException("text cannot be blank");
        }
        String unique = UUID.randomUUID().toString().replace("-", "");
        Path ttsDir = Paths.get(uploadDir).toAbsolutePath().normalize().resolve("audio").resolve("tts");
        Path mp3Path = ttsDir.resolve(unique + ".mp3").normalize();
        ensureSafePath(mp3Path, ttsDir);
        try {
            Files.createDirectories(ttsDir);
            synthesizeTextToMp3ViaLocalApi(cleanText, mp3Path);
            String audioUrl = "/uploads/audio/tts/" + mp3Path.getFileName();
            log.info("Generated TTS audio: {}", audioUrl);
            return audioUrl;
        } catch (BadRequestException e) {
            throw e;
        } catch (Exception e) {
            log.error("Text-to-speech failed", e);
            throw new BadRequestException("TTS processing failed: " + e.getMessage());
        }
    }

    private void synthesizeTextToMp3ViaLocalApi(String text, Path mp3Path) throws Exception {
        byte[] mp3Bytes = callLocalTtsBytes(text);
        Files.write(mp3Path, mp3Bytes);
        if (!Files.exists(mp3Path) || Files.size(mp3Path) == 0) {
            throw new BadRequestException("TTS produced no audio output");
        }
    }

    private byte[] callLocalTtsBytes(String text) throws IOException, InterruptedException {
        String base = resolveTtsBaseUrl();
        if (base == null) {
            throw new BadRequestException(
                    "Local TTS is not configured. Set app.ai.local.base-url or app.ai.local.tts.base-url to your aiservice URL."
            );
        }
        String endpoint = base + "/tts";
        String boundary = "----TtsLocalBoundary" + UUID.randomUUID().toString().replace("-", "");
        byte[] body = buildTtsMultipart(boundary, text);

        HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create(endpoint))
                .header("Content-Type", "multipart/form-data; boundary=" + boundary)
                .timeout(Duration.ofSeconds(Math.max(5, httpRequestTimeoutSeconds)))
                .POST(HttpRequest.BodyPublishers.ofByteArray(body))
                .build();

        HttpResponse<byte[]> response = httpClient().send(request, HttpResponse.BodyHandlers.ofByteArray());
        if (response.statusCode() < 200 || response.statusCode() >= 300) {
            String snippet = response.body() != null
                    ? new String(response.body(), 0, Math.min(response.body().length, 500), StandardCharsets.UTF_8)
                    : "";
            log.warn("Local TTS HTTP {} at {} — body snippet: {}", response.statusCode(), endpoint, snippet);
            throw new BadRequestException("Local TTS failed: HTTP " + response.statusCode());
        }
        byte[] audio = response.body();
        if (audio == null || audio.length == 0) {
            throw new BadRequestException("Local TTS returned empty audio");
        }
        return audio;
    }

    private byte[] buildTtsMultipart(String boundary, String text) {
        String sep = "--" + boundary + "\r\n";
        String end = "--" + boundary + "--\r\n";
        String part = sep
                + "Content-Disposition: form-data; name=\"text\"\r\n\r\n"
                + text + "\r\n";
        return concat(part.getBytes(StandardCharsets.UTF_8), end.getBytes(StandardCharsets.UTF_8));
    }

    private static byte[] concat(byte[] a, byte[] b) {
        byte[] out = new byte[a.length + b.length];
        System.arraycopy(a, 0, out, 0, a.length);
        System.arraycopy(b, 0, out, a.length, b.length);
        return out;
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
        String localText = runOcrLocalHttp(imagePath);
        if (localText != null && !localText.isBlank()) {
            return localText;
        }

        if (ocrSpaceApiKey == null || ocrSpaceApiKey.isBlank()) {
            throw new BadRequestException(
                    "OCR failed or returned empty text. Configure app.ai.local.base-url for local OCR, "
                            + "or set app.ocr.external.api-key for OCR.space fallback."
            );
        }
        String externalText = runOcrSpace(imagePath);
        if (externalText == null || externalText.isBlank()) {
            throw new BadRequestException("External OCR returned empty text. Check image quality.");
        }
        return externalText;
    }

    private String runOcrLocalHttp(Path imagePath) {
        try {
            String base = resolveOcrBaseUrl();
            if (base == null) {
                log.warn("Local OCR base URL is not configured (app.ai.local.base-url / app.ai.local.ocr.base-url)");
                return null;
            }
            byte[] imageBytes = Files.readAllBytes(imagePath);
            String filename = imagePath.getFileName() != null ? imagePath.getFileName().toString() : "image.png";
            String boundary = "----OcrLocalBoundary" + UUID.randomUUID().toString().replace("-", "");
            String contentType = guessImageContentType(filename);
            byte[] body = buildOcrLocalMultipartBody(boundary, imageBytes, filename, contentType);
            String endpoint = base + "/ocr";

            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(endpoint))
                    .header("Content-Type", "multipart/form-data; boundary=" + boundary)
                    .timeout(Duration.ofSeconds(Math.max(5, httpRequestTimeoutSeconds)))
                    .POST(HttpRequest.BodyPublishers.ofByteArray(body))
                    .build();

            HttpResponse<String> response = httpClient().send(request, HttpResponse.BodyHandlers.ofString());
            if (response.statusCode() < 200 || response.statusCode() >= 300) {
                log.warn("Local OCR failed HTTP {}. response={}", response.statusCode(), trimToLength(response.body(), 500));
                return null;
            }
            JsonNode root = objectMapper.readTree(response.body());
            String text = root.path("text").asText(null);
            return text != null && !text.isBlank() ? text.trim() : null;
        } catch (Exception e) {
            log.warn("Local OCR failed: {}", e.getMessage());
            return null;
        }
    }

    private byte[] buildOcrLocalMultipartBody(
            String boundary,
            byte[] imageBytes,
            String filename,
            String contentType
    ) {
        String separator = "--" + boundary + "\r\n";
        String ending = "--" + boundary + "--\r\n";
        String partLanguage = separator
                + "Content-Disposition: form-data; name=\"language\"\r\n\r\n"
                + (ocrSpaceLanguage != null && !ocrSpaceLanguage.isBlank() ? ocrSpaceLanguage : "eng") + "\r\n";
        String partFileHeader = separator
                + "Content-Disposition: form-data; name=\"file\"; filename=\"" + filename + "\"\r\n"
                + "Content-Type: " + contentType + "\r\n\r\n";
        byte[] p1 = partLanguage.getBytes(StandardCharsets.UTF_8);
        byte[] p2 = partFileHeader.getBytes(StandardCharsets.UTF_8);
        byte[] p3 = imageBytes;
        byte[] p4 = "\r\n".getBytes(StandardCharsets.UTF_8);
        byte[] p5 = ending.getBytes(StandardCharsets.UTF_8);
        byte[] body = new byte[p1.length + p2.length + p3.length + p4.length + p5.length];
        int offset = 0;
        System.arraycopy(p1, 0, body, offset, p1.length);
        offset += p1.length;
        System.arraycopy(p2, 0, body, offset, p2.length);
        offset += p2.length;
        System.arraycopy(p3, 0, body, offset, p3.length);
        offset += p3.length;
        System.arraycopy(p4, 0, body, offset, p4.length);
        offset += p4.length;
        System.arraycopy(p5, 0, body, offset, p5.length);
        return body;
    }

    private static String guessImageContentType(String filename) {
        String lower = filename != null ? filename.toLowerCase() : "";
        if (lower.endsWith(".png")) return "image/png";
        if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
        if (lower.endsWith(".webp")) return "image/webp";
        return "application/octet-stream";
    }

    private static String trimToLength(String s, int maxLen) {
        if (s == null) return null;
        if (s.length() <= maxLen) return s;
        return s.substring(0, maxLen);
    }

    private String runOcrSpace(Path imagePath) {
        try {
            byte[] imageBytes = Files.readAllBytes(imagePath);
            String filename = imagePath.getFileName() != null ? imagePath.getFileName().toString() : "image.png";
            String extension = getFileExtensionLower(filename);
            String ocrFileType = extensionToOcrFileType(extension);
            String contentType = switch (extension) {
                case "png" -> "image/png";
                case "jpeg", "jpg" -> "image/jpeg";
                case "webp" -> "image/webp";
                default -> "application/octet-stream";
            };

            String boundary = "----OcrSpaceBoundary" + UUID.randomUUID().toString().replace("-", "");
            byte[] body = buildOcrSpaceMultipartBody(boundary, imageBytes, filename, contentType, ocrFileType);

            String base = ocrSpaceBaseUrl != null ? ocrSpaceBaseUrl.trim() : "";
            if (base.endsWith("/")) base = base.substring(0, base.length() - 1);
            String endpoint = base + "/parse/image";

            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(endpoint))
                    .header("Content-Type", "multipart/form-data; boundary=" + boundary)
                    .timeout(Duration.ofSeconds(Math.max(5, httpRequestTimeoutSeconds)))
                    .POST(HttpRequest.BodyPublishers.ofByteArray(body))
                    .build();

            HttpResponse<String> response = httpClient().send(request, HttpResponse.BodyHandlers.ofString());

            if (response.statusCode() < 200 || response.statusCode() >= 300) {
                throw new BadRequestException("External OCR failed: HTTP " + response.statusCode());
            }

            JsonNode root = objectMapper.readTree(response.body());
            JsonNode parsedResults = root.path("ParsedResults");
            if (parsedResults.isArray() && parsedResults.size() > 0) {
                String text = parsedResults.get(0).path("ParsedText").asText(null);
                if (text != null) {
                    return text;
                }
            }

            String errorMessage = root.path("ErrorMessage").asText(null);
            if (errorMessage != null && !errorMessage.isBlank()) {
                throw new BadRequestException("External OCR error: " + errorMessage);
            }
            throw new BadRequestException("External OCR returned an unexpected response");
        } catch (IOException e) {
            throw new BadRequestException("External OCR failed to read image: " + e.getMessage());
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new BadRequestException("External OCR was interrupted");
        }
    }

    private byte[] buildOcrSpaceMultipartBody(
            String boundary,
            byte[] imageBytes,
            String filename,
            String contentType,
            String ocrFileType
    ) {
        String separator = "--" + boundary + "\r\n";
        String ending = "--" + boundary + "--\r\n";

        String partApiKey = separator
                + "Content-Disposition: form-data; name=\"apikey\"\r\n\r\n"
                + ocrSpaceApiKey + "\r\n";
        byte[] p1 = partApiKey.getBytes(StandardCharsets.UTF_8);

        String partLang = separator
                + "Content-Disposition: form-data; name=\"language\"\r\n\r\n"
                + (ocrSpaceLanguage != null && !ocrSpaceLanguage.isBlank() ? ocrSpaceLanguage : "eng") + "\r\n";
        byte[] p2 = partLang.getBytes(StandardCharsets.UTF_8);

        String partFileType = separator
                + "Content-Disposition: form-data; name=\"filetype\"\r\n\r\n"
                + (ocrFileType != null && !ocrFileType.isBlank() ? ocrFileType : "PNG") + "\r\n";
        byte[] p3 = partFileType.getBytes(StandardCharsets.UTF_8);

        String partOverlay = separator
                + "Content-Disposition: form-data; name=\"isOverlayRequired\"\r\n\r\n"
                + "false\r\n";
        byte[] p4 = partOverlay.getBytes(StandardCharsets.UTF_8);

        String partFileHeader = separator
                + "Content-Disposition: form-data; name=\"file\"; filename=\"" + filename + "\"\r\n"
                + "Content-Type: " + contentType + "\r\n\r\n";
        byte[] p5 = partFileHeader.getBytes(StandardCharsets.UTF_8);

        byte[] p6 = imageBytes;
        byte[] p7 = "\r\n".getBytes(StandardCharsets.UTF_8);
        byte[] p8 = ending.getBytes(StandardCharsets.UTF_8);

        byte[] body = new byte[p1.length + p2.length + p3.length + p4.length + p5.length + p6.length + p7.length + p8.length];
        int offset = 0;
        for (byte[] part : new byte[][]{p1, p2, p3, p4, p5, p6, p7, p8}) {
            System.arraycopy(part, 0, body, offset, part.length);
            offset += part.length;
        }
        return body;
    }

    private static String getFileExtensionLower(String filename) {
        if (filename == null) return "";
        int idx = filename.lastIndexOf('.');
        if (idx < 0 || idx == filename.length() - 1) return "";
        return filename.substring(idx + 1).toLowerCase();
    }

    private static String extensionToOcrFileType(String extension) {
        return switch (extension) {
            case "png" -> "PNG";
            case "jpeg", "jpg" -> "JPG";
            case "webp" -> "WEBP";
            default -> "PNG";
        };
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
