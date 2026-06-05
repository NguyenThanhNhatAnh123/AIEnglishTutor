package com.ai.englishsystem.submission.mapper;

import com.ai.englishsystem.exam.entity.QuestionOption;
import com.ai.englishsystem.result.entity.Feedback;
import com.ai.englishsystem.result.entity.WritingReviewStatus;
import com.ai.englishsystem.submission.dto.AnswerResponse;
import com.ai.englishsystem.submission.entity.Answer;
import org.springframework.stereotype.Component;

@Component
public class AnswerMapper {

    public AnswerResponse toResponse(Answer answer, Feedback feedback, boolean maskUnpublishedReviewsForStudent) {
        String type = answer.getQuestion() != null ? answer.getQuestion().getQuestionType() : null;
        boolean isWriting = "WRITING".equalsIgnoreCase(type != null ? type.trim() : "");
        boolean isSpeaking = "SPEAKING".equalsIgnoreCase(type != null ? type.trim() : "");
        WritingReviewStatus status = feedback != null && feedback.getReviewStatus() != null
                ? feedback.getReviewStatus() : WritingReviewStatus.DRAFT;
        boolean published = status == WritingReviewStatus.PUBLISHED;
        boolean hideTeacherFields = maskUnpublishedReviewsForStudent && !published;

        String questionText = answer.getQuestion() != null ? answer.getQuestion().getQuestionText() : null;
        String selectedOptionText = resolveSelectedOptionText(answer);

        return AnswerResponse.builder()
                .id(answer.getId())
                .submissionId(answer.getSubmission().getId())
                .questionId(answer.getQuestion().getId())
                .questionText(questionText)
                .questionType(answer.getQuestion().getQuestionType())
                .answerType(answer.getAnswerType() != null ? answer.getAnswerType().name() : null)
                .answerText(answer.getAnswerText())
                .selectedOptionId(answer.getSelectedOptionId())
                .selectedOptionText(selectedOptionText)
                .speakingAudioUrl(answer.getSpeakingAudioUrl())
                .speakingDurationSeconds(answer.getSpeakingDurationSeconds())
                .speakingFormat(answer.getSpeakingFormat())
                .imageUrl(answer.getImageUrl())
                .writingReviewStatus(isWriting ? status.name() : null)
                .writingDraftScore(isWriting && feedback != null && !hideTeacherFields ? feedback.getDraftScore() : null)
                .writingDraftFeedback(isWriting && feedback != null && !hideTeacherFields ? feedback.getAiFeedback() : null)
                .writingPublishedScore(isWriting && feedback != null && published ? feedback.getPublishedScore() : null)
                .writingPublishedFeedback(isWriting && feedback != null && published ? feedback.getTeacherFeedback() : null)
                .writingPublishedAt(isWriting && feedback != null && published ? feedback.getPublishedAt() : null)
                .speakingReviewStatus(isSpeaking ? status.name() : null)
                .speakingDraftScore(isSpeaking && feedback != null && !hideTeacherFields ? feedback.getDraftScore() : null)
                .speakingDraftFeedback(isSpeaking && feedback != null && !hideTeacherFields ? feedback.getAiFeedback() : null)
                .speakingDraftTranscript(isSpeaking && feedback != null && !hideTeacherFields ? feedback.getDraftTranscript() : null)
                .speakingPublishedScore(isSpeaking && feedback != null && published ? feedback.getPublishedScore() : null)
                .speakingPublishedFeedback(isSpeaking && feedback != null && published ? feedback.getTeacherFeedback() : null)
                .speakingPublishedTranscript(isSpeaking && feedback != null && published ? feedback.getPublishedTranscript() : null)
                .speakingPublishedAt(isSpeaking && feedback != null && published ? feedback.getPublishedAt() : null)
                .build();
    }

    private String resolveSelectedOptionText(Answer answer) {
        if (answer.getSelectedOptionId() == null || answer.getQuestion() == null) {
            return null;
        }
        return answer.getQuestion().getOptions().stream()
                .filter(option -> option != null && option.getId() != null
                        && option.getId().equals(answer.getSelectedOptionId()))
                .map(QuestionOption::getOptionText)
                .findFirst()
                .orElse(null);
    }
}
