package com.ai.englishsystem.classmodule.repository;

import com.ai.englishsystem.classmodule.entity.ClassStudent;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface ClassStudentRepository extends JpaRepository<ClassStudent, Integer> {

    @Modifying
    @Query("DELETE FROM ClassStudent cs WHERE cs.classEntity.id = :classId")
    void deleteByClassId(@Param("classId") Integer classId);

    @Modifying
    @Query("DELETE FROM ClassStudent cs WHERE cs.student.id = :studentId")
    void deleteByStudentId(@Param("studentId") Integer studentId);

    @Query("""
        SELECT cs FROM ClassStudent cs
        JOIN FETCH cs.student s
        JOIN FETCH s.user u
        WHERE cs.classEntity.id = :classId
        ORDER BY u.fullName
    """)
    List<ClassStudent> findByClassIdWithStudentUser(@Param("classId") Integer classId);

    @Query("SELECT cs.classEntity.id FROM ClassStudent cs WHERE cs.student.id = :studentId")
    List<Integer> findClassIdsByStudentId(@Param("studentId") Integer studentId);

    @Query("""
            SELECT CASE WHEN COUNT(cs) > 0 THEN true ELSE false END
            FROM ClassStudent cs
            JOIN cs.classEntity c
            JOIN c.teacher t
            WHERE cs.student.id = :studentId AND t.user.id = :teacherUserId
            """)
    boolean existsByStudentIdAndTeacherUserId(
            @Param("studentId") Integer studentId,
            @Param("teacherUserId") Integer teacherUserId);
}
