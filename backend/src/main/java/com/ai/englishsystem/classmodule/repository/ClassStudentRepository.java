package com.ai.englishsystem.classmodule.repository;

import com.ai.englishsystem.classmodule.entity.ClassEntity;
import com.ai.englishsystem.classmodule.entity.ClassStudent;
import com.ai.englishsystem.student.entity.Student;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface ClassStudentRepository extends JpaRepository<ClassStudent, Integer> {

    List<ClassStudent> findByClassEntity(ClassEntity classEntity);

    List<ClassStudent> findByStudent(Student student);

    Optional<ClassStudent> findByClassEntityAndStudent(ClassEntity classEntity, Student student);

    boolean existsByClassEntityAndStudent(ClassEntity classEntity, Student student);

    @Modifying
    @Query("DELETE FROM ClassStudent cs WHERE cs.classEntity.id = :classId")
    void deleteByClassId(@Param("classId") Integer classId);

    @Query("""
        SELECT cs FROM ClassStudent cs
        JOIN FETCH cs.student s
        JOIN FETCH s.user u
        WHERE cs.classEntity.id = :classId
        ORDER BY u.fullName
    """)
    List<ClassStudent> findByClassIdWithStudentUser(@Param("classId") Integer classId);

    @Query("""
        SELECT cs FROM ClassStudent cs
        JOIN FETCH cs.student s
        WHERE cs.classEntity.id = :classId
        AND s.id NOT IN (
            SELECT cs2.student.id FROM ClassStudent cs2 WHERE cs2.classEntity.id = :classId
        )
    """)
    List<ClassStudent> findStudentsNotInClass(@Param("classId") Integer classId);
}
