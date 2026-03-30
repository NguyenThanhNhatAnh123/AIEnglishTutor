package com.ai.englishsystem.analytics.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;

@Entity
@Table(name = "student_progress")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class StudentProgress {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer id;

    @Column(name = "student_id", nullable = false)
    private Integer studentId;

    @Column(name = "exam_id", nullable = false)
    private Integer examId;

    @Column(name = "average_score")
    private Float averageScore;

    @Column(name = "attempt_count")
    private Integer attemptCount;

    @Column(name = "last_attempt")
    private LocalDateTime lastAttempt;
}
