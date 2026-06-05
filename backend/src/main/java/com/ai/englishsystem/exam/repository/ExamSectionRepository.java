package com.ai.englishsystem.exam.repository;

import com.ai.englishsystem.exam.entity.ExamSection;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface ExamSectionRepository extends JpaRepository<ExamSection, Integer> {
    @Query("""
            SELECT s.id, s.name, s.sectionType, s.orderIndex, COUNT(q.id)
            FROM ExamSection s
            LEFT JOIN s.questions q
            WHERE s.exam.id = :examId
            GROUP BY s.id, s.name, s.sectionType, s.orderIndex
            ORDER BY COALESCE(s.orderIndex, 0), s.id
            """)
    List<Object[]> findSummaryRowsByExamId(@Param("examId") Integer examId);

    @Query("SELECT COUNT(s.id) FROM ExamSection s WHERE s.exam.id = :examId")
    long countByExamId(@Param("examId") Integer examId);

    @Query("""
            SELECT s.name
            FROM ExamSection s
            LEFT JOIN s.questions q
            WHERE s.exam.id = :examId
            GROUP BY s.id, s.name
            HAVING COUNT(q.id) = 0
            """)
    List<String> findSectionNamesWithoutQuestions(@Param("examId") Integer examId);

    @Query("SELECT COUNT(q.id) FROM Question q WHERE q.section.id = :sectionId")
    long countQuestionsBySectionId(@Param("sectionId") Integer sectionId);
}
