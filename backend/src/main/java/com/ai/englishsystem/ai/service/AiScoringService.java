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
import org.springframework.transaction.annotation.Transactional;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.time.Instant;
import java.util.concurrent.ThreadLocalRandom;

/**
 * AI scoring (mock in production bootstrap; swap for real LLM / speech APIs later).
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

    @Transactional
    public AiScoreResponse scoreWriting(WritingScoreRequest request) {
        Answer answer = answerRepository.findWithSubmissionGraphById(request.getAnswerId())
                .orElseThrow(() -> new NotFoundException("Answer", request.getAnswerId()));
        assertCanScoreAnswer(answer);

        var existingWriting = aiResultRepository.findByAnswer(answer);
        if (existingWriting.isPresent()) {
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
            AiRubric deepSeek = scoreWithDeepSeek(answer, AiScoringType.WRITING, buildWritingPrompt(text));
            overall = deepSeek.overallScore();
            grammarScore = deepSeek.grammarScore();
            vocabularyScore = deepSeek.vocabularyScore();
            coherenceScore = deepSeek.coherenceScore();
            feedback = deepSeek.feedback();
        } catch (Exception e) {
            log.warn("DeepSeek writing scoring fallback for answer {}: {}", answer.getId(), e.getMessage());
            overall = mockOverall6To9();
            grammarScore = jitterAround(overall);
            vocabularyScore = jitterAround(overall);
            coherenceScore = jitterAround(overall);
            feedback = buildWritingFeedback(grammarScore, vocabularyScore, coherenceScore, overall);
        }

        AiResult aiResult = AiResult.builder()
                .answer(answer)
                .grammarScore(grammarScore)
                .vocabularyScore(vocabularyScore)
                .fluencyScore(null)
                .pronunciationScore(null)
                .coherenceScore(coherenceScore)
                .overallScore(overall)
                .feedback(feedback)
                .build();

        aiResult = aiResultRepository.save(aiResult);
        return toAiScoreResponse(aiResult);
    }

    @Transactional
    public AiScoreResponse scoreSpeaking(SpeakingScoreRequest request) {
        Answer answer = answerRepository.findWithSubmissionGraphById(request.getAnswerId())
                .orElseThrow(() -> new NotFoundException("Answer", request.getAnswerId()));
        assertCanScoreAnswer(answer);

        var existingSpeaking = aiResultRepository.findByAnswer(answer);
        if (existingSpeaking.isPresent()) {
            return toAiScoreResponse(existingSpeaking.get());
        }

        String audioUrl = hasText(answer.getSpeakingAudioUrl()) ? answer.getSpeakingAudioUrl() : request.getAudioUrl();
        if (!hasText(audioUrl)) {
            throw new BadRequestException("No audio URL to score");
        }

        float overall;
        float pronunciationScore;
        float fluencyScore;
        float grammarScore;
        String feedback;

        try {
            AiRubric deepSeek = scoreWithDeepSeek(answer, AiScoringType.SPEAKING, buildSpeakingPrompt(audioUrl));
            overall = deepSeek.overallScore();
            pronunciationScore = deepSeek.pronunciationScore();
            fluencyScore = deepSeek.fluencyScore();
            grammarScore = deepSeek.grammarScore();
            feedback = deepSeek.feedback();
        } catch (Exception e) {
            log.warn("DeepSeek speaking scoring fallback for answer {}: {}", answer.getId(), e.getMessage());
            overall = mockOverall6To9();
            pronunciationScore = jitterAround(overall);
            fluencyScore = jitterAround(overall);
            grammarScore = jitterAround(overall);
            feedback = buildSpeakingFeedback(pronunciationScore, fluencyScore, grammarScore, overall);
        }

        AiResult aiResult = AiResult.builder()
                .answer(answer)
                .grammarScore(grammarScore)
                .vocabularyScore(null)
                .fluencyScore(fluencyScore)
                .pronunciationScore(pronunciationScore)
                .coherenceScore(null)
                .overallScore(overall)
                .feedback(feedback)
                .build();

        aiResult = aiResultRepository.save(aiResult);
        return toAiScoreResponse(aiResult);
    }

    /** Mock band ~6–9 on a 0–10 scale (production: replace with model output). */
    private static float mockOverall6To9() {
        ThreadLocalRandom r = ThreadLocalRandom.current();
        return 6f + r.nextFloat() * 3f;
    }

    private static float jitterAround(float center) {
        float d = (ThreadLocalRandom.current().nextFloat() - 0.5f) * 1.2f;
        return clamp10(center + d);
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

    private String buildWritingFeedback(float g, float v, float c, float o) {
        StringBuilder sb = new StringBuilder();
        sb.append(String.format("Overall: %.1f/10. ", o));
        if (g < 6) sb.append("Improve grammar and sentence structure. ");
        if (v < 6) sb.append("Use more varied vocabulary. ");
        if (c < 6) sb.append("Enhance essay coherence and flow. ");
        if (o >= 8) sb.append("Excellent work!");
        return sb.toString().trim();
    }

    private String buildSpeakingFeedback(float p, float f, float g, float o) {
        StringBuilder sb = new StringBuilder();
        sb.append(String.format("Overall: %.1f/10. ", o));
        if (p < 6) sb.append("Practice pronunciation. ");
        if (f < 6) sb.append("Work on fluency and pacing. ");
        if (g < 6) sb.append("Focus on grammatical accuracy. ");
        if (o >= 8) sb.append("Well done!");
        return sb.toString().trim();
    }

    private AiRubric scoreWithDeepSeek(Answer answer, AiScoringType scoringType, String userPrompt) throws Exception {
        if (deepSeekApiKey == null || deepSeekApiKey.isBlank()) {
            throw new IllegalStateException("DeepSeek API key is not configured");
        }

        String payload = objectMapper.writeValueAsString(
                java.util.Map.of(
                        "model", deepSeekModel,
                        "messages", java.util.List.of(
                                java.util.Map.of(
                                        "role", "system",
                                        "content", "You are an English examiner. Return strict JSON only with keys: overallScore, grammarScore, vocabularyScore, fluencyScore, pronunciationScore, coherenceScore, feedback. Score range is 0-10."
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
                .POST(HttpRequest.BodyPublishers.ofString(payload))
                .build();

        Instant startedAt = Instant.now();
        HttpResponse<String> response = null;
        try {
            response = HttpClient.newHttpClient()
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

    private static String buildWritingPrompt(String essayText) {
        return "Evaluate this writing answer and provide rubric scores in JSON only.\n"
                + "Essay:\n" + essayText;
    }

    private static String buildSpeakingPrompt(String audioUrl) {
        return "Evaluate this speaking answer from audio URL and provide rubric scores in JSON only.\n"
                + "audioUrl: " + audioUrl;
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
                .requestPayload(payload)
                .responseBody(response != null ? response.body() : null)
                .httpStatus(response != null ? response.statusCode() : null)
                .successFlag(success)
                .latencyMs(latencyMs)
                .errorMessage(trimToNull(errorMessage))
                .build());
    }

    private static String trimToNull(String value) {
        if (value == null) {
            return null;
        }
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }

    @lombok.Builder
    private record AiRubric(
            float overallScore,
            float grammarScore,
            float vocabularyScore,
            float fluencyScore,
            float pronunciationScore,
            float coherenceScore,
            String feedback
    ) {
    }

}
