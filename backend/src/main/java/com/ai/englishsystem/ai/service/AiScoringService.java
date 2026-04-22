package com.ai.englishsystem.ai.service;

import com.ai.englishsystem.common.exception.BadRequestException;
import com.ai.englishsystem.common.exception.NotFoundException;
import com.ai.englishsystem.ai.dto.AiScoreResponse;
import com.ai.englishsystem.ai.dto.SpeakingScoreRequest;
import com.ai.englishsystem.ai.dto.WritingScoreRequest;
import com.ai.englishsystem.ai.entity.AiResult;
import com.ai.englishsystem.ai.repository.AiResultRepository;
import com.ai.englishsystem.submission.entity.Answer;
import com.ai.englishsystem.submission.repository.AnswerRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

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

    @Transactional
    public AiScoreResponse scoreWriting(WritingScoreRequest request) {
        Answer answer = answerRepository.findById(request.getAnswerId())
                .orElseThrow(() -> new NotFoundException("Answer", request.getAnswerId()));

        var existingWriting = aiResultRepository.findByAnswer(answer);
        if (existingWriting.isPresent()) {
            return toAiScoreResponse(existingWriting.get());
        }

        String text = request.getEssayText() != null ? request.getEssayText() : answer.getAnswerText();
        if (text == null || text.isBlank()) {
            throw new BadRequestException("No essay text to score");
        }

        float overall = mockOverall6To9();
        float grammarScore = jitterAround(overall);
        float vocabularyScore = jitterAround(overall);
        float coherenceScore = jitterAround(overall);
        String feedback = buildWritingFeedback(grammarScore, vocabularyScore, coherenceScore, overall);

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
        Answer answer = answerRepository.findById(request.getAnswerId())
                .orElseThrow(() -> new NotFoundException("Answer", request.getAnswerId()));

        var existingSpeaking = aiResultRepository.findByAnswer(answer);
        if (existingSpeaking.isPresent()) {
            return toAiScoreResponse(existingSpeaking.get());
        }

        String audioUrl = request.getAudioUrl() != null ? request.getAudioUrl() : answer.getSpeakingAudioUrl();
        if (audioUrl == null || audioUrl.isBlank()) {
            throw new BadRequestException("No audio URL to score");
        }

        float overall = mockOverall6To9();
        float pronunciationScore = jitterAround(overall);
        float fluencyScore = jitterAround(overall);
        float grammarScore = jitterAround(overall);
        String feedback = buildSpeakingFeedback(pronunciationScore, fluencyScore, grammarScore, overall);

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

}
