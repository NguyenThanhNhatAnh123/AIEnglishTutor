package com.ai.englishsystem.exam.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class QuestionRequest {
    @NotNull
    private Integer sectionId;

    @NotBlank
    private String questionText;

    private String questionType;

    private Integer points;

    private List<QuestionOptionRequest> options;
}
