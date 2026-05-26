package com.ai.learningservice.learning.repository;

import com.ai.learningservice.learning.entity.EnrollmentStatus;

public interface EnrollmentDeckId {
    Long getDeckId();

    EnrollmentStatus getStatus();
}
