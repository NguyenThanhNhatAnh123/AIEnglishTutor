package com.ai.englishsystem.analytics.dto;

import com.ai.englishsystem.submission.dto.SubmissionListResponse;
import com.ai.englishsystem.submission.entity.SubmissionStatus;

import java.time.LocalDateTime;

public record TeacherDashboardSubmissionRow(
        Integer id,
        Integer examId,
        String examTitle,
        Integer studentId,
        String studentName,
        SubmissionStatus status,
        LocalDateTime startTime,
        LocalDateTime submitTime,
        LocalDateTime endTime,
        Integer durationSeconds,
        Integer answeredQuestions,
        Integer totalQuestions,
        Integer completionPercent,
        Integer tabSwitchCount,
        Integer focusLossCount,
        Integer copyPasteCount,
        Integer suspiciousEventCount,
        String deviceType,
        String deviceLabel,
        Float totalScore
) {
    public SubmissionListResponse toResponse() {
        return SubmissionListResponse.builder()
                .id(id)
                .examId(examId)
                .examTitle(examTitle)
                .studentId(studentId)
                .studentName(studentName)
                .status(status != null ? status.name() : null)
                .startTime(startTime)
                .submitTime(submitTime)
                .endTime(endTime != null ? endTime : submitTime)
                .durationSeconds(durationSeconds)
                .answeredQuestions(answeredQuestions)
                .totalQuestions(totalQuestions)
                .completionPercent(completionPercent)
                .tabSwitchCount(tabSwitchCount)
                .focusLossCount(focusLossCount)
                .copyPasteCount(copyPasteCount)
                .suspiciousEventCount(suspiciousEventCount)
                .deviceType(deviceType)
                .deviceLabel(deviceLabel)
                .totalScore(totalScore)
                .build();
    }
}
