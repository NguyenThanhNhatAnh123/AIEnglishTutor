package com.ai.englishsystem.classmodule.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ClassResponse {
    private Integer id;
    private String name;
    private Integer teacherId;
    private String teacherName;
    private String description;
    private LocalDateTime createdAt;
}
