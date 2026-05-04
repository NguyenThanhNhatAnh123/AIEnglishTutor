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
public class ExamRequest {

    @NotBlank(message = "Title is required")
    private String title;

    private String description;

    // FIX: teacherId removed from @NotNull — the teacher is now resolved from the JWT
    // in ExamService. This field is intentionally kept here (but ignored) for backwards
    // compatibility if older clients still send it — it will simply be ignored.
    private Integer teacherId;

    private Integer durationMinutes;

    private String status;

    /** OFFICIAL or PRACTICE (default PRACTICE when omitted). */
    private String examType;
}
