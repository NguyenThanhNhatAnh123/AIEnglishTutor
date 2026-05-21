package com.ai.englishsystem.student.repository;

import com.ai.englishsystem.student.entity.Student;
import com.ai.englishsystem.user.entity.User;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

import jakarta.persistence.LockModeType;

public interface StudentRepository extends JpaRepository<Student, Integer> {
    Optional<Student> findByUser(User user);
    Optional<Student> findByUser_Id(Integer userId);
    Optional<Student> findByStudentCode(String studentCode);

    @EntityGraph(attributePaths = {"user"})
    Page<Student> findAllBy(Pageable pageable);

    boolean existsByStudentCode(String studentCode);

    boolean existsByStudentCodeAndIdNot(String studentCode, Integer id);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT s FROM Student s WHERE s.id = :id")
    Optional<Student> findByIdForUpdate(@Param("id") Integer id);

    @EntityGraph(attributePaths = {"user"})
    @Query("""
            SELECT DISTINCT s FROM Student s
            JOIN ClassStudent cs ON cs.student = s
            JOIN cs.classEntity c
            JOIN c.teacher t
            WHERE t.user.id = :teacherUserId
            ORDER BY s.id DESC
            """)
    List<Student> findAllByTeacherUserId(@Param("teacherUserId") Integer teacherUserId);

    @EntityGraph(attributePaths = {"user"})
    @Query(
            value = """
                    SELECT DISTINCT s FROM Student s
                    JOIN ClassStudent cs ON cs.student = s
                    JOIN cs.classEntity c
                    JOIN c.teacher t
                    WHERE t.user.id = :teacherUserId
                    """,
            countQuery = """
                    SELECT COUNT(DISTINCT s.id) FROM Student s
                    JOIN ClassStudent cs ON cs.student = s
                    JOIN cs.classEntity c
                    JOIN c.teacher t
                    WHERE t.user.id = :teacherUserId
                    """
    )
    Page<Student> findAllByTeacherUserId(@Param("teacherUserId") Integer teacherUserId, Pageable pageable);
}
