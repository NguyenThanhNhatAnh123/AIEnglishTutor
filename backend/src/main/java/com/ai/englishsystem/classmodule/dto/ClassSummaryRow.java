package com.ai.englishsystem.classmodule.dto;

import java.time.LocalDateTime;

public record ClassSummaryRow(
        Integer id,
        String name,
        Integer teacherId,
        String teacherName,
        String description,
        LocalDateTime createdAt,
        Long totalStudents
) {
    public ClassResponse toResponse() {
        return ClassResponse.builder()
                .id(id)
                .name(name)
                .teacherId(teacherId)
                .teacherName(teacherName)
                .description(description)
                .createdAt(createdAt)
                .totalStudents(Math.toIntExact(totalStudents != null ? totalStudents : 0L))
                .build();
    }
}
