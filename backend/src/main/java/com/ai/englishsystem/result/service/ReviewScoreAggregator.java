package com.ai.englishsystem.result.service;

import com.ai.englishsystem.result.entity.Feedback;
import com.ai.englishsystem.result.entity.Score;
import com.ai.englishsystem.result.entity.WritingReviewStatus;
import com.ai.englishsystem.result.repository.FeedbackRepository;
import com.ai.englishsystem.result.repository.ScoreRepository;
import com.ai.englishsystem.submission.entity.Answer;
import com.ai.englishsystem.submission.entity.Submission;
import com.ai.englishsystem.submission.repository.AnswerRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class ReviewScoreAggregator {

    private final ScoreRepository scoreRepository;
    private final AnswerRepository answerRepository;
    private final FeedbackRepository feedbackRepository;

    @Transactional
    public void refreshSubjectiveScore(Submission submission, String questionType, Integer graderUserId) {
        Score score = scoreRepository.findFirstBySubmissionOrderByIdAsc(submission)
                .orElseGet(() -> Score.builder().submission(submission).build());

        SectionScore sectionScore = calculatePublishedAverage(submission, questionType);
        if ("WRITING".equals(normalizeType(questionType))) {
            score.setWritingScore(sectionScore.allPublished() ? sectionScore.averageScore() : null);
        } else if ("SPEAKING".equals(normalizeType(questionType))) {
            score.setSpeakingScore(sectionScore.allPublished() ? sectionScore.averageScore() : null);
        }

        score.setTotalScore(calculateTotal(score.getMcScore(), score.getWritingScore(), score.getSpeakingScore()));
        score.setGradedBy(graderUserId);
        score.setGradedAt(LocalDateTime.now());
        scoreRepository.save(score);
    }

    private SectionScore calculatePublishedAverage(Submission submission, String questionType) {
        List<Answer> answers = answerRepository.findBySubmissionFetchQuestion(submission).stream()
                .filter(answer -> normalizeType(questionType).equals(normalizeType(
                        answer.getQuestion() != null ? answer.getQuestion().getQuestionType() : null)))
                .toList();

        if (answers.isEmpty()) {
            return new SectionScore(true, null);
        }

        Map<Integer, Feedback> feedbackByAnswerId = feedbackRepository.findByAnswerIn(answers).stream()
                .filter(feedback -> feedback.getAnswer() != null && feedback.getAnswer().getId() != null)
                .collect(Collectors.toMap(feedback -> feedback.getAnswer().getId(), Function.identity(), (a, b) -> a));
        float sum = 0f;
        int count = 0;
        boolean allPublished = true;

        for (Answer answer : answers) {
            Feedback feedback = feedbackByAnswerId.get(answer.getId());
            if (feedback == null || feedback.getReviewStatus() != WritingReviewStatus.PUBLISHED) {
                allPublished = false;
                continue;
            }
            if (feedback.getPublishedScore() != null) {
                sum += feedback.getPublishedScore();
                count++;
            }
        }

        return new SectionScore(allPublished, count > 0 ? sum / count : null);
    }

    private static float calculateTotal(Float mc, Float writing, Float speaking) {
        List<Float> parts = new ArrayList<>();
        if (mc != null) parts.add(mc);
        if (writing != null) parts.add(writing);
        if (speaking != null) parts.add(speaking);
        if (parts.isEmpty()) {
            return 0f;
        }
        float sum = 0f;
        for (Float part : parts) {
            sum += part;
        }
        return sum / parts.size();
    }

    private static String normalizeType(String questionType) {
        return questionType == null ? "" : questionType.trim().toUpperCase();
    }

    private record SectionScore(boolean allPublished, Float averageScore) {
    }
}
