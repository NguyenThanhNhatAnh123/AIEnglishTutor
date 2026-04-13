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
public class StudentExamQuestionResponse {
    private Integer id;
    private Integer sectionId;
    private String questionText;
    private String questionType;
    private Integer points;
    private String audioUrl;
    private LocalDateTime createdAt;
    private List<StudentExamOptionResponse> options;
}
