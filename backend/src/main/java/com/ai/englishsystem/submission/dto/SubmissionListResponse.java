package com.ai.englishsystem.submission.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class SubmissionListResponse {
    private Integer id;
    private Integer examId;
    private String examTitle;
    private Integer studentId;
    private String studentName;
    private String status;
    private LocalDateTime startTime;

    /** Same as legacy submit_time; use for "exam ended at". */
    private LocalDateTime submitTime;

    private LocalDateTime endTime;

    /** Seconds from start to end (null while in progress). */
    private Integer durationSeconds;

    private Integer answeredQuestions;

    private Integer totalQuestions;

    private Integer completionPercent;

    private Integer tabSwitchCount;

    private Integer focusLossCount;

    private Integer copyPasteCount;

    private Integer suspiciousEventCount;

    private String deviceType;

    private String deviceLabel;

    private Float totalScore;

    private String writingReviewStatus;

    private String speakingReviewStatus;

    private String subjectiveReviewStatus;

    private Integer writingAnswerCount;

    private Integer speakingAnswerCount;
}
