package com.ai.englishsystem.submission.mapper;

import com.ai.englishsystem.submission.dto.SubmissionListResponse;
import com.ai.englishsystem.submission.entity.Submission;
import org.springframework.stereotype.Component;

import java.time.LocalDateTime;

@Component
public class SubmissionMapper {

    public SubmissionListResponse toListResponse(Submission submission, Float totalScore) {
        return toListResponse(submission, totalScore, SubmissionReviewSummary.empty());
    }

    public SubmissionListResponse toListResponse(
            Submission submission,
            Float totalScore,
            SubmissionReviewSummary review
    ) {
        LocalDateTime end = submission.getEndTime() != null ? submission.getEndTime() : submission.getSubmitTime();
        return SubmissionListResponse.builder()
                .id(submission.getId())
                .examId(submission.getExam().getId())
                .examTitle(submission.getExam().getTitle())
                .studentId(submission.getStudent().getId())
                .studentName(submission.getStudent().getUser().getFullName())
                .status(submission.getStatus().name())
                .startTime(submission.getStartTime())
                .submitTime(submission.getSubmitTime())
                .endTime(end)
                .durationSeconds(submission.getDuration())
                .answeredQuestions(submission.getAnsweredQuestions())
                .totalQuestions(submission.getTotalQuestions())
                .completionPercent(submission.getCompletionPercent())
                .tabSwitchCount(submission.getTabSwitchCount())
                .focusLossCount(submission.getFocusLossCount())
                .copyPasteCount(submission.getCopyPasteCount())
                .suspiciousEventCount(submission.getSuspiciousEventCount())
                .deviceType(submission.getDeviceType())
                .deviceLabel(submission.getDeviceLabel())
                .totalScore(totalScore)
                .writingReviewStatus(review.writingStatus())
                .speakingReviewStatus(review.speakingStatus())
                .subjectiveReviewStatus(review.subjectiveStatus())
                .writingAnswerCount(review.writingTotal())
                .speakingAnswerCount(review.speakingTotal())
                .build();
    }
}
