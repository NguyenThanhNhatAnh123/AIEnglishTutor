package com.ai.englishsystem.classmodule.repository;

import com.ai.englishsystem.classmodule.entity.ClassEntity;
import com.ai.englishsystem.teacher.entity.Teacher;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface ClassRepository extends JpaRepository<ClassEntity, Integer> {
    List<ClassEntity> findByTeacher(Teacher teacher);
}
