package com.ai.englishsystem.exam.entity;

import com.ai.englishsystem.teacher.entity.Teacher;
import com.ai.englishsystem.classmodule.entity.ClassEntity;
import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "exams")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Exam {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer id;

    @Column(nullable = false, length = 255)
    private String title;

    @Column(columnDefinition = "TEXT")
    private String description;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "teacher_id", nullable = false)
    @JsonIgnore
    private Teacher teacher;

    @Column(name = "duration_minutes")
    private Integer durationMinutes;

    @Column(length = 20)
    @Builder.Default
    private String status = "DRAFT";

    @Enumerated(EnumType.STRING)
    @Column(name = "exam_type", nullable = false, length = 20)
    @Builder.Default
    private ExamType examType = ExamType.PRACTICE;

    /** Null means unlimited attempts. */
    @Column(name = "max_attempts")
    private Integer maxAttempts;

    @Column(name = "created_at")
    private LocalDateTime createdAt;

    @OneToMany(mappedBy = "exam", cascade = CascadeType.ALL, orphanRemoval = true)
    @Builder.Default
    @JsonIgnore
    private List<ExamSection> sections = new ArrayList<>();

    /**
     * Empty = no class restriction (any student can take the exam).
     */
    @ManyToMany
    @JoinTable(
            name = "exam_allowed_classes",
            joinColumns = @JoinColumn(name = "exam_id"),
            inverseJoinColumns = @JoinColumn(name = "class_id")
    )
    @Builder.Default
    @JsonIgnore
    private List<ClassEntity> allowedClasses = new ArrayList<>();

    @PrePersist
    protected void onCreate() {
        this.createdAt = LocalDateTime.now();
    }
}
