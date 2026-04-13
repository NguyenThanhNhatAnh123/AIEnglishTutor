package com.ai.englishsystem.submission.repository;

import com.ai.englishsystem.exam.entity.Exam;
import com.ai.englishsystem.student.entity.Student;
import com.ai.englishsystem.submission.entity.Submission;
import com.ai.englishsystem.submission.entity.SubmissionStatus;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface SubmissionRepository extends JpaRepository<Submission, Integer> {
    List<Submission> findByStudent(Student student);

    List<Submission> findByExam(Exam exam);

    @EntityGraph(attributePaths = {"exam", "student", "examAttempt"})
    Optional<Submission> findByExamAndStudentAndStatus(Exam exam, Student student, SubmissionStatus status);

    List<Submission> findByExamAttemptIsNull();

    /** Avoid lazy-load surprises in submit / deadline paths */
    @EntityGraph(attributePaths = {"exam", "student", "examAttempt"})
    @Query("SELECT s FROM Submission s WHERE s.id = :id")
    Optional<Submission> findWithAssociationsById(@Param("id") Integer id);
}
