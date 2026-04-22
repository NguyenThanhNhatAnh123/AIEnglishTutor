package com.ai.englishsystem.submission.entity;

import com.ai.englishsystem.exam.entity.Exam;
import com.ai.englishsystem.exam.entity.ExamAttempt;
import com.ai.englishsystem.student.entity.Student;
import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "submissions")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Submission {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "exam_id", nullable = false)
    private Exam exam;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "student_id", nullable = false)
    private Student student;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "attempt_id")
    private ExamAttempt examAttempt;

    @Column(name = "start_time")
    private LocalDateTime startTime;

    @Column(name = "submit_time")
    private LocalDateTime submitTime;

    /** Wall-clock end when the student submitted or auto-submitted (mirrors submit_time). */
    @Column(name = "end_time")
    private LocalDateTime endTime;

    /** Seconds between start_time and end_time. */
    @Column(name = "duration")
    private Integer duration;

    /** Client-reported seconds at submit (audit); authoritative duration is {@link #duration}. */
    @Column(name = "client_reported_duration")
    private Integer clientReportedDuration;

    /** Number of answered questions captured at submit time. */
    @Column(name = "answered_questions")
    private Integer answeredQuestions;

    /** Total questions in the exam at submit time. */
    @Column(name = "total_questions")
    private Integer totalQuestions;

    /** Rounded completion percentage [0..100]. */
    @Column(name = "completion_percent")
    private Integer completionPercent;

    /** Number of times page visibility became hidden during exam session. */
    @Column(name = "tab_switch_count")
    private Integer tabSwitchCount;

    /** Number of focus-loss events (window blur) recorded by client. */
    @Column(name = "focus_loss_count")
    private Integer focusLossCount;

    /** Number of copy/paste attempts recorded by client. */
    @Column(name = "copy_paste_count")
    private Integer copyPasteCount;

    /** Aggregate suspicious event count sent by client. */
    @Column(name = "suspicious_event_count")
    private Integer suspiciousEventCount;

    /** Device family captured at submit: DESKTOP / MOBILE / TABLET / UNKNOWN. */
    @Column(name = "device_type", length = 20)
    private String deviceType;

    /** Optional user-agent snippet (for teacher review). */
    @Column(name = "device_label", length = 255)
    private String deviceLabel;

    @Enumerated(EnumType.STRING)
    @Column(length = 20, nullable = false)
    @Builder.Default
    private SubmissionStatus status = SubmissionStatus.IN_PROGRESS;

    @OneToMany(mappedBy = "submission", cascade = CascadeType.ALL, orphanRemoval = true)
    @Builder.Default
    @JsonIgnore
    private List<Answer> answers = new ArrayList<>();
}
