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

    /** Present when updating an existing section through the exam aggregate endpoint. */
    private Integer id;

    @NotBlank(message = "Section name is required")
    private String name;

    /** READING, LISTENING, WRITING, or SPEAKING */
    @NotBlank(message = "Section type is required")
    private String sectionType;

    /** If omitted, appends after the current last section order. */
    private Integer orderIndex;
}
