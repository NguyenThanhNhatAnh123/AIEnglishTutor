package com.ai.englishsystem.teacher.repository;

import com.ai.englishsystem.teacher.entity.Teacher;
import com.ai.englishsystem.user.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface TeacherRepository extends JpaRepository<Teacher, Integer> {
    Optional<Teacher> findFirstByUser(User user);
    Optional<Teacher> findByTeacherCode(String teacherCode);
    boolean existsByTeacherCode(String teacherCode);
}