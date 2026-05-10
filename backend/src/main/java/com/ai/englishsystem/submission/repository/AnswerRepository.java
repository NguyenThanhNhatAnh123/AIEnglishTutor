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

    @EntityGraph(attributePaths = {"question", "question.options"})
    @Query("SELECT a FROM Answer a WHERE a.submission = :sub")
    List<Answer> findBySubmissionFetchQuestion(@Param("sub") Submission submission);

    @EntityGraph(attributePaths = {"question", "question.options", "submission"})
    @Query("SELECT a FROM Answer a WHERE a.submission.id IN :submissionIds")
    List<Answer> findBySubmissionIdInFetchQuestion(@Param("submissionIds") List<Integer> submissionIds);

    Optional<Answer> findBySubmissionAndQuestion(Submission submission, Question question);

    @Query("""
            SELECT DISTINCT a FROM Answer a
            JOIN FETCH a.submission s
            JOIN FETCH s.exam e
            JOIN FETCH e.teacher t
            JOIN FETCH t.user
            JOIN FETCH s.student st
            JOIN FETCH st.user
            JOIN FETCH a.question
            WHERE a.id = :id
            """)
    Optional<Answer> findWithSubmissionGraphById(@Param("id") Integer id);
}
