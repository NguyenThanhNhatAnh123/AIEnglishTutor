package com.ai.englishsystem.result.entity;

import com.ai.englishsystem.submission.entity.Submission;
import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;

@Entity
@Table(name = "scores")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Score {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer id;

    @OneToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "submission_id", nullable = false, unique = true)
    private Submission submission;

    @Column(name = "mc_score")
    private Float mcScore;

    @Column(name = "writing_score")
    private Float writingScore;

    @Column(name = "speaking_score")
    private Float speakingScore;

    @Column(name = "total_score")
    private Float totalScore;

    @Column(name = "graded_by")
    private Integer gradedBy;

    @Column(name = "graded_at")
    private LocalDateTime gradedAt;
}
