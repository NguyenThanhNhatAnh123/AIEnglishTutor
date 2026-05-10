package com.ai.englishsystem.exam.dto.student;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class StudentExamDetailResponse {
    private Integer id;
    private String title;
    private String description;
    private Integer durationMinutes;
    private String status;

    /** OFFICIAL or PRACTICE */
    private String examType;
    /** Null means unlimited attempts. */
    private Integer maxAttempts;

    private LocalDateTime createdAt;
    private List<StudentExamSectionResponse> sections;
}
