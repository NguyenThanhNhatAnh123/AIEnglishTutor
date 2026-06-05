package com.ai.englishsystem.exam.dto;

import jakarta.validation.Valid;
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
public class ExamRequest {

    @NotBlank(message = "Title is required")
    private String title;

    private String description;

    @NotNull(message = "teacherId is required")
    private Integer teacherId;

    private Integer durationMinutes;

    private String status;

    /** OFFICIAL or PRACTICE (default PRACTICE when omitted). */
    private String examType;

    /** Null = unlimited attempts (except OFFICIAL defaults to 1). */
    private Integer maxAttempts;

    /** Required before publishing ACTIVE; only students in these classes can take this exam. */
    private List<Integer> allowedClassIds;

    /** Optional aggregate write payload. Null means keep existing sections on update. */
    private List<@Valid ExamSectionRequest> sections;
}
