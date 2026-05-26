package com.ai.learningservice.learning.entity;

public enum StudyStatus {
    NEW("new"),
    LEARNING("learning"),
    REVIEW("review"),
    SUSPENDED("suspended");

    private final String value;

    StudyStatus(String value) {
        this.value = value;
    }

    public String value() {
        return value;
    }

    public static StudyStatus fromValue(String value) {
        for (StudyStatus status : values()) {
            if (status.value.equalsIgnoreCase(value)) {
                return status;
            }
        }
        throw new IllegalArgumentException("Unsupported study status: " + value);
    }
}
