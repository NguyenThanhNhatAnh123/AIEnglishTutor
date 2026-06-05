package com.ai.englishsystem.submission.repository;

import com.ai.englishsystem.analytics.dto.TeacherDashboardSubmissionRow;
import com.ai.englishsystem.exam.entity.Exam;
import com.ai.englishsystem.student.entity.Student;
import com.ai.englishsystem.submission.entity.Submission;
import com.ai.englishsystem.submission.entity.SubmissionStatus;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import jakarta.persistence.LockModeType;

import java.util.Collection;
import java.util.List;
import java.util.Optional;

public interface SubmissionRepository extends JpaRepository<Submission, Integer> {
    List<Submission> findByExam(Exam exam);

    @EntityGraph(attributePaths = {"exam", "student", "student.user", "examAttempt"})
    @Query("""
            SELECT s FROM Submission s
            WHERE s.exam = :exam
            ORDER BY COALESCE(s.endTime, s.submitTime, s.startTime) DESC, s.id DESC
            """)
    List<Submission> findByExamOrderByLatestWorkDateDesc(@Param("exam") Exam exam);

    void deleteByExam(Exam exam);

    @EntityGraph(attributePaths = {"exam", "student", "examAttempt"})
    Optional<Submission> findByExamAndStudentAndStatus(Exam exam, Student student, SubmissionStatus status);

    List<Submission> findByExamAttemptIsNull();

    /** Avoid lazy-load surprises in submit / deadline paths */
    @EntityGraph(attributePaths = {"exam", "student", "examAttempt"})
    @Query("SELECT s FROM Submission s WHERE s.id = :id")
    Optional<Submission> findWithAssociationsById(@Param("id") Integer id);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @EntityGraph(attributePaths = {"exam", "student", "examAttempt"})
    @Query("SELECT s FROM Submission s WHERE s.id = :id")
    Optional<Submission> findWithAssociationsByIdForUpdate(@Param("id") Integer id);

    @EntityGraph(attributePaths = {"exam", "exam.teacher", "exam.teacher.user", "student", "student.user", "examAttempt"})
    @Query("SELECT s FROM Submission s WHERE s.id IN :ids")
    List<Submission> findAllWithAssociationsByIdIn(@Param("ids") List<Integer> ids);

    /** Student's own submission history, newest first */
    @EntityGraph(attributePaths = {"exam", "student", "student.user"})
    @Query("SELECT s FROM Submission s WHERE s.student = :student ORDER BY s.startTime DESC")
    List<Submission> findByStudentOrderByStartTimeDesc(@Param("student") Student student);

    long countByExam_IdAndStudent_IdAndStatusIn(
            Integer examId,
            Integer studentId,
            Collection<SubmissionStatus> statuses
    );

    @Query("""
            SELECT s.exam.id, COUNT(s.id)
            FROM Submission s
            WHERE s.student.id = :studentId
              AND s.exam.id IN :examIds
              AND s.status IN :statuses
            GROUP BY s.exam.id
            """)
    List<Object[]> countByExamIdsAndStudentAndStatusIn(
            @Param("examIds") Collection<Integer> examIds,
            @Param("studentId") Integer studentId,
            @Param("statuses") Collection<SubmissionStatus> statuses
    );

    @Query("""
            SELECT DISTINCT s.exam.id
            FROM Submission s
            WHERE s.student.id = :studentId
              AND s.exam.id IN :examIds
              AND s.status = :status
            """)
    List<Integer> findExamIdsByStudentAndStatus(
            @Param("examIds") Collection<Integer> examIds,
            @Param("studentId") Integer studentId,
            @Param("status") SubmissionStatus status
    );

    boolean existsByStudent_Id(Integer studentId);

    @Query("""
            SELECT new com.ai.englishsystem.analytics.dto.TeacherDashboardSubmissionRow(
                s.id,
                exam.id,
                exam.title,
                student.id,
                studentUser.fullName,
                s.status,
                s.startTime,
                s.submitTime,
                s.endTime,
                s.duration,
                s.answeredQuestions,
                s.totalQuestions,
                s.completionPercent,
                s.tabSwitchCount,
                s.focusLossCount,
                s.copyPasteCount,
                s.suspiciousEventCount,
                s.deviceType,
                s.deviceLabel,
                MAX(score.totalScore)
            )
            FROM Submission s
            JOIN s.exam exam
            JOIN s.student student
            JOIN student.user studentUser
            LEFT JOIN Score score ON score.submission = s
            GROUP BY s.id, exam.id, exam.title, student.id, studentUser.fullName, s.status,
                s.startTime, s.submitTime, s.endTime, s.duration, s.answeredQuestions,
                s.totalQuestions, s.completionPercent, s.tabSwitchCount, s.focusLossCount,
                s.copyPasteCount, s.suspiciousEventCount, s.deviceType, s.deviceLabel
            ORDER BY COALESCE(s.endTime, s.submitTime, s.startTime) DESC, s.id DESC
            """)
    List<TeacherDashboardSubmissionRow> findDashboardRowsForAdmin();

    @Query("""
            SELECT new com.ai.englishsystem.analytics.dto.TeacherDashboardSubmissionRow(
                s.id,
                exam.id,
                exam.title,
                student.id,
                studentUser.fullName,
                s.status,
                s.startTime,
                s.submitTime,
                s.endTime,
                s.duration,
                s.answeredQuestions,
                s.totalQuestions,
                s.completionPercent,
                s.tabSwitchCount,
                s.focusLossCount,
                s.copyPasteCount,
                s.suspiciousEventCount,
                s.deviceType,
                s.deviceLabel,
                MAX(score.totalScore)
            )
            FROM Submission s
            JOIN s.exam exam
            JOIN s.student student
            JOIN student.user studentUser
            LEFT JOIN Score score ON score.submission = s
            WHERE exam.teacher.id = :teacherId
            GROUP BY s.id, exam.id, exam.title, student.id, studentUser.fullName, s.status,
                s.startTime, s.submitTime, s.endTime, s.duration, s.answeredQuestions,
                s.totalQuestions, s.completionPercent, s.tabSwitchCount, s.focusLossCount,
                s.copyPasteCount, s.suspiciousEventCount, s.deviceType, s.deviceLabel
            ORDER BY COALESCE(s.endTime, s.submitTime, s.startTime) DESC, s.id DESC
            """)
    List<TeacherDashboardSubmissionRow> findDashboardRowsForTeacher(@Param("teacherId") Integer teacherId);
}
