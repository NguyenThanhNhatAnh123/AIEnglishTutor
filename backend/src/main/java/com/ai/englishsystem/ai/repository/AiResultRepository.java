package com.ai.englishsystem.ai.repository;

import com.ai.englishsystem.ai.entity.AiResult;
import com.ai.englishsystem.submission.entity.Answer;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface AiResultRepository extends JpaRepository<AiResult, Integer> {
    Optional<AiResult> findByAnswer(Answer answer);

    List<AiResult> findByAnswerIn(List<Answer> answers);

    void deleteByAnswerIn(List<Answer> answers);
}
