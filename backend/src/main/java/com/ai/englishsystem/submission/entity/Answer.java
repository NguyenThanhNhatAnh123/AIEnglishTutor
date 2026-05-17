package com.ai.englishsystem.submission.entity;

import com.ai.englishsystem.exam.entity.Question;
import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;

@Entity
@Table(
        name = "answers",
        uniqueConstraints = {
                @UniqueConstraint(name = "uk_answers_submission_question", columnNames = {"submission_id", "question_id"})
        }
)
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Answer {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "submission_id", nullable = false)
    @JsonIgnore
    private Submission submission;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "question_id", nullable = false)
    @JsonIgnore
    private Question question;

    @Column(name = "answer_text", columnDefinition = "TEXT")
    private String answerText;

    @Column(name = "selected_option_id")
    private Integer selectedOptionId;

    @Column(name = "speaking_audio_url", length = 255)
    private String speakingAudioUrl;

    @Column(name = "speaking_duration_seconds")
    private Integer speakingDurationSeconds;

    @Column(name = "speaking_format", length = 16)
    private String speakingFormat;

    @Column(name = "image_url", length = 500)
    private String imageUrl;

    @Column(name = "created_at")
    private LocalDateTime createdAt;

    @PrePersist
    protected void onCreate() {
        this.createdAt = LocalDateTime.now();
    }
}
