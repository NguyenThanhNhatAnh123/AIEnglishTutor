package com.ai.englishsystem.exam.dto.student;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class StudentExamSectionResponse {
    private Integer id;
    private String name;
    private String sectionType;
    private Integer orderIndex;
    private List<StudentExamQuestionResponse> questions;
}
