package com.ai.englishsystem.exam.repository;

import com.ai.englishsystem.exam.entity.ExamAttempt;
import com.ai.englishsystem.exam.entity.Exam;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface ExamAttemptRepository extends JpaRepository<ExamAttempt, Integer> {

    int countByExam_IdAndStudent_Id(Integer examId, Integer studentId);

    List<ExamAttempt> findByExam(Exam exam);
}
