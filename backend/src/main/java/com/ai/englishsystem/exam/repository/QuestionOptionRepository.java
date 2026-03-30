package com.ai.englishsystem.exam.repository;

import com.ai.englishsystem.exam.entity.Question;
import com.ai.englishsystem.exam.entity.QuestionOption;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface QuestionOptionRepository extends JpaRepository<QuestionOption, Integer> {
    List<QuestionOption> findByQuestion(Question question);
}
