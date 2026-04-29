package com.ai.englishsystem.ai.entity;

import com.ai.englishsystem.submission.entity.Answer;
import com.ai.englishsystem.submission.entity.Submission;
import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;

@Entity
@Table(name = "ai_scoring_logs")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class AiScoringLog {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "answer_id", nullable = false)
    private Answer answer;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "submission_id", nullable = false)
    private Submission submission;

    @Enumerated(EnumType.STRING)
    @Column(name = "scoring_type", nullable = false, length = 20)
    private AiScoringType scoringType;

    @Column(name = "provider", nullable = false, length = 50)
    private String provider;

    @Column(name = "model", length = 100)
    private String model;

    @Column(name = "endpoint", length = 255)
    private String endpoint;

    @Column(name = "request_payload", columnDefinition = "LONGTEXT")
    private String requestPayload;

    @Column(name = "response_body", columnDefinition = "LONGTEXT")
    private String responseBody;

    @Column(name = "http_status")
    private Integer httpStatus;

    @Column(name = "success_flag", nullable = false)
    private Boolean successFlag;

    @Column(name = "latency_ms")
    private Long latencyMs;

    @Column(name = "error_message", columnDefinition = "TEXT")
    private String errorMessage;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;

    @PrePersist
    protected void onCreate() {
        if (createdAt == null) {
            createdAt = LocalDateTime.now();
        }
    }
}
