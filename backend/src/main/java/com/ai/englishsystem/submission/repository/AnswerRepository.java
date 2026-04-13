package com.ai.englishsystem.submission.repository;

import com.ai.englishsystem.exam.entity.Question;
import com.ai.englishsystem.submission.entity.Answer;
import com.ai.englishsystem.submission.entity.Submission;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface AnswerRepository extends JpaRepository<Answer, Integer> {
    List<Answer> findBySubmission(Submission submission);

    @EntityGraph(attributePaths = {"question"})
    @Query("SELECT a FROM Answer a WHERE a.submission = :sub")
    List<Answer> findBySubmissionFetchQuestion(@Param("sub") Submission submission);

    Optional<Answer> findBySubmissionAndQuestion(Submission submission, Question question);
}
