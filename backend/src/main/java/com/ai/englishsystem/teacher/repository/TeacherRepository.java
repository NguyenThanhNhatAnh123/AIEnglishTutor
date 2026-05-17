package com.ai.englishsystem.teacher.repository;

import com.ai.englishsystem.teacher.entity.Teacher;
import com.ai.englishsystem.user.entity.User;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Optional;

public interface TeacherRepository extends JpaRepository<Teacher, Integer> {
    Optional<Teacher> findFirstByUser(User user);
    Optional<Teacher> findByTeacherCode(String teacherCode);

    @EntityGraph(attributePaths = {"user"})
    Page<Teacher> findAllBy(Pageable pageable);

    boolean existsByTeacherCode(String teacherCode);

    @Query("SELECT t.id FROM Teacher t WHERE t.user.id = :userId")
    Optional<Integer> findIdByUserId(@Param("userId") Integer userId);
}
