package com.ai.englishsystem.result.service;

import com.ai.englishsystem.ai.entity.AiResult;
import com.ai.englishsystem.ai.repository.AiResultRepository;
import com.ai.englishsystem.common.exception.NotFoundException;
import com.ai.englishsystem.common.security.AccessControlService;
import com.ai.englishsystem.common.util.SecurityUtils;
import com.ai.englishsystem.result.dto.ScoreResponse;
import com.ai.englishsystem.result.entity.Feedback;
import com.ai.englishsystem.result.entity.Score;
import com.ai.englishsystem.result.entity.WritingReviewStatus;
import com.ai.englishsystem.result.repository.FeedbackRepository;
import com.ai.englishsystem.result.repository.ScoreRepository;
import com.ai.englishsystem.submission.entity.Answer;
import com.ai.englishsystem.submission.entity.Submission;
import com.ai.englishsystem.submission.repository.AnswerRepository;
import com.ai.englishsystem.submission.repository.SubmissionRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class ScoreService {

    private final ScoreRepository scoreRepository;
    private final SubmissionRepository submissionRepository;
    private final AnswerRepository answerRepository;
    private final AiResultRepository aiResultRepository;
    private final FeedbackRepository feedbackRepository;
    private final AccessControlService accessControlService;

    @Transactional(readOnly = true)
    public ScoreResponse getBySubmissionId(Integer submissionId) {
        Submission submission = submissionRepository.findWithAssociationsById(submissionId)
                .orElseThrow(() -> new NotFoundException("Submission", submissionId));

        accessControlService.assertCurrentUserCanViewSubmission(
                submission,
                "Cannot view scores for another teacher's exam",
                "Cannot view another student's score",
                "Cannot view this score"
        );
        boolean studentViewer = SecurityUtils.hasRole("STUDENT");

        Score score = scoreRepository.findFirstBySubmissionOrderByIdAsc(submission)
                .orElseThrow(() -> new NotFoundException("Score not found for submission"));
        return toResponse(score, studentViewer);
    }

    private ScoreResponse toResponse(Score score, boolean studentViewer) {
        Submission submission = score.getSubmission();
        List<Answer> answers = answerRepository.findBySubmissionFetchQuestion(submission);
        Map<Integer, Feedback> feedbackByAnswerId = feedbackRepository.findByAnswerIn(answers).stream()
                .filter(f -> f.getAnswer() != null && f.getAnswer().getId() != null)
                .collect(Collectors.toMap(f -> f.getAnswer().getId(), Function.identity()));
        Map<Integer, AiResult> aiResultByAnswerId = aiResultRepository.findByAnswerIn(answers).stream()
                .filter(r -> r.getAnswer() != null && r.getAnswer().getId() != null)
                .collect(Collectors.toMap(r -> r.getAnswer().getId(), Function.identity()));

        ReviewSummary writingSummary = summarizeReviewByType(answers, feedbackByAnswerId, "WRITING");
        ReviewSummary speakingSummary = summarizeReviewByType(answers, feedbackByAnswerId, "SPEAKING");

        Float writingScore = resolveSectionScore(score.getWritingScore(), writingSummary, studentViewer);
        Float speakingScore = resolveSectionScore(score.getSpeakingScore(), speakingSummary, studentViewer);
        Float totalScore = resolveVisibleTotalScore(
                score.getMcScore(),
                writingScore,
                speakingScore,
                studentViewer,
                score.getTotalScore(),
                writingSummary,
                speakingSummary
        );
        String feedback = resolveFeedback(answers, feedbackByAnswerId, aiResultByAnswerId, studentViewer);

        String writingReviewStatus = writingSummary.totalAnswers() == 0
                ? "NOT_REQUIRED"
                : (writingSummary.allPublished() ? "PUBLISHED" : "DRAFT");
        String speakingReviewStatus = speakingSummary.totalAnswers() == 0
                ? "NOT_REQUIRED"
                : (speakingSummary.allPublished() ? "PUBLISHED" : "DRAFT");

        String waitingMessage = "Awaiting teacher review and publication.";

        return ScoreResponse.builder()
                .id(score.getId())
                .submissionId(submission.getId())
                .mcScore(score.getMcScore())
                .writingScore(writingScore)
                .speakingScore(speakingScore)
                .totalScore(totalScore)
                .feedback(feedback)
                .tabSwitchCount(submission.getTabSwitchCount())
                .focusLossCount(submission.getFocusLossCount())
                .copyPasteCount(submission.getCopyPasteCount())
                .suspiciousEventCount(submission.getSuspiciousEventCount())
                .deviceType(submission.getDeviceType())
                .deviceLabel(submission.getDeviceLabel())
                .gradedBy(score.getGradedBy())
                .gradedAt(score.getGradedAt())
                .writingReviewStatus(writingReviewStatus)
                .writingReviewPublished(writingSummary.totalAnswers() == 0 || writingSummary.allPublished())
                .writingReviewMessage(studentViewer && writingSummary.totalAnswers() > 0 && !writingSummary.allPublished() ? waitingMessage : null)
                .speakingReviewStatus(speakingReviewStatus)
                .speakingReviewPublished(speakingSummary.totalAnswers() == 0 || speakingSummary.allPublished())
                .speakingReviewMessage(studentViewer && speakingSummary.totalAnswers() > 0 && !speakingSummary.allPublished() ? waitingMessage : null)
                .build();
    }

    private String resolveFeedback(
            List<Answer> answers,
            Map<Integer, Feedback> feedbackByAnswerId,
            Map<Integer, AiResult> aiResultByAnswerId,
            boolean studentViewer
    ) {
        if (answers.isEmpty()) {
            return null;
        }

        String joined = answers.stream()
                .map(answer -> formatFeedback(answer, feedbackByAnswerId.get(answer.getId()), aiResultByAnswerId.get(answer.getId()), studentViewer))
                .filter(this::hasText)
                .collect(Collectors.joining("\n\n"));

        return hasText(joined) ? joined : null;
    }

    private String formatFeedback(Answer answer, Feedback feedback, AiResult aiResult, boolean studentViewer) {
        boolean subjective = isWritingQuestion(answer) || isSpeakingQuestion(answer);
        if (studentViewer && subjective && !isPublished(feedback)) {
            return null;
        }

        String text = null;
        if (feedback != null) {
            if (subjective) {
                if (isPublished(feedback) && hasText(feedback.getTeacherFeedback())) {
                    text = feedback.getTeacherFeedback().trim();
                } else if (!studentViewer && hasText(feedback.getAiFeedback())) {
                    text = feedback.getAiFeedback().trim();
                }
            } else if (hasText(feedback.getAiFeedback())) {
                text = feedback.getAiFeedback().trim();
            }
        }

        if (!hasText(text) && (!studentViewer || !subjective || isPublished(feedback)) && aiResult != null && hasText(aiResult.getFeedback())) {
            text = aiResult.getFeedback().trim();
        }

        if (!hasText(text)) {
            return null;
        }

        Integer questionId = answer.getQuestion() != null ? answer.getQuestion().getId() : null;
        return questionId != null ? "Question #" + questionId + ": " + text : text;
    }

    private ReviewSummary summarizeReviewByType(
            List<Answer> answers,
            Map<Integer, Feedback> feedbackByAnswerId,
            String questionType
    ) {
        int totalAnswers = 0;
        int publishedAnswers = 0;
        float publishedScoreSum = 0f;
        int publishedScoreCount = 0;

        for (Answer answer : answers) {
            if (!isQuestionType(answer, questionType)) {
                continue;
            }
            totalAnswers++;
            Feedback feedback = feedbackByAnswerId.get(answer.getId());
            if (!isPublished(feedback)) {
                continue;
            }
            publishedAnswers++;
            if (feedback.getPublishedScore() != null) {
                publishedScoreSum += feedback.getPublishedScore();
                publishedScoreCount++;
            }
        }

        boolean allPublished = totalAnswers == 0 || publishedAnswers == totalAnswers;
        Float publishedAverage = publishedScoreCount > 0 ? publishedScoreSum / publishedScoreCount : null;
        return new ReviewSummary(totalAnswers, allPublished, publishedAverage);
    }

    private Float resolveSectionScore(Float persistedScore, ReviewSummary summary, boolean studentViewer) {
        if (!studentViewer) {
            return persistedScore != null ? persistedScore : summary.publishedAverageScore();
        }
        if (!summary.allPublished()) {
            return null;
        }
        return summary.publishedAverageScore() != null ? summary.publishedAverageScore() : persistedScore;
    }

    private Float resolveVisibleTotalScore(
            Float mcScore,
            Float writingScore,
            Float speakingScore,
            boolean studentViewer,
            Float persistedTotal,
            ReviewSummary writingSummary,
            ReviewSummary speakingSummary
    ) {
        if (!studentViewer) {
            return persistedTotal;
        }
        boolean subjectivePending = (writingSummary.totalAnswers() > 0 && !writingSummary.allPublished())
                || (speakingSummary.totalAnswers() > 0 && !speakingSummary.allPublished());
        if (subjectivePending) {
            return null;
        }
        return average(mcScore, writingScore, speakingScore);
    }

    private Float average(Float mc, Float writing, Float speaking) {
        float sum = 0f;
        int count = 0;
        if (mc != null) {
            sum += mc;
            count++;
        }
        if (writing != null) {
            sum += writing;
            count++;
        }
        if (speaking != null) {
            sum += speaking;
            count++;
        }
        return count > 0 ? sum / count : 0f;
    }

    private boolean isPublished(Feedback feedback) {
        return feedback != null && feedback.getReviewStatus() == WritingReviewStatus.PUBLISHED;
    }

    private boolean isWritingQuestion(Answer answer) {
        return isQuestionType(answer, "WRITING");
    }

    private boolean isSpeakingQuestion(Answer answer) {
        return isQuestionType(answer, "SPEAKING");
    }

    private boolean isQuestionType(Answer answer, String expectedType) {
        String questionType = answer.getQuestion() != null ? answer.getQuestion().getQuestionType() : null;
        return questionType != null && expectedType.equalsIgnoreCase(questionType.trim());
    }

    private boolean hasText(String value) {
        return value != null && !value.isBlank();
    }

    private record ReviewSummary(int totalAnswers, boolean allPublished, Float publishedAverageScore) {
    }
}
