package com.ai.englishsystem.exam.repository;

import com.ai.englishsystem.exam.entity.ExamSection;
import com.ai.englishsystem.exam.entity.Question;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface QuestionRepository extends JpaRepository<Question, Integer> {
    List<Question> findBySection(ExamSection section);

    @EntityGraph(attributePaths = {"options", "section", "section.exam", "section.exam.teacher", "section.exam.teacher.user"})
    @Query("SELECT q FROM Question q WHERE q.section.exam.teacher.user.id = :userId ORDER BY q.id DESC")
    List<Question> findByTeacherUserId(@Param("userId") Integer userId);

    @EntityGraph(attributePaths = {"options", "section", "section.exam", "section.exam.teacher", "section.exam.teacher.user"})
    @Query("SELECT q FROM Question q WHERE q.section.exam.id = :examId ORDER BY q.id DESC")
    List<Question> findByExamId(@Param("examId") Integer examId);

    @EntityGraph(attributePaths = {"options", "section", "section.exam", "section.exam.teacher", "section.exam.teacher.user"})
    @Query("SELECT q FROM Question q ORDER BY q.id DESC")
    List<Question> findAllWithAssociations();

    @EntityGraph(attributePaths = {"options", "section", "section.exam", "section.exam.teacher", "section.exam.teacher.user"})
    @Query("SELECT q FROM Question q WHERE q.id = :id")
    Optional<Question> findDetailById(@Param("id") Integer id);
}
