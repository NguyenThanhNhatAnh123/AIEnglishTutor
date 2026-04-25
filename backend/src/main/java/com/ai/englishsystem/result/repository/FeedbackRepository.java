package com.ai.englishsystem.result.repository;

import com.ai.englishsystem.result.entity.Feedback;
import com.ai.englishsystem.submission.entity.Answer;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface FeedbackRepository extends JpaRepository<Feedback, Integer> {
    Optional<Feedback> findByAnswer(Answer answer);

    void deleteByAnswerIn(List<Answer> answers);
}
