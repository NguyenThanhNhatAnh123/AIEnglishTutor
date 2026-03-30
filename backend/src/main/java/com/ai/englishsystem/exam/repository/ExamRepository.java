package com.ai.englishsystem.exam.repository;

import com.ai.englishsystem.exam.entity.Exam;
import com.ai.englishsystem.teacher.entity.Teacher;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface ExamRepository extends JpaRepository<Exam, Integer> {
    List<Exam> findByTeacher(Teacher teacher);
    List<Exam> findByStatus(String status);

    @EntityGraph(attributePaths = {"teacher", "teacher.user"})
    @Override
    List<Exam> findAll();

    @EntityGraph(attributePaths = {"teacher", "teacher.user", "sections", "sections.questions", "sections.questions.options"})
    @Override
    Optional<Exam> findById(Integer id);
}
