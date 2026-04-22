package com.ai.englishsystem.exam.repository;

import com.ai.englishsystem.exam.entity.Exam;
import com.ai.englishsystem.teacher.entity.Teacher;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface ExamRepository extends JpaRepository<Exam, Integer> {
    List<Exam> findByTeacher(Teacher teacher);
    List<Exam> findByStatus(String status);

    @EntityGraph(attributePaths = {"teacher", "teacher.user", "sections"})
    @Override
    List<Exam> findAll();

    @EntityGraph(attributePaths = {"teacher", "teacher.user", "sections", "sections.questions", "sections.questions.options"})
    @Override
    Optional<Exam> findById(Integer id);

    /** Active exams for students — eager load teacher for display */
    @EntityGraph(attributePaths = {"teacher", "teacher.user"})
    @Query("SELECT e FROM Exam e WHERE e.status = :status")
    List<Exam> findByStatusWithTeacher(@Param("status") String status);

    /** Teacher's own exams — sections for sectionCount in list (questions not loaded). */
    @EntityGraph(attributePaths = {"teacher", "teacher.user", "sections"})
    @Query("SELECT e FROM Exam e WHERE e.teacher = :teacher")
    List<Exam> findByTeacherWithUser(@Param("teacher") Teacher teacher);

    /**
     * Same visibility as students for ACTIVE exams, plus this teacher's DRAFT/CLOSED papers.
     * Keeps teacher list aligned with /student/exams while still surfacing unpublished own work.
     */
    @EntityGraph(attributePaths = {"teacher", "teacher.user", "sections"})
    @Query("SELECT DISTINCT e FROM Exam e WHERE e.status = :activeStatus OR e.teacher = :teacher")
    List<Exam> findActiveOrOwnedByTeacher(
            @Param("activeStatus") String activeStatus,
            @Param("teacher") Teacher teacher);
}
