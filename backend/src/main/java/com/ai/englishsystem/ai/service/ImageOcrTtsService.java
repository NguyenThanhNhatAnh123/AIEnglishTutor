package com.ai.englishsystem.ai.service;

import com.ai.englishsystem.ai.dto.ImageOcrTtsResponse;
import com.ai.englishsystem.ai.dto.PaperOcrQuestionDraft;
import com.ai.englishsystem.ai.dto.PaperOcrResponse;
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
import java.time.Instant;
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
    private static final Set<String> ALLOWED_PAPER_MIME = Set.of(
            "image/png",
            "image/jpeg",
            "image/jpg",
            "image/webp",
            "application/pdf"
    );
    private static final Pattern CHOICE_PREFIX = Pattern.compile("^(?:[A-Da-d][\\).]|\\d+[\\).]|[-*•])\\s+");

    private final ObjectMapper objectMapper;
    private final PaperOcrParser paperOcrParser;

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

    @Value("${app.ai.http.total-timeout-seconds:170}")
    private int httpTotalTimeoutSeconds;

    // Optional external OCR fallback (when local OCR is missing or returns empty).
    @Value("${app.ocr.external.api-key:}")
    private String ocrSpaceApiKey;

    @Value("${app.ocr.external.base-url:https://api.ocr.space}")
    private String ocrSpaceBaseUrl;

    @Value("${app.ocr.external.language:eng}")
    private String ocrSpaceLanguage;

    @Value("${app.ai.deepseek.api-key:}")
    private String deepSeekApiKey;

    @Value("${app.ai.deepseek.base-url:https://api.deepseek.com}")
    private String deepSeekBaseUrl;

    @Value("${app.ai.deepseek.model:deepseek-chat}")
    private String deepSeekModel;

    @Value("${app.ai.ocr-json.timeout-seconds:20}")
    private int ocrJsonTimeoutSeconds;

    /** Shared, reusable HttpClient instance (created once, reused across calls). */
    private volatile HttpClient httpClient;

    private HttpClient httpClient() {
        if (httpClient == null) {
            synchronized (this) {
                if (httpClient == null) {
                    httpClient = HttpClient.newBuilder()
                            .connectTimeout(Duration.ofSeconds(Math.max(1, httpConnectTimeoutSeconds)))
                            .build();
                    log.info("HttpClient initialized for ImageOcrTtsService (connectTimeout={}s)", httpConnectTimeoutSeconds);
                }
            }
        }
        return httpClient;
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
        Instant deadlineAt = Instant.now().plusSeconds(Math.max(20, httpTotalTimeoutSeconds));

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

            String extractedText = normalizeWhitespace(runOcr(imagePath, deadlineAt));
            if (extractedText.isBlank()) {
                throw new BadRequestException("OCR extracted empty text from image");
            }
            OcrParsed parsed = parseQuestionAndChoices(extractedText);

            String imageUrl = "/uploads/audio/images/" + imagePath.getFileName();
            String audioUrl = null;
            try {
                synthesizeTextToMp3ViaLocalApi(parsed.questionText(), mp3Path, deadlineAt);
                audioUrl = "/uploads/audio/tts/" + mp3Path.getFileName();
            } catch (Exception ttsError) {
                log.warn("OCR succeeded but TTS failed: {}", ttsError.getMessage());
            }

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

    public PaperOcrResponse processPaper(MultipartFile file) {
        validatePaperInput(file);
        String unique = UUID.randomUUID().toString().replace("-", "");
        Instant deadlineAt = Instant.now().plusSeconds(Math.max(20, httpTotalTimeoutSeconds));

        Path paperDir = Paths.get(uploadDir).toAbsolutePath().normalize().resolve("audio").resolve("images");
        Path paperPath = paperDir.resolve(unique + uploadExt(file.getContentType())).normalize();
        ensureSafePath(paperPath, paperDir);

        try {
            Files.createDirectories(paperDir);
            file.transferTo(paperPath.toFile());
            assertValidPaperMagic(paperPath, file.getContentType());

            String extractedText = normalizeWhitespace(runOcr(paperPath, deadlineAt));
            if (extractedText.isBlank()) {
                throw new BadRequestException("OCR extracted empty text from file");
            }

            List<PaperOcrQuestionDraft> questions = parsePaperQuestions(extractedText, deadlineAt);
            if (questions.isEmpty()) {
                throw new BadRequestException("OCR did not find recognizable questions");
            }

            String fileUrl = "/uploads/audio/images/" + paperPath.getFileName();
            log.info("Paper OCR completed: file={}, questions={}", fileUrl, questions.size());
            return PaperOcrResponse.builder()
                    .fileUrl(fileUrl)
                    .extractedText(extractedText)
                    .questions(questions)
                    .build();
        } catch (BadRequestException e) {
            log.warn("Paper OCR rejected: {}", e.getMessage());
            throw e;
        } catch (Exception e) {
            log.error("Paper OCR failed", e);
            throw new BadRequestException("Paper OCR processing failed: " + e.getMessage());
        }
    }

    public String synthesizeTextToAudio(String text) {
        String cleanText = normalizeWhitespace(text);
        if (cleanText.isBlank()) {
            throw new BadRequestException("text cannot be blank");
        }
        Instant deadlineAt = Instant.now().plusSeconds(Math.max(20, httpTotalTimeoutSeconds));
        String unique = UUID.randomUUID().toString().replace("-", "");
        Path ttsDir = Paths.get(uploadDir).toAbsolutePath().normalize().resolve("audio").resolve("tts");
        Path mp3Path = ttsDir.resolve(unique + ".mp3").normalize();
        ensureSafePath(mp3Path, ttsDir);
        try {
            Files.createDirectories(ttsDir);
            synthesizeTextToMp3ViaLocalApi(cleanText, mp3Path, deadlineAt);
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

    private void synthesizeTextToMp3ViaLocalApi(String text, Path mp3Path, Instant deadlineAt) throws Exception {
        byte[] mp3Bytes = callLocalTtsBytes(text, deadlineAt);
        Files.write(mp3Path, mp3Bytes);
        if (!Files.exists(mp3Path) || Files.size(mp3Path) == 0) {
            throw new BadRequestException("TTS produced no audio output");
        }
    }

    private byte[] callLocalTtsBytes(String text, Instant deadlineAt) throws IOException, InterruptedException {
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
                .timeout(resolveRequestTimeout(deadlineAt))
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

    private void validatePaperInput(MultipartFile file) {
        if (file == null || file.isEmpty()) {
            throw new BadRequestException("File is empty");
        }
        if (file.getSize() > MAX_IMAGE_BYTES) {
            throw new BadRequestException("File must be 10 MB or smaller");
        }
        String contentType = file.getContentType();
        if (contentType == null || !ALLOWED_PAPER_MIME.contains(contentType.toLowerCase(Locale.ROOT))) {
            throw new BadRequestException("Unsupported file Content-Type (allowed: png/jpg/jpeg/webp/pdf)");
        }
    }

    private static void ensureSafePath(Path target, Path parent) {
        if (!target.startsWith(parent)) {
            throw new BadRequestException("Invalid path");
        }
    }

    private static String imageExt(String contentType) {
        String ext = uploadExt(contentType);
        return ".pdf".equals(ext) ? ".img" : ext;
    }

    private static String uploadExt(String contentType) {
        String ct = contentType == null ? "" : contentType.toLowerCase(Locale.ROOT);
        return switch (ct) {
            case "image/png" -> ".png";
            case "image/jpeg", "image/jpg" -> ".jpg";
            case "image/webp" -> ".webp";
            case "application/pdf" -> ".pdf";
            default -> ".img";
        };
    }

    private static void assertValidImageMagic(Path file, String contentType) {
        try {
            // Only read header bytes for magic check — not the entire file (Bug #7 fix)
            byte[] head;
            try (var in = Files.newInputStream(file)) {
                head = in.readNBytes(12); // PNG/JPEG/WEBP headers are all ≤12 bytes
            }
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

    private static void assertValidPaperMagic(Path file, String contentType) {
        String ct = contentType == null ? "" : contentType.toLowerCase(Locale.ROOT);
        if (!"application/pdf".equals(ct)) {
            assertValidImageMagic(file, contentType);
            return;
        }
        try (var in = Files.newInputStream(file)) {
            byte[] head = in.readNBytes(5);
            if (head.length < 5 || head[0] != '%' || head[1] != 'P' || head[2] != 'D'
                    || head[3] != 'F' || head[4] != '-') {
                throw new BadRequestException("PDF content does not match declared type");
            }
        } catch (IOException e) {
            throw new BadRequestException("Cannot read uploaded PDF: " + e.getMessage());
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

    /** Check JPEG SOI marker (FF D8). Does NOT check EOI (FF D9) at end
     *  because many valid JPEGs have trailing metadata after the EOI marker. (Bug #7 fix) */
    private static boolean isJpeg(byte[] b) {
        return b.length >= 2
                && (b[0] & 0xFF) == 0xFF
                && (b[1] & 0xFF) == 0xD8;
    }

    private static boolean isWebp(byte[] b) {
        return b.length > 12
                && b[0] == 'R' && b[1] == 'I' && b[2] == 'F' && b[3] == 'F'
                && b[8] == 'W' && b[9] == 'E' && b[10] == 'B' && b[11] == 'P';
    }

    private String runOcr(Path imagePath, Instant deadlineAt) {
        String localText = runOcrLocalHttp(imagePath, deadlineAt);
        if (localText != null && !localText.isBlank()) {
            return localText;
        }

        if (ocrSpaceApiKey == null || ocrSpaceApiKey.isBlank()) {
            throw new BadRequestException(
                    "OCR failed or returned empty text. Configure app.ai.local.base-url for local OCR, "
                            + "or set app.ocr.external.api-key for OCR.space fallback."
            );
        }
        String externalText = runOcrSpace(imagePath, deadlineAt);
        if (externalText == null || externalText.isBlank()) {
            throw new BadRequestException("External OCR returned empty text. Check image quality.");
        }
        return externalText;
    }

    private List<PaperOcrQuestionDraft> parsePaperQuestions(String extractedText, Instant deadlineAt) {
        if (deepSeekApiKey != null && !deepSeekApiKey.isBlank() && hasBudgetLeft(deadlineAt)) {
            try {
                Instant parserDeadlineAt = capDeadline(deadlineAt, Math.max(3, ocrJsonTimeoutSeconds));
                List<PaperOcrQuestionDraft> aiQuestions = parsePaperQuestionsWithDeepSeek(extractedText, parserDeadlineAt);
                if (!aiQuestions.isEmpty()) {
                    return aiQuestions;
                }
                log.warn("AI OCR question parser returned no usable questions; falling back to rule parser");
            } catch (Exception e) {
                log.warn("AI OCR question parser failed: {}", e.getMessage());
            }
        }
        return paperOcrParser.parse(extractedText);
    }

    private List<PaperOcrQuestionDraft> parsePaperQuestionsWithDeepSeek(
            String extractedText,
            Instant deadlineAt
    ) throws Exception {
        String base = deepSeekBaseUrl != null ? deepSeekBaseUrl.trim() : "";
        if (base.endsWith("/")) {
            base = base.substring(0, base.length() - 1);
        }
        String endpoint = base + "/chat/completions";
        String prompt = buildOcrQuestionJsonPrompt(extractedText);
        String payload = objectMapper.writeValueAsString(
                java.util.Map.of(
                        "model", deepSeekModel,
                        "messages", java.util.List.of(
                                java.util.Map.of(
                                        "role", "system",
                                        "content", "You convert OCR text from English exam papers into strict JSON only. Do not add explanations."
                                ),
                                java.util.Map.of(
                                        "role", "user",
                                        "content", prompt
                                )
                        ),
                        "temperature", 0.1
                )
        );

        HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create(endpoint))
                .header("Authorization", "Bearer " + deepSeekApiKey)
                .header("Content-Type", "application/json")
                .timeout(resolveRequestTimeout(deadlineAt))
                .POST(HttpRequest.BodyPublishers.ofString(payload))
                .build();

        HttpResponse<String> response = httpClient().send(request, HttpResponse.BodyHandlers.ofString());
        if (response.statusCode() < 200 || response.statusCode() >= 300) {
            throw new IllegalStateException("DeepSeek OCR parser HTTP " + response.statusCode());
        }

        JsonNode root = objectMapper.readTree(response.body());
        String content = root.path("choices").path(0).path("message").path("content").asText(null);
        if (content == null || content.isBlank()) {
            throw new IllegalStateException("DeepSeek OCR parser returned empty content");
        }
        return normalizeAiQuestionDrafts(content);
    }

    private static String buildOcrQuestionJsonPrompt(String extractedText) {
        return """
                Convert this OCR text into the JSON shape expected by the Add Question bulk editor.

                Return JSON only. Prefer this exact array shape:
                [
                  {
                    "questionNumber": 1,
                    "questionText": "Question text only, without A/B/C/D options",
                    "options": [
                      { "optionText": "Option A text", "isCorrect": true },
                      { "optionText": "Option B text", "isCorrect": false }
                    ],
                    "rawText": "Original OCR lines for this question"
                  }
                ]

                Rules:
                - Split every separate numbered question into a separate array item.
                - Remove option labels such as A., B), C: from optionText.
                - If an answer key is present, mark exactly one option isCorrect=true.
                - If no answer key is present, mark the first option isCorrect=true so the teacher can review and change it.
                - Do not invent questions or options that are not present in the OCR text.
                - Keep English exam wording; only fix obvious OCR spacing/punctuation issues.

                OCR text:
                """ + trimToLength(extractedText, 24000);
    }

    private List<PaperOcrQuestionDraft> normalizeAiQuestionDrafts(String content) throws IOException {
        JsonNode root = readAiJson(content);
        JsonNode items = root.isArray() ? root : root.path("questions");
        if (!items.isArray()) {
            return List.of();
        }

        List<PaperOcrQuestionDraft> out = new ArrayList<>();
        for (JsonNode item : items) {
            if (item == null || item.isNull()) {
                continue;
            }
            String questionText = firstText(item, "questionText", "question", "prompt");
            List<AiOption> options = readAiOptions(item);
            List<String> choices = options.stream()
                    .map(AiOption::optionText)
                    .map(String::trim)
                    .filter(s -> !s.isBlank())
                    .toList();
            if ((questionText == null || questionText.isBlank()) && choices.isEmpty()) {
                continue;
            }

            int correctIndex = readCorrectIndex(item, options, choices.size());
            String rawText = firstText(item, "rawText", "sourceText");
            if (rawText == null || rawText.isBlank()) {
                rawText = buildRawQuestionText(questionText, choices);
            }

            out.add(PaperOcrQuestionDraft.builder()
                    .questionNumber(readNullableInt(item.path("questionNumber")))
                    .questionText(questionText == null ? "" : questionText.trim())
                    .choices(choices)
                    .correctChoiceIndex(correctIndex)
                    .rawText(rawText.trim())
                    .build());
        }
        return out;
    }

    private JsonNode readAiJson(String content) throws IOException {
        String normalized = stripJsonFence(content.trim());
        try {
            return objectMapper.readTree(normalized);
        } catch (IOException first) {
            int arrayStart = normalized.indexOf('[');
            int arrayEnd = normalized.lastIndexOf(']');
            if (arrayStart >= 0 && arrayEnd > arrayStart) {
                return objectMapper.readTree(normalized.substring(arrayStart, arrayEnd + 1));
            }
            int objectStart = normalized.indexOf('{');
            int objectEnd = normalized.lastIndexOf('}');
            if (objectStart >= 0 && objectEnd > objectStart) {
                return objectMapper.readTree(normalized.substring(objectStart, objectEnd + 1));
            }
            throw first;
        }
    }

    private static String stripJsonFence(String text) {
        String out = text;
        if (out.startsWith("```json")) {
            out = out.substring(7);
        } else if (out.startsWith("```")) {
            out = out.substring(3);
        }
        if (out.endsWith("```")) {
            out = out.substring(0, out.length() - 3);
        }
        return out.trim();
    }

    private static List<AiOption> readAiOptions(JsonNode item) {
        JsonNode optionsNode = item.path("options");
        if (!optionsNode.isArray()) {
            optionsNode = item.path("choices");
        }
        if (!optionsNode.isArray()) {
            return List.of();
        }

        List<AiOption> options = new ArrayList<>();
        for (JsonNode optionNode : optionsNode) {
            if (optionNode == null || optionNode.isNull()) {
                continue;
            }
            String optionText;
            boolean isCorrect = false;
            if (optionNode.isTextual()) {
                optionText = optionNode.asText("");
            } else {
                optionText = firstText(optionNode, "optionText", "text", "label", "value");
                isCorrect = optionNode.path("isCorrect").asBoolean(false)
                        || optionNode.path("correct").asBoolean(false);
            }
            if (optionText != null && !optionText.isBlank()) {
                options.add(new AiOption(optionText.trim(), isCorrect));
            }
        }
        return options;
    }

    private static int readCorrectIndex(JsonNode item, List<AiOption> options, int choiceCount) {
        int marked = -1;
        for (int i = 0; i < options.size(); i++) {
            if (options.get(i).isCorrect()) {
                marked = i;
                break;
            }
        }
        if (marked >= 0) {
            return marked;
        }
        Integer explicit = readNullableInt(item.path("correctChoiceIndex"));
        if (explicit != null && explicit >= 0 && explicit < choiceCount) {
            return explicit;
        }
        return 0;
    }

    private static String firstText(JsonNode node, String... fieldNames) {
        for (String fieldName : fieldNames) {
            JsonNode child = node.path(fieldName);
            if (child.isTextual() && !child.asText("").isBlank()) {
                return child.asText("").trim();
            }
        }
        return null;
    }

    private static Integer readNullableInt(JsonNode node) {
        if (node == null || node.isMissingNode() || node.isNull()) {
            return null;
        }
        if (node.canConvertToInt()) {
            return node.asInt();
        }
        if (node.isTextual()) {
            try {
                return Integer.parseInt(node.asText().trim());
            } catch (NumberFormatException ignored) {
                return null;
            }
        }
        return null;
    }

    private static String buildRawQuestionText(String questionText, List<String> choices) {
        StringBuilder sb = new StringBuilder(questionText == null ? "" : questionText.trim());
        for (int i = 0; i < choices.size(); i++) {
            if (sb.length() > 0) {
                sb.append('\n');
            }
            sb.append((char) ('A' + i)).append(". ").append(choices.get(i));
        }
        return sb.toString();
    }

    private static boolean hasBudgetLeft(Instant deadlineAt) {
        return deadlineAt == null || Instant.now().isBefore(deadlineAt);
    }

    private static Instant capDeadline(Instant deadlineAt, int maxSecondsFromNow) {
        Instant cap = Instant.now().plusSeconds(Math.max(1, maxSecondsFromNow));
        return deadlineAt == null || cap.isBefore(deadlineAt) ? cap : deadlineAt;
    }

    private String runOcrLocalHttp(Path imagePath, Instant deadlineAt) {
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
                    .timeout(resolveRequestTimeout(deadlineAt))
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
        if (lower.endsWith(".pdf")) return "application/pdf";
        return "application/octet-stream";
    }

    private static String trimToLength(String s, int maxLen) {
        if (s == null) return null;
        if (s.length() <= maxLen) return s;
        return s.substring(0, maxLen);
    }

    private Duration resolveRequestTimeout(Instant deadlineAt) {
        long perRequestMs = Duration.ofSeconds(Math.max(5, httpRequestTimeoutSeconds)).toMillis();
        if (deadlineAt == null) {
            return Duration.ofMillis(perRequestMs);
        }
        long remainingMs = Duration.between(Instant.now(), deadlineAt).toMillis();
        if (remainingMs <= 1000) {
            throw new BadRequestException("AI timeout budget exhausted");
        }
        return Duration.ofMillis(Math.max(1000, Math.min(perRequestMs, remainingMs)));
    }

    private String runOcrSpace(Path imagePath, Instant deadlineAt) {
        try {
            byte[] imageBytes = Files.readAllBytes(imagePath);
            String filename = imagePath.getFileName() != null ? imagePath.getFileName().toString() : "image.png";
            String extension = getFileExtensionLower(filename);
            String ocrFileType = extensionToOcrFileType(extension);
            String contentType = switch (extension) {
                case "png" -> "image/png";
                case "jpeg", "jpg" -> "image/jpeg";
                case "webp" -> "image/webp";
                case "pdf" -> "application/pdf";
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
                    .timeout(resolveRequestTimeout(deadlineAt))
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
            case "pdf" -> "PDF";
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

    private record AiOption(String optionText, boolean isCorrect) {}

    private record OcrParsed(String questionText, List<String> choices) {}
}
