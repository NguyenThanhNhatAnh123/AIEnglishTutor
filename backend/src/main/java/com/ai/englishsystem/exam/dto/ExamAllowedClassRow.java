package com.ai.englishsystem.exam.dto;

public record ExamAllowedClassRow(
        Integer examId,
        Integer classId,
        String className
) {
    public ExamAllowedClassResponse toResponse() {
        return ExamAllowedClassResponse.builder()
                .id(classId)
                .name(className)
                .build();
    }
}
