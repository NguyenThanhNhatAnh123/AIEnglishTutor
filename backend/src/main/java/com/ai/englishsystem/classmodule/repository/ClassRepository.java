package com.ai.englishsystem.classmodule.repository;

import com.ai.englishsystem.classmodule.dto.ClassSummaryRow;
import com.ai.englishsystem.classmodule.entity.ClassEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface ClassRepository extends JpaRepository<ClassEntity, Integer> {

    List<ClassEntity> findAllByOrderByIdDesc();

    @Query("""
            SELECT new com.ai.englishsystem.classmodule.dto.ClassSummaryRow(
                c.id,
                c.name,
                teacher.id,
                teacherUser.fullName,
                c.description,
                c.createdAt,
                COUNT(cs.id)
            )
            FROM ClassEntity c
            JOIN c.teacher teacher
            JOIN teacher.user teacherUser
            LEFT JOIN ClassStudent cs ON cs.classEntity = c
            GROUP BY c.id, c.name, teacher.id, teacherUser.fullName, c.description, c.createdAt
            ORDER BY c.id DESC
            """)
    List<ClassSummaryRow> findSummaryRowsOrderByIdDesc();

    List<ClassEntity> findByNameContainingIgnoreCaseOrderByIdDesc(String name);

    @Query("SELECT COUNT(cs) FROM ClassStudent cs WHERE cs.classEntity.id = :classId")
    long countStudentsByClassId(@Param("classId") Integer classId);

    @Query("SELECT c FROM ClassEntity c WHERE c.teacher.user.id = :userId ORDER BY c.id DESC")
    List<ClassEntity> findByTeacherUserIdOrderByIdDesc(@Param("userId") Integer userId);

    long countByTeacher_User_Id(Integer userId);
}
