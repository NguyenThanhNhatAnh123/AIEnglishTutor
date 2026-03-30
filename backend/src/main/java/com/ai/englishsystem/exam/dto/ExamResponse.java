package com.ai.englishsystem.exam.dto;

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
public class ExamResponse {
    private Integer id;
    private String title;
    private String description;
    private Integer teacherId;
    private String teacherName;
    private Integer durationMinutes;
    private String status;
    private LocalDateTime createdAt;
    private List<ExamSectionResponse> sections;
}
