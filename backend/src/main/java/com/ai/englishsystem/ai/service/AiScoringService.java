package com.ai.englishsystem.ai.service;

import com.ai.englishsystem.common.exception.BadRequestException;
import com.ai.englishsystem.common.exception.ForbiddenException;
import com.ai.englishsystem.common.exception.NotFoundException;
import com.ai.englishsystem.common.util.SecurityUtils;
import com.ai.englishsystem.ai.dto.AiScoreResponse;
import com.ai.englishsystem.ai.dto.SpeakingScoreRequest;
import com.ai.englishsystem.ai.dto.WritingScoreRequest;
import com.ai.englishsystem.ai.entity.AiScoringLog;
import com.ai.englishsystem.ai.entity.AiScoringType;
import com.ai.englishsystem.ai.entity.AiResult;
import com.ai.englishsystem.ai.repository.AiScoringLogRepository;
import com.ai.englishsystem.ai.repository.AiResultRepository;
import com.ai.englishsystem.submission.entity.Answer;
import com.ai.englishsystem.submission.repository.AnswerRepository;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.net.http.HttpTimeoutException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

/**
 * AI scoring backed by configured provider APIs.
 * Idempotent per answer: existing {@link AiResult} rows are reused.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class AiScoringService {

    private final AnswerRepository answerRepository;
    private final AiResultRepository aiResultRepository;
    private final AiScoringLogRepository aiScoringLogRepository;
    private final ObjectMapper objectMapper;

    @Value("${app.ai.deepseek.api-key:}")
    private String deepSeekApiKey;

    @Value("${app.ai.deepseek.base-url:https://api.deepseek.com}")
    private String deepSeekBaseUrl;

    @Value("${app.ai.deepseek.model:deepseek-chat}")
    private String deepSeekModel;

    @Value("${app.ai.deepseek.audio-model:deepseek-audio}")
    private String deepSeekAudioModel;

    // Fallback STT (when DeepSeek transcription fails).
    // Example: OpenAI Whisper API compatible with multipart/form-data.
    @Value("${app.ai.whisper.api-key:}")
    private String whisperApiKey;

    @Value("${app.ai.whisper.base-url:https://api.openai.com/v1}")
    private String whisperBaseUrl;

    @Value("${app.ai.whisper.model:whisper-1}")
    private String whisperModel;

    // Optional local STT service (FastAPI) providing POST /transcribe (multipart: file, language optional).
    @Value("${app.ai.local-transcribe.base-url:}")
    private String localTranscribeBaseUrl;

    /** Unified aiservice base; used when {@code app.ai.local-transcribe.base-url} is blank. */
    @Value("${app.ai.local.base-url:}")
    private String aiLocalBaseUrl;

    @Value("${app.ai.http.connect-timeout-seconds:15}")
    private int httpConnectTimeoutSeconds;

    @Value("${app.ai.http.request-timeout-seconds:120}")
    private int httpRequestTimeoutSeconds;

    @Value("${app.ai.http.total-timeout-seconds:170}")
    private int httpTotalTimeoutSeconds;

    @Value("${app.ai.log.max-body-chars:12000}")
    private int aiLogMaxBodyChars;

    /** Shared, reusable HttpClient instance (created once, reused across calls). */
    private volatile HttpClient sharedHttpClient;

    private HttpClient httpClient() {
        if (sharedHttpClient == null) {
            synchronized (this) {
                if (sharedHttpClient == null) {
                    sharedHttpClient = HttpClient.newBuilder()
                            .connectTimeout(Duration.ofSeconds(Math.max(1, httpConnectTimeoutSeconds)))
                            .build();
                    log.info("HttpClient initialized for AiScoringService (connectTimeout={}s)", httpConnectTimeoutSeconds);
                }
            }
        }
        return sharedHttpClient;
    }

    public AiScoreResponse scoreWriting(WritingScoreRequest request) {
        return scoreWriting(request, false);
    }

    public AiScoreResponse scoreWriting(WritingScoreRequest request, boolean forceRescore) {
        return scoreWriting(request, forceRescore, null);
    }

    public AiScoreResponse scoreWriting(WritingScoreRequest request, boolean forceRescore, Instant deadlineAt) {
        Answer answer = answerRepository.findWithSubmissionGraphById(request.getAnswerId())
                .orElseThrow(() -> new NotFoundException("Answer", request.getAnswerId()));
        assertCanScoreAnswer(answer);

        var existingWriting = aiResultRepository.findByAnswer(answer);
        if (!forceRescore && existingWriting.isPresent()) {
            return toAiScoreResponse(existingWriting.get());
        }

        String text = hasText(answer.getAnswerText()) ? answer.getAnswerText() : request.getEssayText();
        if (!hasText(text)) {
            throw new BadRequestException("No essay text to score");
        }

        float overall;
        float grammarScore;
        float vocabularyScore;
        float coherenceScore;
        String feedback;

        try {
            AiRubric deepSeek = scoreWithDeepSeek(
                    answer,
                    AiScoringType.WRITING,
                    buildWritingPrompt(text, request.getCustomPrompt()),
                    deadlineAt
            );
            overall = deepSeek.overallScore();
            grammarScore = deepSeek.grammarScore();
            vocabularyScore = deepSeek.vocabularyScore();
            coherenceScore = deepSeek.coherenceScore();
            feedback = enrichWritingFeedback(
                    deepSeek.feedback(),
                    deepSeek.mistakes(),
                    deepSeek.changes(),
                    deepSeek.advancedTips()
            );
        } catch (Exception e) {
            log.warn("DeepSeek writing scoring failed for answer {}: {}", answer.getId(), e.getMessage());
            if (isTimeoutError(e)) {
                throw new BadRequestException("AI writing scoring timed out. Please retry or shorten the prompt/text.");
            }
            throw new BadRequestException("AI writing scoring is unavailable. Please retry later or score this answer manually.");
        }

        AiResult aiResult = existingWriting.orElseGet(() -> AiResult.builder().answer(answer).build());
        aiResult.setGrammarScore(grammarScore);
        aiResult.setVocabularyScore(vocabularyScore);
        aiResult.setFluencyScore(null);
        aiResult.setPronunciationScore(null);
        aiResult.setCoherenceScore(coherenceScore);
        aiResult.setOverallScore(overall);
        aiResult.setFeedback(feedback);
        aiResult = aiResultRepository.save(aiResult);
        return toAiScoreResponse(aiResult);
    }

    public AiScoreResponse scoreSpeaking(SpeakingScoreRequest request) {
        return scoreSpeaking(request, false);
    }

    public AiScoreResponse scoreSpeaking(SpeakingScoreRequest request, boolean forceRescore) {
        return scoreSpeaking(request, forceRescore, null);
    }

    public AiScoreResponse scoreSpeaking(SpeakingScoreRequest request, boolean forceRescore, Instant deadlineAt) {
        Answer answer = answerRepository.findWithSubmissionGraphById(request.getAnswerId())
                .orElseThrow(() -> new NotFoundException("Answer", request.getAnswerId()));
        assertCanScoreAnswer(answer);

        var existingSpeaking = aiResultRepository.findByAnswer(answer);
        if (!forceRescore && existingSpeaking.isPresent()) {
            return toAiScoreResponse(existingSpeaking.get());
        }

        String transcriptText = trimToNull(request.getTranscriptText());
        String audioUrl = hasText(answer.getSpeakingAudioUrl()) ? answer.getSpeakingAudioUrl() : request.getAudioUrl();
        if (!hasText(transcriptText) && !hasText(audioUrl)) {
            throw new BadRequestException("No transcript or audio URL to score");
        }

        float overall;
        float pronunciationScore;
        float fluencyScore;
        float grammarScore;
        String feedback;

        try {
            AiRubric deepSeek = scoreWithDeepSeek(
                    answer,
                    AiScoringType.SPEAKING,
                    buildSpeakingPrompt(transcriptText, audioUrl, request.getCustomPrompt()),
                    deadlineAt
            );
            overall = deepSeek.overallScore();
            pronunciationScore = deepSeek.pronunciationScore();
            fluencyScore = deepSeek.fluencyScore();
            grammarScore = deepSeek.grammarScore();
            feedback = enrichSpeakingFeedback(
                    deepSeek.feedback(),
                    deepSeek.mistakes(),
                    deepSeek.changes(),
                    deepSeek.advancedTips()
            );
        } catch (Exception e) {
            log.warn("DeepSeek speaking scoring failed for answer {}: {}", answer.getId(), e.getMessage());
            if (isTimeoutError(e)) {
                throw new BadRequestException("AI speaking scoring timed out. Please retry or shorten the audio/transcript.");
            }
            throw new BadRequestException("AI speaking scoring is unavailable. Please retry later or score this answer manually.");
        }

        AiResult aiResult = existingSpeaking.orElseGet(() -> AiResult.builder().answer(answer).build());
        aiResult.setGrammarScore(grammarScore);
        aiResult.setVocabularyScore(null);
        aiResult.setFluencyScore(fluencyScore);
        aiResult.setPronunciationScore(pronunciationScore);
        aiResult.setCoherenceScore(null);
        aiResult.setOverallScore(overall);
        aiResult.setFeedback(feedback);
        aiResult = aiResultRepository.save(aiResult);
        return toAiScoreResponse(aiResult);
    }

    public String transcribeSpeakingAudio(Path audioPath, String language) {
        return transcribeSpeakingAudio(audioPath, language, newDeadline());
    }

    public String transcribeSpeakingAudio(Path audioPath, String language, Instant deadlineAt) {
        if (audioPath == null || !Files.exists(audioPath)) {
            throw new BadRequestException("Speaking audio file not found for transcription");
        }
        String transcript = null;

        if (!hasBudgetLeft(deadlineAt)) {
            return null;
        }

        // Primary: local Whisper (aiservice /transcribe)
        try {
            transcript = transcribeWithLocalTranscribe(audioPath, language, deadlineAt);
        } catch (Exception e) {
            log.warn("Local Whisper transcription failed for {}: {}", audioPath, e.getMessage());
        }
        if (hasText(transcript)) {
            return transcript.trim();
        }

        if (!hasBudgetLeft(deadlineAt)) {
            return null;
        }

        // Optional: DeepSeek when API key is configured
        try {
            transcript = transcribeWithDeepSeek(audioPath, language, deadlineAt);
        } catch (Exception e) {
            log.warn("DeepSeek transcription failed for {}: {}", audioPath, e.getMessage());
        }
        if (hasText(transcript)) {
            return transcript.trim();
        }

        if (!hasBudgetLeft(deadlineAt)) {
            return null;
        }

        // Optional: OpenAI-compatible Whisper when API key is configured
        try {
            transcript = transcribeWithOpenAIWhisper(audioPath, language, deadlineAt);
        } catch (Exception e) {
            log.warn("OpenAI Whisper transcription failed for {}: {}", audioPath, e.getMessage());
        }

        return hasText(transcript) ? transcript.trim() : null;
    }

    private String transcribeWithLocalTranscribe(Path audioPath, String language, Instant deadlineAt) throws Exception {
        String base = resolveLocalTranscribeBaseUrl();
        if (base == null || base.isBlank()) {
            return null;
        }

        byte[] audioBytes = Files.readAllBytes(audioPath);
        String boundary = "----LocalTranscribeBoundary" + UUID.randomUUID().toString().replace("-", "");
        String filename = audioPath.getFileName() != null ? audioPath.getFileName().toString() : "audio.mp3";

        String boundaryPrefix = "--" + boundary + "\r\n";
        String boundaryEnding = "--" + boundary + "--\r\n";

        String effectiveLanguage = hasText(language) ? language.trim() : null;

        String partLanguage = "";
        byte[] pLang = new byte[0];
        if (effectiveLanguage != null) {
            partLanguage = boundaryPrefix
                    + "Content-Disposition: form-data; name=\"language\"\r\n\r\n"
                    + effectiveLanguage + "\r\n";
            pLang = partLanguage.getBytes(StandardCharsets.UTF_8);
        }

        // Use best-effort audio content type (server may ignore it).
        String contentType = "application/octet-stream";
        String lower = filename.toLowerCase();
        if (lower.endsWith(".wav")) contentType = "audio/wav";
        else if (lower.endsWith(".webm")) contentType = "audio/webm";
        else if (lower.endsWith(".ogg")) contentType = "audio/ogg";
        else if (lower.endsWith(".m4a")) contentType = "audio/mp4";
        else if (lower.endsWith(".mp3") || lower.endsWith(".mpeg")) contentType = "audio/mpeg";

        String partFileHeader = boundaryPrefix
                + "Content-Disposition: form-data; name=\"file\"; filename=\"" + filename + "\"\r\n"
                + "Content-Type: " + contentType + "\r\n\r\n";
        byte[] pFileHeader = partFileHeader.getBytes(StandardCharsets.UTF_8);
        byte[] pFileEnd = "\r\n".getBytes(StandardCharsets.UTF_8);
        byte[] pEnd = boundaryEnding.getBytes(StandardCharsets.UTF_8);

        byte[] body = new byte[pLang.length + pFileHeader.length + audioBytes.length + pFileEnd.length + pEnd.length];
        int offset = 0;
        if (pLang.length > 0) {
            System.arraycopy(pLang, 0, body, offset, pLang.length);
            offset += pLang.length;
        }
        System.arraycopy(pFileHeader, 0, body, offset, pFileHeader.length);
        offset += pFileHeader.length;
        System.arraycopy(audioBytes, 0, body, offset, audioBytes.length);
        offset += audioBytes.length;
        System.arraycopy(pFileEnd, 0, body, offset, pFileEnd.length);
        offset += pFileEnd.length;
        System.arraycopy(pEnd, 0, body, offset, pEnd.length);

        String endpoint = stripTrailingSlash(base) + "/transcribe";

        HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create(endpoint))
                .header("Content-Type", "multipart/form-data; boundary=" + boundary)
                .timeout(resolveRequestTimeout(deadlineAt))
                .POST(HttpRequest.BodyPublishers.ofByteArray(body))
                .build();

        HttpResponse<String> response = httpClient()
                .send(request, HttpResponse.BodyHandlers.ofString());

        if (response.statusCode() < 200 || response.statusCode() >= 300) {
            throw new IllegalStateException("Local transcribe HTTP " + response.statusCode());
        }

        JsonNode root = objectMapper.readTree(response.body());
        String text = root.path("text").asText(null);
        return hasText(text) ? text.trim() : null;
    }

    private static float clamp10(float v) {
        return Math.min(10f, Math.max(0f, v));
    }

    private void assertCanScoreAnswer(Answer answer) {
        if (SecurityUtils.hasRole("ADMIN")) {
            return;
        }

        if (answer.getSubmission() == null) {
            throw new NotFoundException("Submission not loaded for answer");
        }

        Integer currentUserId = SecurityUtils.getCurrentUserId();
        if (SecurityUtils.hasRole("TEACHER")) {
            Integer ownerUserId = answer.getSubmission().getExam().getTeacher().getUser().getId();
            if (!currentUserId.equals(ownerUserId)) {
                throw new ForbiddenException("Cannot score answers for another teacher's exam");
            }
            return;
        }

        if (SecurityUtils.hasRole("STUDENT")) {
            Integer studentUserId = answer.getSubmission().getStudent().getUser().getId();
            if (!currentUserId.equals(studentUserId)) {
                throw new ForbiddenException("Cannot score another student's answer");
            }
            return;
        }

        throw new ForbiddenException("Not allowed to score this answer");
    }

    private static boolean hasText(String value) {
        return value != null && !value.isBlank();
    }

    private AiScoreResponse toAiScoreResponse(AiResult aiResult) {
        return AiScoreResponse.builder()
                .aiResultId(aiResult.getId())
                .grammarScore(aiResult.getGrammarScore())
                .vocabularyScore(aiResult.getVocabularyScore())
                .fluencyScore(aiResult.getFluencyScore())
                .pronunciationScore(aiResult.getPronunciationScore())
                .coherenceScore(aiResult.getCoherenceScore())
                .overallScore(aiResult.getOverallScore())
                .feedback(aiResult.getFeedback())
                .build();
    }

    private AiRubric scoreWithDeepSeek(
            Answer answer,
            AiScoringType scoringType,
            String userPrompt,
            Instant deadlineAt
    ) throws Exception {
        if (deepSeekApiKey == null || deepSeekApiKey.isBlank()) {
            throw new IllegalStateException("DeepSeek API key is not configured");
        }

        String payload = objectMapper.writeValueAsString(
                java.util.Map.of(
                        "model", deepSeekModel,
                        "messages", java.util.List.of(
                                java.util.Map.of(
                                        "role", "system",
                                        "content", "You are an English examiner. Return strict JSON only. Required keys: overallScore, grammarScore, vocabularyScore, fluencyScore, pronunciationScore, coherenceScore, feedback, mistakes, changes, advancedTips. Score range is 0-10. mistakes/changes/advancedTips must be arrays of concise strings."
                                ),
                                java.util.Map.of(
                                        "role", "user",
                                        "content", userPrompt
                                )
                        ),
                        "temperature", 0.2
                )
        );
        String endpoint = deepSeekBaseUrl + "/chat/completions";

        HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create(endpoint))
                .header("Authorization", "Bearer " + deepSeekApiKey)
                .header("Content-Type", "application/json")
                .timeout(resolveRequestTimeout(deadlineAt))
                .POST(HttpRequest.BodyPublishers.ofString(payload))
                .build();

        Instant startedAt = Instant.now();
        HttpResponse<String> response = null;
        try {
            response = httpClient()
                    .send(request, HttpResponse.BodyHandlers.ofString());

            if (response.statusCode() < 200 || response.statusCode() >= 300) {
                throw new IllegalStateException("DeepSeek API error: " + response.statusCode());
            }

            JsonNode root = objectMapper.readTree(response.body());
            String content = root.path("choices").path(0).path("message").path("content").asText();
            if (content == null || content.isBlank()) {
                throw new IllegalStateException("DeepSeek returned empty content");
            }

            String normalizedJson = stripJsonFence(content.trim());
            JsonNode scored = objectMapper.readTree(normalizedJson);
            AiRubric rubric = AiRubric.builder()
                    .overallScore(clamp10((float) scored.path("overallScore").asDouble(0d)))
                    .grammarScore(clamp10((float) scored.path("grammarScore").asDouble(0d)))
                    .vocabularyScore(clamp10((float) scored.path("vocabularyScore").asDouble(0d)))
                    .fluencyScore(clamp10((float) scored.path("fluencyScore").asDouble(0d)))
                    .pronunciationScore(clamp10((float) scored.path("pronunciationScore").asDouble(0d)))
                    .coherenceScore(clamp10((float) scored.path("coherenceScore").asDouble(0d)))
                    .feedback(scored.path("feedback").asText(""))
                    .mistakes(readStringList(scored, "mistakes"))
                    .changes(readStringList(scored, "changes"))
                    .advancedTips(readStringList(scored, "advancedTips"))
                    .build();
            persistScoringLog(answer, scoringType, endpoint, payload, response, true, null, startedAt);
            return rubric;
        } catch (Exception e) {
            persistScoringLog(answer, scoringType, endpoint, payload, response, false, e.getMessage(), startedAt);
            throw e;
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

    private static String buildWritingPrompt(String essayText, String customPrompt) {
        StringBuilder prompt = new StringBuilder("Evaluate this writing answer and provide rubric scores in JSON only.\n");
        prompt.append("Feedback must clearly include: key mistakes, exact changes needed, and advanced upgrades for higher score.\n");
        if (hasText(customPrompt)) {
            prompt.append("Teacher custom instruction:\n")
                    .append(customPrompt.trim())
                    .append("\n");
        }
        prompt.append("Essay:\n").append(essayText);
        return prompt.toString();
    }

    private static String buildSpeakingPrompt(String transcriptText, String audioUrl, String customPrompt) {
        StringBuilder prompt = new StringBuilder("Evaluate this speaking answer and provide rubric scores in JSON only.\n");
        prompt.append("Feedback must clearly include: key mistakes, exact changes needed, and advanced upgrades for higher score.\n");
        if (hasText(customPrompt)) {
            prompt.append("Teacher custom instruction:\n")
                    .append(customPrompt.trim())
                    .append("\n");
        }
        if (hasText(transcriptText)) {
            prompt.append("Transcript (from speech-to-text):\n")
                    .append(transcriptText)
                    .append("\n");
        }
        if (hasText(audioUrl)) {
            prompt.append("audioUrl: ").append(audioUrl);
        }
        return prompt.toString();
    }

    private static List<String> readStringList(JsonNode root, String fieldName) {
        JsonNode node = root.path(fieldName);
        if (!node.isArray()) {
            return List.of();
        }
        List<String> out = new ArrayList<>();
        for (JsonNode item : node) {
            String text = item != null ? item.asText("") : "";
            if (hasText(text)) {
                out.add(text.trim());
            }
        }
        return out;
    }

    private static String enrichWritingFeedback(String baseFeedback, List<String> mistakes, List<String> changes, List<String> advancedTips) {
        StringBuilder sb = new StringBuilder();
        if (hasText(baseFeedback)) {
            sb.append(baseFeedback.trim());
        }
        appendSection(sb, "Key mistakes", mistakes);
        appendSection(sb, "Changes to make", changes);
        appendSection(sb, "Advanced tips", advancedTips);
        return sb.toString().trim();
    }

    private static void appendSection(StringBuilder sb, String title, List<String> items) {
        if (items == null || items.isEmpty()) {
            return;
        }
        if (sb.length() > 0) {
            sb.append("\n\n");
        }
        sb.append(title).append(":\n");
        for (String item : items) {
            sb.append("- ").append(item).append("\n");
        }
        if (sb.length() > 0 && sb.charAt(sb.length() - 1) == '\n') {
            sb.setLength(sb.length() - 1);
        }
    }

    private static List<String> defaultWritingMistakes(float grammarScore, float vocabularyScore, float coherenceScore) {
        List<String> mistakes = new ArrayList<>();
        if (grammarScore < 6.5f) mistakes.add("Sentence structure and tense control are inconsistent.");
        if (vocabularyScore < 6.5f) mistakes.add("Vocabulary range is limited and has repeated word choices.");
        if (coherenceScore < 6.5f) mistakes.add("Ideas are not developed enough and transitions are weak.");
        if (mistakes.isEmpty()) mistakes.add("Only minor language inaccuracies remain.");
        return mistakes;
    }

    private static List<String> defaultWritingChanges(float grammarScore, float vocabularyScore, float coherenceScore) {
        List<String> changes = new ArrayList<>();
        if (grammarScore < 6.5f) changes.add("Fix subject-verb agreement, tense consistency, and punctuation in each paragraph.");
        if (vocabularyScore < 6.5f) changes.add("Replace generic words with topic-specific vocabulary and natural collocations.");
        if (coherenceScore < 6.5f) changes.add("Add a clearer topic sentence and one concrete supporting example per body paragraph.");
        if (changes.isEmpty()) changes.add("Keep current structure and focus on precision to remove small errors.");
        return changes;
    }

    private static List<String> defaultWritingAdvancedTips(float overallScore) {
        List<String> tips = new ArrayList<>();
        tips.add("Use more varied complex sentence patterns while maintaining accuracy.");
        tips.add("Strengthen argument depth with concise evidence or real-world examples.");
        if (overallScore >= 7.5f) {
            tips.add("Refine academic tone with controlled hedging and nuanced linking.");
        } else {
            tips.add("Prioritize reducing repeated grammar errors before adding stylistic complexity.");
        }
        return tips;
    }

    private static String enrichSpeakingFeedback(String baseFeedback, List<String> mistakes, List<String> changes, List<String> advancedTips) {
        StringBuilder sb = new StringBuilder();
        if (hasText(baseFeedback)) {
            sb.append(baseFeedback.trim());
        }
        appendSection(sb, "Key mistakes", mistakes);
        appendSection(sb, "Changes to make", changes);
        appendSection(sb, "Advanced tips", advancedTips);
        return sb.toString().trim();
    }

    private static List<String> defaultSpeakingMistakes(float pronunciationScore, float fluencyScore, float grammarScore) {
        List<String> mistakes = new ArrayList<>();
        if (pronunciationScore < 6.5f) mistakes.add("Pronunciation clarity and stress patterns are inconsistent.");
        if (fluencyScore < 6.5f) mistakes.add("Fluency is interrupted by frequent pauses or self-corrections.");
        if (grammarScore < 6.5f) mistakes.add("Grammar accuracy drops in longer spoken sentences.");
        if (mistakes.isEmpty()) mistakes.add("Only minor speaking accuracy issues remain.");
        return mistakes;
    }

    private static List<String> defaultSpeakingChanges(float pronunciationScore, float fluencyScore, float grammarScore) {
        List<String> changes = new ArrayList<>();
        if (pronunciationScore < 6.5f) changes.add("Practice stress/intonation for key words and final consonant sounds.");
        if (fluencyScore < 6.5f) changes.add("Use short planning phrases to reduce long pauses and keep flow steady.");
        if (grammarScore < 6.5f) changes.add("Use simpler correct structures first, then extend with one complex clause.");
        if (changes.isEmpty()) changes.add("Keep response structure and polish delivery consistency.");
        return changes;
    }

    private static List<String> defaultSpeakingAdvancedTips(float overallScore) {
        List<String> tips = new ArrayList<>();
        tips.add("Develop each point with a concrete example instead of listing ideas.");
        tips.add("Use discourse markers naturally to improve coherence while speaking.");
        if (overallScore >= 7.5f) {
            tips.add("Add nuanced language and flexible paraphrasing to sound more academic.");
        } else {
            tips.add("Stabilize pronunciation and pause control before increasing complexity.");
        }
        return tips;
    }

    private String transcribeWithDeepSeek(Path audioPath, String language, Instant deadlineAt) throws Exception {
        if (deepSeekApiKey == null || deepSeekApiKey.isBlank()) {
            throw new IllegalStateException("DeepSeek API key is not configured");
        }
        byte[] audioBytes = Files.readAllBytes(audioPath);
        String boundary = "----DeepSeekBoundary" + UUID.randomUUID().toString().replace("-", "");
        String filename = audioPath.getFileName() != null ? audioPath.getFileName().toString() : "audio.mp3";
        String effectiveLanguage = hasText(language) ? language.trim() : "en";

        byte[] body = buildMultipartBody(boundary, audioBytes, filename, effectiveLanguage);
        List<String> endpoints = List.of(
                deepSeekBaseUrl + "/audio/transcriptions",
                deepSeekBaseUrl + "/v1/audio/transcriptions"
        );
        String lastError = null;
        for (String endpoint : endpoints) {
            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(endpoint))
                    .header("Authorization", "Bearer " + deepSeekApiKey)
                    .header("Content-Type", "multipart/form-data; boundary=" + boundary)
                    .timeout(resolveRequestTimeout(deadlineAt))
                    .POST(HttpRequest.BodyPublishers.ofByteArray(body))
                    .build();

            HttpResponse<String> response = httpClient()
                    .send(request, HttpResponse.BodyHandlers.ofString());
            if (response.statusCode() < 200 || response.statusCode() >= 300) {
                lastError = "endpoint " + endpoint + " -> HTTP " + response.statusCode();
                continue;
            }
            JsonNode root = objectMapper.readTree(response.body());
            String text = root.path("text").asText(null);
            if (hasText(text)) {
                return text.trim();
            }
            String direct = response.body();
            return hasText(direct) ? direct.trim() : null;
        }
        throw new IllegalStateException(lastError != null ? lastError : "DeepSeek transcription API unavailable");
    }

    private String transcribeWithOpenAIWhisper(Path audioPath, String language, Instant deadlineAt) throws Exception {
        if (whisperApiKey == null || whisperApiKey.isBlank()) {
            throw new IllegalStateException("Whisper API key is not configured (app.ai.whisper.api-key)");
        }

        byte[] audioBytes = Files.readAllBytes(audioPath);
        String boundary = "----WhisperBoundary" + UUID.randomUUID().toString().replace("-", "");

        String filename = audioPath.getFileName() != null ? audioPath.getFileName().toString() : "audio.mp3";
        String effectiveLanguage = hasText(language) ? language.trim() : null;
        String contentType = guessAudioContentType(filename);

        byte[] body = buildWhisperMultipartBody(boundary, audioBytes, filename, contentType, effectiveLanguage);

        String base = whisperBaseUrl != null ? whisperBaseUrl.trim() : "";
        if (base.endsWith("/")) {
            base = base.substring(0, base.length() - 1);
        }
        String endpoint = base + "/audio/transcriptions";

        HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create(endpoint))
                .header("Authorization", "Bearer " + whisperApiKey)
                .header("Content-Type", "multipart/form-data; boundary=" + boundary)
                .timeout(resolveRequestTimeout(deadlineAt))
                .POST(HttpRequest.BodyPublishers.ofByteArray(body))
                .build();

        HttpResponse<String> response = httpClient()
                .send(request, HttpResponse.BodyHandlers.ofString());
        if (response.statusCode() < 200 || response.statusCode() >= 300) {
            throw new IllegalStateException("Whisper API error: HTTP " + response.statusCode());
        }

        JsonNode root = objectMapper.readTree(response.body());
        String text = root.path("text").asText(null);
        return hasText(text) ? text.trim() : null;
    }

    private byte[] buildWhisperMultipartBody(
            String boundary,
            byte[] audioBytes,
            String filename,
            String contentType,
            String language
    ) {
        String separator = "--" + boundary + "\r\n";
        String ending = "--" + boundary + "--\r\n";

        String partModel = separator
                + "Content-Disposition: form-data; name=\"model\"\r\n\r\n"
                + whisperModel + "\r\n";

        byte[] p1 = partModel.getBytes(StandardCharsets.UTF_8);

        byte[] p2 = new byte[0];
        int n = 0;
        List<byte[]> parts = new ArrayList<>();
        parts.add(p1);
        n += p1.length;

        if (language != null) {
            String partLanguage = separator
                    + "Content-Disposition: form-data; name=\"language\"\r\n\r\n"
                    + language + "\r\n";
            p2 = partLanguage.getBytes(StandardCharsets.UTF_8);
            parts.add(p2);
            n += p2.length;
        }

        String partFileHeader = separator
                + "Content-Disposition: form-data; name=\"file\"; filename=\"" + filename + "\"\r\n"
                + "Content-Type: " + contentType + "\r\n\r\n";

        byte[] p3 = partFileHeader.getBytes(StandardCharsets.UTF_8);
        parts.add(p3);
        n += p3.length;

        byte[] p4 = audioBytes;
        parts.add(p4);
        n += p4.length;

        byte[] p5 = "\r\n".getBytes(StandardCharsets.UTF_8);
        parts.add(p5);
        n += p5.length;

        byte[] p6 = ending.getBytes(StandardCharsets.UTF_8);
        parts.add(p6);
        n += p6.length;

        byte[] body = new byte[n];
        int offset = 0;
        for (byte[] part : parts) {
            System.arraycopy(part, 0, body, offset, part.length);
            offset += part.length;
        }
        return body;
    }

    private static String guessAudioContentType(String filename) {
        String lower = filename != null ? filename.toLowerCase() : "";
        if (lower.endsWith(".wav")) return "audio/wav";
        if (lower.endsWith(".webm")) return "audio/webm";
        if (lower.endsWith(".ogg")) return "audio/ogg";
        if (lower.endsWith(".m4a")) return "audio/mp4";
        if (lower.endsWith(".mp3") || lower.endsWith(".mpeg")) return "audio/mpeg";
        return "application/octet-stream";
    }

    private byte[] buildMultipartBody(String boundary, byte[] audioBytes, String filename, String language) {
        String separator = "--" + boundary + "\r\n";
        String ending = "--" + boundary + "--\r\n";
        String partModel = separator
                + "Content-Disposition: form-data; name=\"model\"\r\n\r\n"
                + deepSeekAudioModel + "\r\n";
        String partLanguage = separator
                + "Content-Disposition: form-data; name=\"language\"\r\n\r\n"
                + language + "\r\n";
        String partResponseFormat = separator
                + "Content-Disposition: form-data; name=\"response_format\"\r\n\r\n"
                + "json\r\n";
        String partFileHeader = separator
                + "Content-Disposition: form-data; name=\"file\"; filename=\"" + filename + "\"\r\n"
                + "Content-Type: audio/mpeg\r\n\r\n";

        byte[] p1 = partModel.getBytes(StandardCharsets.UTF_8);
        byte[] p2 = partLanguage.getBytes(StandardCharsets.UTF_8);
        byte[] p3 = partResponseFormat.getBytes(StandardCharsets.UTF_8);
        byte[] p4 = partFileHeader.getBytes(StandardCharsets.UTF_8);
        byte[] p5 = "\r\n".getBytes(StandardCharsets.UTF_8);
        byte[] p6 = ending.getBytes(StandardCharsets.UTF_8);

        byte[] body = new byte[p1.length + p2.length + p3.length + p4.length + audioBytes.length + p5.length + p6.length];
        int offset = 0;
        System.arraycopy(p1, 0, body, offset, p1.length);
        offset += p1.length;
        System.arraycopy(p2, 0, body, offset, p2.length);
        offset += p2.length;
        System.arraycopy(p3, 0, body, offset, p3.length);
        offset += p3.length;
        System.arraycopy(p4, 0, body, offset, p4.length);
        offset += p4.length;
        System.arraycopy(audioBytes, 0, body, offset, audioBytes.length);
        offset += audioBytes.length;
        System.arraycopy(p5, 0, body, offset, p5.length);
        offset += p5.length;
        System.arraycopy(p6, 0, body, offset, p6.length);
        return body;
    }

    private void persistScoringLog(
            Answer answer,
            AiScoringType scoringType,
            String endpoint,
            String payload,
            HttpResponse<String> response,
            boolean success,
            String errorMessage,
            Instant startedAt
    ) {
        long latencyMs = Duration.between(startedAt, Instant.now()).toMillis();
        aiScoringLogRepository.save(AiScoringLog.builder()
                .answer(answer)
                .submission(answer.getSubmission())
                .scoringType(scoringType)
                .provider("DEEPSEEK")
                .model(deepSeekModel)
                .endpoint(endpoint)
                .requestPayload(trimForAiLog(payload))
                .responseBody(response != null ? trimForAiLog(response.body()) : null)
                .httpStatus(response != null ? response.statusCode() : null)
                .successFlag(success)
                .latencyMs(latencyMs)
                .errorMessage(trimForAiLog(trimToNull(errorMessage)))
                .build());
    }

    private String trimForAiLog(String value) {
        if (value == null) {
            return null;
        }
        int max = Math.max(1000, aiLogMaxBodyChars);
        if (value.length() <= max) {
            return value;
        }
        return value.substring(0, max) + "\n...[truncated]";
    }

    private static String trimToNull(String value) {
        if (value == null) {
            return null;
        }
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }

    private String resolveLocalTranscribeBaseUrl() {
        if (localTranscribeBaseUrl != null && !localTranscribeBaseUrl.isBlank()) {
            return localTranscribeBaseUrl.trim();
        }
        if (aiLocalBaseUrl != null && !aiLocalBaseUrl.isBlank()) {
            return aiLocalBaseUrl.trim();
        }
        return null;
    }

    private static String stripTrailingSlash(String base) {
        if (base.endsWith("/")) {
            return base.substring(0, base.length() - 1);
        }
        return base;
    }

    private Instant newDeadline() {
        return Instant.now().plusSeconds(Math.max(30, httpTotalTimeoutSeconds));
    }

    private static boolean hasBudgetLeft(Instant deadlineAt) {
        return deadlineAt == null || Instant.now().isBefore(deadlineAt);
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

    private static boolean isTimeoutError(Throwable throwable) {
        Throwable current = throwable;
        while (current != null) {
            if (current instanceof HttpTimeoutException) {
                return true;
            }
            String message = current.getMessage();
            if (message != null && message.toLowerCase().contains("timed out")) {
                return true;
            }
            current = current.getCause();
        }
        return false;
    }

    @lombok.Builder
    private record AiRubric(
            float overallScore,
            float grammarScore,
            float vocabularyScore,
            float fluencyScore,
            float pronunciationScore,
            float coherenceScore,
            String feedback,
            List<String> mistakes,
            List<String> changes,
            List<String> advancedTips
    ) {
    }

}
