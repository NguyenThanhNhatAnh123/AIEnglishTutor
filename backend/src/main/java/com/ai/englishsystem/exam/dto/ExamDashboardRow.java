package com.ai.englishsystem.exam.dto;

import com.ai.englishsystem.exam.entity.ExamType;

import java.time.LocalDateTime;

public record ExamDashboardRow(
        Integer id,
        String title,
        String description,
        Integer teacherId,
        String teacherName,
        Integer durationMinutes,
        String status,
        ExamType examType,
        Integer maxAttempts,
        LocalDateTime createdAt,
        Long sectionCount,
        Long questionCount,
        Boolean canManage
) {
    public ExamResponse toResponse() {
        return ExamResponse.builder()
                .id(id)
                .title(title)
                .description(description)
                .teacherId(teacherId)
                .teacherName(teacherName)
                .durationMinutes(durationMinutes)
                .status(status)
                .examType(examType != null ? examType.name() : ExamType.PRACTICE.name())
                .maxAttempts(maxAttempts)
                .createdAt(createdAt)
                .sectionCount(Math.toIntExact(sectionCount != null ? sectionCount : 0L))
                .questionCount(Math.toIntExact(questionCount != null ? questionCount : 0L))
                .canManage(canManage)
                .build();
    }
}
