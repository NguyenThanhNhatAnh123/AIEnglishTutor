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
public class SubmissionResponse {
    private Integer id;
    private Integer examId;
    private Integer studentId;
    private Integer attemptId;
    private Integer durationMinutes;
    private LocalDateTime deadlineAt;

    /** Wall-clock end time in milliseconds (server default zone) for client countdown sync */
    private Long deadlineEpochMs;

    private LocalDateTime startTime;
    private LocalDateTime submitTime;
    private String status;
}
