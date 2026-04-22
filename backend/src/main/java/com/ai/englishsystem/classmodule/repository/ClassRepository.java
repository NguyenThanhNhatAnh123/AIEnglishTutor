package com.ai.englishsystem.classmodule.repository;

import com.ai.englishsystem.classmodule.entity.ClassEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface ClassRepository extends JpaRepository<ClassEntity, Integer> {

    List<ClassEntity> findAllByOrderByIdDesc();

    List<ClassEntity> findByNameContainingIgnoreCaseOrderByIdDesc(String name);

    @Query("SELECT COUNT(cs) FROM ClassStudent cs WHERE cs.classEntity.id = :classId")
    long countStudentsByClassId(@Param("classId") Integer classId);
}
