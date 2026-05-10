package com.ai.englishsystem.submission.repository;

import com.ai.englishsystem.submission.entity.Submission;
import com.ai.englishsystem.submission.entity.SubmissionSuspiciousEvent;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface SubmissionSuspiciousEventRepository extends JpaRepository<SubmissionSuspiciousEvent, Integer> {
    void deleteBySubmission(Submission submission);

    @Modifying
    @Query("DELETE FROM SubmissionSuspiciousEvent sse WHERE sse.submission IN :submissions")
    void deleteBySubmissionIn(@Param("submissions") List<Submission> submissions);
}
