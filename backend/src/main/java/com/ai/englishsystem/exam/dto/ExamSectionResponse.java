package com.ai.englishsystem.exam.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ExamSectionResponse {
    private Integer id;
    private String name;
    private Integer orderIndex;
    private List<QuestionResponse> questions;
}
