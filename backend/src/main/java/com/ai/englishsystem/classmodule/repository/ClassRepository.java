package com.ai.englishsystem.classmodule.repository;

import com.ai.englishsystem.classmodule.dto.ClassSummaryRow;
import com.ai.englishsystem.classmodule.entity.ClassEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface ClassRepository extends JpaRepository<ClassEntity, Integer> {

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
            WHERE teacherUser.id = :userId
            GROUP BY c.id, c.name, teacher.id, teacherUser.fullName, c.description, c.createdAt
            ORDER BY c.id DESC
            """)
    List<ClassSummaryRow> findSummaryRowsByTeacherUserIdOrderByIdDesc(@Param("userId") Integer userId);

    @Query("SELECT COUNT(cs) FROM ClassStudent cs WHERE cs.classEntity.id = :classId")
    long countStudentsByClassId(@Param("classId") Integer classId);

    long countByTeacher_User_Id(Integer userId);
}
