package com.ai.englishsystem.exam.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ExamSectionUpdateRequest {

    private String name;
    private Integer orderIndex;
    /** READING, LISTENING, WRITING, or SPEAKING */
    private String sectionType;
}
