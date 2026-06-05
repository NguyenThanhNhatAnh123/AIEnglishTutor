package com.ai.englishsystem.classmodule.dto;

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
public class ClassRequest {
    @NotBlank
    private String name;

    @NotNull(message = "teacherId is required")
    private Integer teacherId;

    private String description;

    /** Optional roster sync. Null means leave enrollments unchanged on update. */
    private List<Integer> studentIds;
}
