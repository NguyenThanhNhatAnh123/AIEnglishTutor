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
public class StudentSubmitExamResponse {
    private Integer submissionId;
    private Integer examId;
    private Integer studentId;
    private String status;
    private LocalDateTime submitTime;
    private Float mcScore;
    private Float writingScore;
    private Float speakingScore;
    private Float totalScore;
}
