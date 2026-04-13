package com.ai.englishsystem.result.repository;

import com.ai.englishsystem.result.entity.Score;
import com.ai.englishsystem.submission.entity.Submission;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface ScoreRepository extends JpaRepository<Score, Integer> {

    Optional<Score> findBySubmission(Submission submission);

    /** Prefer when legacy DBs may contain duplicate rows per submission before V002 unique key */
    Optional<Score> findFirstBySubmissionOrderByIdAsc(Submission submission);
}
