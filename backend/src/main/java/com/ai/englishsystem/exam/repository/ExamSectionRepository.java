package com.ai.englishsystem.exam.repository;

import com.ai.englishsystem.exam.entity.Exam;
import com.ai.englishsystem.exam.entity.ExamSection;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface ExamSectionRepository extends JpaRepository<ExamSection, Integer> {
    List<ExamSection> findByExamOrderByOrderIndex(Exam exam);
}
