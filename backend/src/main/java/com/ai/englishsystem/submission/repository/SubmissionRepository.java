package com.ai.englishsystem.submission.repository;

import com.ai.englishsystem.exam.entity.Exam;
import com.ai.englishsystem.student.entity.Student;
import com.ai.englishsystem.submission.entity.Submission;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface SubmissionRepository extends JpaRepository<Submission, Integer> {
    List<Submission> findByStudent(Student student);
    List<Submission> findByExam(Exam exam);
    Optional<Submission> findByExamAndStudentAndStatus(Exam exam, Student student, String status);
}
