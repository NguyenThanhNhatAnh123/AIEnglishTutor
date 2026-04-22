package com.ai.englishsystem.exam.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ExamSectionRequest {

    @NotBlank(message = "Section name is required")
    private String name;

    /** READING, LISTENING, WRITING, or SPEAKING */
    @NotBlank(message = "Section type is required")
    private String sectionType;

    /** If omitted, appends after the current last section order. */
    private Integer orderIndex;
}
