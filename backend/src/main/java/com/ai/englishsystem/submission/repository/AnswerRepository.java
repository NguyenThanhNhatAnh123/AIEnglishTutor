package com.ai.englishsystem.submission.repository;

import com.ai.englishsystem.exam.entity.Question;
import com.ai.englishsystem.submission.entity.Answer;
import com.ai.englishsystem.submission.entity.Submission;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface AnswerRepository extends JpaRepository<Answer, Integer> {
    List<Answer> findBySubmission(Submission submission);

    Optional<Answer> findBySubmissionAndQuestion(Submission submission, Question question);
}
