package com.ai.englishsystem.submission.dto;

import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class StartSubmissionRequest {
    @NotNull(message = "Exam ID is required")
    private Integer examId;
}
