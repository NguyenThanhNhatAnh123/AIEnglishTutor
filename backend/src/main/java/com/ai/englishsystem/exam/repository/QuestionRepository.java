package com.ai.englishsystem.exam.repository;

import com.ai.englishsystem.exam.entity.Question;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Collection;
import java.util.List;
import java.util.Optional;

public interface QuestionRepository extends JpaRepository<Question, Integer> {
    @EntityGraph(attributePaths = {"options", "section", "section.exam", "section.exam.teacher", "section.exam.teacher.user"})
    @Query("SELECT q FROM Question q WHERE q.section.exam.teacher.user.id = :userId ORDER BY q.id DESC")
    List<Question> findByTeacherUserId(@Param("userId") Integer userId);

    @EntityGraph(attributePaths = {"options", "section", "section.exam", "section.exam.teacher", "section.exam.teacher.user"})
    @Query("SELECT q FROM Question q WHERE q.section.exam.teacher.user.id = :userId")
    Page<Question> findByTeacherUserId(@Param("userId") Integer userId, Pageable pageable);

    @EntityGraph(attributePaths = {"options", "section", "section.exam", "section.exam.teacher", "section.exam.teacher.user"})
    @Query("SELECT q FROM Question q WHERE q.section.exam.id = :examId ORDER BY q.id DESC")
    List<Question> findByExamId(@Param("examId") Integer examId);

    @EntityGraph(attributePaths = {"options"})
    @Query("SELECT q FROM Question q WHERE q.section.exam.id = :examId")
    List<Question> findScoringQuestionsByExamId(@Param("examId") Integer examId);

    @Query("SELECT COUNT(q.id) FROM Question q WHERE q.section.exam.id = :examId")
    long countByExamId(@Param("examId") Integer examId);

    @Query("""
            SELECT CASE WHEN COUNT(o.id) > 0 THEN true ELSE false END
            FROM Question q
            JOIN q.options o
            WHERE q.id = :questionId AND o.id = :optionId
            """)
    boolean existsOptionForQuestion(
            @Param("questionId") Integer questionId,
            @Param("optionId") Integer optionId);

    @EntityGraph(attributePaths = {"options", "section", "section.exam", "section.exam.teacher", "section.exam.teacher.user"})
    @Query("SELECT q FROM Question q WHERE q.section.exam.id = :examId")
    Page<Question> findByExamId(@Param("examId") Integer examId, Pageable pageable);

    @EntityGraph(attributePaths = {"options", "section", "section.exam", "section.exam.teacher", "section.exam.teacher.user"})
    @Query("SELECT q FROM Question q ORDER BY q.id DESC")
    List<Question> findAllWithAssociations();

    @EntityGraph(attributePaths = {"options", "section", "section.exam", "section.exam.teacher", "section.exam.teacher.user"})
    @Query("SELECT q FROM Question q")
    Page<Question> findAllWithAssociations(Pageable pageable);

    @EntityGraph(attributePaths = {"options", "section", "section.exam", "section.exam.teacher", "section.exam.teacher.user"})
    @Query("SELECT q FROM Question q WHERE q.id = :id")
    Optional<Question> findDetailById(@Param("id") Integer id);

    @EntityGraph(attributePaths = {"section", "section.exam"})
    @Query("SELECT q FROM Question q WHERE q.id = :id")
    Optional<Question> findByIdWithSectionExam(@Param("id") Integer id);

    @EntityGraph(attributePaths = {"options", "section", "section.exam"})
    @Query("SELECT q FROM Question q WHERE q.id IN :ids")
    List<Question> findByIdInWithSectionExam(@Param("ids") Collection<Integer> ids);
}
