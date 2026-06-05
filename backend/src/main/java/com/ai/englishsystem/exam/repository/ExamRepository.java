package com.ai.englishsystem.exam.repository;

import com.ai.englishsystem.exam.dto.ExamAllowedClassRow;
import com.ai.englishsystem.exam.dto.ExamDashboardRow;
import com.ai.englishsystem.exam.entity.Exam;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Collection;
import java.util.List;
import java.util.Optional;

public interface ExamRepository extends JpaRepository<Exam, Integer> {
    @EntityGraph(attributePaths = {"teacher", "teacher.user"})
    @Override
    List<Exam> findAll();

    @EntityGraph(attributePaths = {"teacher", "teacher.user"})
    @Override
    Optional<Exam> findById(Integer id);

    @EntityGraph(attributePaths = {"teacher", "teacher.user", "allowedClasses"})
    @Query("SELECT e FROM Exam e WHERE e.status = :status")
    List<Exam> findByStatusWithTeacher(@Param("status") String status);

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
                true
            )
            FROM Exam e
            JOIN e.teacher teacher
            JOIN teacher.user teacherUser
            LEFT JOIN e.sections section
            LEFT JOIN section.questions question
            WHERE teacher.id = :teacherId
            GROUP BY e.id, e.title, e.description, teacher.id, teacherUser.fullName,
                e.durationMinutes, e.status, e.examType, e.maxAttempts, e.createdAt
            """)
    List<ExamDashboardRow> findDashboardRowsForTeacher(@Param("teacherId") Integer teacherId);

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
            SELECT c.id
            FROM Exam e
            JOIN e.allowedClasses c
            WHERE e.id = :examId
            """)
    List<Integer> findAllowedClassIdsByExamId(@Param("examId") Integer examId);

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
