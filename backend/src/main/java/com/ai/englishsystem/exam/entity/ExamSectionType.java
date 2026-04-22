package com.ai.englishsystem.exam.entity;

public enum ExamSectionType {
    READING,
    LISTENING,
    WRITING,
    SPEAKING;

    public static ExamSectionType fromString(String raw) {
        if (raw == null || raw.isBlank()) {
            throw new IllegalArgumentException("sectionType is required");
        }
        return ExamSectionType.valueOf(raw.trim().toUpperCase());
    }
}
