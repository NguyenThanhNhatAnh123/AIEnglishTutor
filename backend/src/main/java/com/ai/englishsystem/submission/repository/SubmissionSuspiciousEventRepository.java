package com.ai.englishsystem.submission.repository;

import com.ai.englishsystem.submission.entity.Submission;
import com.ai.englishsystem.submission.entity.SubmissionSuspiciousEvent;
import org.springframework.data.jpa.repository.JpaRepository;

public interface SubmissionSuspiciousEventRepository extends JpaRepository<SubmissionSuspiciousEvent, Integer> {
    void deleteBySubmission(Submission submission);
}
