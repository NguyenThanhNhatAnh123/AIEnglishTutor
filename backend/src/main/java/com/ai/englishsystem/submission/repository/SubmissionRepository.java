package com.ai.englishsystem.submission.repository;

import com.ai.englishsystem.exam.entity.Exam;
import com.ai.englishsystem.student.entity.Student;
import com.ai.englishsystem.submission.entity.Submission;
import com.ai.englishsystem.submission.entity.SubmissionStatus;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Collection;
import java.util.List;
import java.util.Optional;

public interface SubmissionRepository extends JpaRepository<Submission, Integer> {
    List<Submission> findByStudent(Student student);

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

    @EntityGraph(attributePaths = {"exam", "exam.teacher", "exam.teacher.user", "student", "student.user", "examAttempt"})
    @Query("SELECT s FROM Submission s WHERE s.id IN :ids")
    List<Submission> findAllWithAssociationsByIdIn(@Param("ids") List<Integer> ids);

    /** Student's own submission history, newest first */
    @EntityGraph(attributePaths = {"exam", "student", "student.user"})
    @Query("SELECT s FROM Submission s WHERE s.student = :student ORDER BY s.startTime DESC")
    List<Submission> findByStudentOrderByStartTimeDesc(@Param("student") Student student);

    boolean existsByExam_IdAndStudent_IdAndStatusIn(
            Integer examId,
            Integer studentId,
            Collection<SubmissionStatus> statuses
    );

    long countByExam_IdAndStudent_IdAndStatusIn(
            Integer examId,
            Integer studentId,
            Collection<SubmissionStatus> statuses
    );

    boolean existsByStudent_Id(Integer studentId);
}
