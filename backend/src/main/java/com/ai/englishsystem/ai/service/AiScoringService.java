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

import java.util.Random;

/**
 * AI Scoring Service - evaluates writing and speaking submissions.
 * Production: Integrate with OpenAI API, Google Speech-to-Text, or similar services.
 * This implementation provides rule-based/mock scoring for demonstration.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class AiScoringService {

    private final AnswerRepository answerRepository;
    private final AiResultRepository aiResultRepository;

    /**
     * Score writing essay: grammar, vocabulary, coherence, overall.
     */
    @Transactional
    public AiScoreResponse scoreWriting(WritingScoreRequest request) {
        Answer answer = answerRepository.findById(request.getAnswerId())
                .orElseThrow(() -> new NotFoundException("Answer", request.getAnswerId()));

        String text = request.getEssayText() != null ? request.getEssayText() : answer.getAnswerText();
        if (text == null || text.isBlank()) {
            throw new BadRequestException("No essay text to score");
        }

        // Rule-based scoring (replace with OpenAI/LLM in production)
        float grammarScore = scoreGrammar(text);
        float vocabularyScore = scoreVocabulary(text);
        float coherenceScore = scoreCoherence(text);
        float overallScore = (grammarScore + vocabularyScore + coherenceScore) / 3;

        String feedback = buildWritingFeedback(grammarScore, vocabularyScore, coherenceScore, overallScore);

        AiResult aiResult = AiResult.builder()
                .answer(answer)
                .grammarScore(grammarScore)
                .vocabularyScore(vocabularyScore)
                .fluencyScore(null)
                .pronunciationScore(null)
                .coherenceScore(coherenceScore)
                .overallScore(overallScore)
                .feedback(feedback)
                .build();

        aiResult = aiResultRepository.save(aiResult);

        return AiScoreResponse.builder()
                .aiResultId(aiResult.getId())
                .grammarScore(grammarScore)
                .vocabularyScore(vocabularyScore)
                .fluencyScore(null)
                .pronunciationScore(null)
                .coherenceScore(coherenceScore)
                .overallScore(overallScore)
                .feedback(feedback)
                .build();
    }

    /**
     * Score speaking: pronunciation, fluency, grammar.
     */
    @Transactional
    public AiScoreResponse scoreSpeaking(SpeakingScoreRequest request) {
        Answer answer = answerRepository.findById(request.getAnswerId())
                .orElseThrow(() -> new NotFoundException("Answer", request.getAnswerId()));

        String audioUrl = request.getAudioUrl() != null ? request.getAudioUrl() : answer.getAudioUrl();
        if (audioUrl == null || audioUrl.isBlank()) {
            throw new BadRequestException("No audio URL to score");
        }

        // Mock scoring - production: use Speech-to-Text + pronunciation analysis API
        float pronunciationScore = 5 + new Random().nextFloat() * 5;
        float fluencyScore = 5 + new Random().nextFloat() * 5;
        float grammarScore = 5 + new Random().nextFloat() * 5;
        float overallScore = (pronunciationScore + fluencyScore + grammarScore) / 3;

        String feedback = buildSpeakingFeedback(pronunciationScore, fluencyScore, grammarScore, overallScore);

        AiResult aiResult = AiResult.builder()
                .answer(answer)
                .grammarScore(grammarScore)
                .vocabularyScore(null)
                .fluencyScore(fluencyScore)
                .pronunciationScore(pronunciationScore)
                .coherenceScore(null)
                .overallScore(overallScore)
                .feedback(feedback)
                .build();

        aiResult = aiResultRepository.save(aiResult);

        return AiScoreResponse.builder()
                .aiResultId(aiResult.getId())
                .grammarScore(grammarScore)
                .vocabularyScore(null)
                .fluencyScore(fluencyScore)
                .pronunciationScore(pronunciationScore)
                .coherenceScore(null)
                .overallScore(overallScore)
                .feedback(feedback)
                .build();
    }

    private float scoreGrammar(String text) {
        int wordCount = text.split("\\s+").length;
        float base = 5f;
        if (wordCount < 50) base = 4f;
        else if (wordCount > 200) base = 8f;
        else base = 5 + (wordCount - 50) * 0.02f;
        return Math.min(10, Math.max(0, base + (new Random().nextFloat() - 0.5f) * 2));
    }

    private float scoreVocabulary(String text) {
        String[] words = text.split("\\s+");
        int unique = (int) java.util.Arrays.stream(words).distinct().count();
        float diversity = words.length > 0 ? (float) unique / words.length : 0;
        return Math.min(10, Math.max(0, 5 + diversity * 3 + (new Random().nextFloat() - 0.5f)));
    }

    private float scoreCoherence(String text) {
        int sentences = text.split("[.!?]+").length;
        float base = sentences >= 3 ? 6 : 4;
        return Math.min(10, Math.max(0, base + (new Random().nextFloat() - 0.5f) * 2));
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
