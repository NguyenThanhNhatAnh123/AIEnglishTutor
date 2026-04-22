package com.ai.englishsystem.exam.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ExamSectionSummaryResponse {
    private Integer id;
    private String name;
    private String sectionType;
    private Integer orderIndex;
    private Integer questionCount;
}
