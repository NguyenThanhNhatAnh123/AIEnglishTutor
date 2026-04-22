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
public class QuestionResponse {
    private Integer id;
    private Integer sectionId;
    private String sectionName;
    private String sectionType;
    private Integer examId;
    private String examTitle;
    private String questionText;
    private String questionType;
    private String listeningAudioUrl;
    private String transcript;
    private Integer points;
    private Integer minWords;
    private Integer maxWords;
    private LocalDateTime createdAt;
    private List<QuestionOptionResponse> options;
}
