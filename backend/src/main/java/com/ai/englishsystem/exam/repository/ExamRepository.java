package com.ai.englishsystem.exam.repository;

import com.ai.englishsystem.exam.entity.Exam;
import com.ai.englishsystem.exam.dto.ExamAllowedClassRow;
import com.ai.englishsystem.exam.dto.ExamDashboardRow;
import com.ai.englishsystem.teacher.entity.Teacher;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Collection;
import java.util.List;
import java.util.Optional;

public interface ExamRepository extends JpaRepository<Exam, Integer> {
    List<Exam> findByTeacher(Teacher teacher);
    List<Exam> findByStatus(String status);

    @EntityGraph(attributePaths = {"teacher", "teacher.user"})
    @Override
    List<Exam> findAll();

    @EntityGraph(attributePaths = {"teacher", "teacher.user"})
    @Override
    Optional<Exam> findById(Integer id);

    /** Active exams for students — eager load teacher for display */
    @EntityGraph(attributePaths = {"teacher", "teacher.user", "allowedClasses"})
    @Query("SELECT e FROM Exam e WHERE e.status = :status")
    List<Exam> findByStatusWithTeacher(@Param("status") String status);

    /** Teacher's own exams — sections for sectionCount in list (questions not loaded). */
    @EntityGraph(attributePaths = {"teacher", "teacher.user"})
    @Query("SELECT e FROM Exam e WHERE e.teacher = :teacher")
    List<Exam> findByTeacherWithUser(@Param("teacher") Teacher teacher);

    /**
     * Same visibility as students for ACTIVE exams, plus this teacher's DRAFT/CLOSED papers.
     * Keeps teacher list aligned with /student/exams while still surfacing unpublished own work.
     */
    @EntityGraph(attributePaths = {"teacher", "teacher.user"})
    @Query("SELECT DISTINCT e FROM Exam e WHERE e.status = :activeStatus OR e.teacher = :teacher")
    List<Exam> findActiveOrOwnedByTeacher(
            @Param("activeStatus") String activeStatus,
            @Param("teacher") Teacher teacher);

    @Query("""
            SELECT new com.ai.englishsystem.exam.dto.ExamDashboardRow(
                e.id,
                e.title,
                e.description,
                teacher.id,
                teacherUser.fullName,
                e.durationMinutes,
                e.status,
                e.examType,
                e.maxAttempts,
                e.createdAt,
                COUNT(DISTINCT section.id),
                COUNT(question.id),
                true
            )
            FROM Exam e
            JOIN e.teacher teacher
            JOIN teacher.user teacherUser
            LEFT JOIN e.sections section
            LEFT JOIN section.questions question
            GROUP BY e.id, e.title, e.description, teacher.id, teacherUser.fullName,
                e.durationMinutes, e.status, e.examType, e.maxAttempts, e.createdAt
            """)
    List<ExamDashboardRow> findDashboardRowsForAdmin();

    @Query("""
            SELECT new com.ai.englishsystem.exam.dto.ExamDashboardRow(
                e.id,
                e.title,
                e.description,
                teacher.id,
                teacherUser.fullName,
                e.durationMinutes,
                e.status,
                e.examType,
                e.maxAttempts,
                e.createdAt,
                COUNT(DISTINCT section.id),
                COUNT(question.id),
                CASE WHEN teacher.id = :teacherId THEN true ELSE false END
            )
            FROM Exam e
            JOIN e.teacher teacher
            JOIN teacher.user teacherUser
            LEFT JOIN e.sections section
            LEFT JOIN section.questions question
            WHERE e.status = :activeStatus OR teacher.id = :teacherId
            GROUP BY e.id, e.title, e.description, teacher.id, teacherUser.fullName,
                e.durationMinutes, e.status, e.examType, e.maxAttempts, e.createdAt
            """)
    List<ExamDashboardRow> findDashboardRowsForTeacher(
            @Param("activeStatus") String activeStatus,
            @Param("teacherId") Integer teacherId);

    @Query("""
            SELECT new com.ai.englishsystem.exam.dto.ExamAllowedClassRow(
                e.id,
                c.id,
                c.name
            )
            FROM Exam e
            JOIN e.allowedClasses c
            WHERE e.id IN :examIds
            ORDER BY c.name ASC
            """)
    List<ExamAllowedClassRow> findAllowedClassRowsByExamIds(@Param("examIds") Collection<Integer> examIds);

    @Query("""
            SELECT e.id, COUNT(DISTINCT section.id), COUNT(question.id)
            FROM Exam e
            LEFT JOIN e.sections section
            LEFT JOIN section.questions question
            WHERE e.id IN :examIds
            GROUP BY e.id
            """)
    List<Object[]> findContentCountsByExamIds(@Param("examIds") Collection<Integer> examIds);
}
