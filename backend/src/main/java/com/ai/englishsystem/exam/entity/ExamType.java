package com.ai.englishsystem.exam.entity;

/**
 * OFFICIAL: one completed submission per student; PRACTICE: unlimited attempts.
 */
public enum ExamType {
    OFFICIAL,
    PRACTICE;

    public static ExamType fromString(String raw) {
        if (raw == null || raw.isBlank()) {
            return PRACTICE;
        }
        return ExamType.valueOf(raw.trim().toUpperCase());
    }
}
