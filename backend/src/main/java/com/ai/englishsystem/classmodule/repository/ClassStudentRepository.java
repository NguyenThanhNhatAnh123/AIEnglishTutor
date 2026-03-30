package com.ai.englishsystem.classmodule.repository;

import com.ai.englishsystem.classmodule.entity.ClassEntity;
import com.ai.englishsystem.classmodule.entity.ClassStudent;
import com.ai.englishsystem.student.entity.Student;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface ClassStudentRepository extends JpaRepository<ClassStudent, Integer> {
    List<ClassStudent> findByClassEntity(ClassEntity classEntity);
    List<ClassStudent> findByStudent(Student student);
    Optional<ClassStudent> findByClassEntityAndStudent(ClassEntity classEntity, Student student);
}
