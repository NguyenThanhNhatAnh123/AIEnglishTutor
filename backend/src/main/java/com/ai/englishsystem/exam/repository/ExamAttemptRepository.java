package com.ai.englishsystem.exam.repository;

import com.ai.englishsystem.exam.entity.ExamAttempt;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ExamAttemptRepository extends JpaRepository<ExamAttempt, Integer> {

    int countByExam_IdAndStudent_Id(Integer examId, Integer studentId);
}
