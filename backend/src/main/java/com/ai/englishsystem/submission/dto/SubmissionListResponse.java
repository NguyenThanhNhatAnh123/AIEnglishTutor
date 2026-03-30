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
    private LocalDateTime submitTime;
}
