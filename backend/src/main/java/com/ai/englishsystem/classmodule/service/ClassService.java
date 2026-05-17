package com.ai.englishsystem.classmodule.service;

import com.ai.englishsystem.classmodule.dto.ClassRequest;
import com.ai.englishsystem.classmodule.dto.ClassResponse;
import com.ai.englishsystem.classmodule.dto.ClassStudentResponse;
import com.ai.englishsystem.classmodule.entity.ClassEntity;
import com.ai.englishsystem.classmodule.entity.ClassStudent;
import com.ai.englishsystem.classmodule.repository.ClassRepository;
import com.ai.englishsystem.classmodule.repository.ClassStudentRepository;
import com.ai.englishsystem.common.exception.BadRequestException;
import com.ai.englishsystem.common.exception.NotFoundException;
import com.ai.englishsystem.student.entity.Student;
import com.ai.englishsystem.student.repository.StudentRepository;
import com.ai.englishsystem.teacher.entity.Teacher;
import com.ai.englishsystem.teacher.repository.TeacherRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class ClassService {

    private final ClassRepository classRepository;
    private final ClassStudentRepository classStudentRepository;
    private final TeacherRepository teacherRepository;
    private final StudentRepository studentRepository;

    // ─── LIST ───────────────────────────────────────────────────────────────

    @Transactional(readOnly = true)
    public List<ClassResponse> findAll() {
        return classRepository.findSummaryRowsOrderByIdDesc()
                .stream()
                .map(com.ai.englishsystem.classmodule.dto.ClassSummaryRow::toResponse)
                .collect(Collectors.toList());
    }

    // ─── DETAIL ─────────────────────────────────────────────────────────────

    @Transactional(readOnly = true)
    public ClassResponse findById(Integer id) {
        ClassEntity cls = classRepository.findById(id)
                .orElseThrow(() -> new NotFoundException("Class", id));

        List<ClassStudent> enrollments = classStudentRepository.findByClassIdWithStudentUser(id);
        List<ClassStudentResponse> studentResponses = enrollments.stream()
                .map(this::toStudentResponse)
                .collect(Collectors.toList());

        return buildDetailResponse(cls, studentResponses);
    }

    // ─── CREATE ─────────────────────────────────────────────────────────────

    @Transactional
    public ClassResponse create(ClassRequest request) {
        Teacher teacher = teacherRepository.findById(request.getTeacherId())
                .orElseThrow(() -> new NotFoundException("Teacher", request.getTeacherId()));

        ClassEntity entity = ClassEntity.builder()
                .name(request.getName().trim())
                .teacher(teacher)
                .description(request.getDescription())
                .build();

        entity = classRepository.save(entity);
        return toSummaryResponse(entity);
    }

    // ─── UPDATE ─────────────────────────────────────────────────────────────

    @Transactional
    public ClassResponse update(Integer id, ClassRequest request) {
        ClassEntity entity = classRepository.findById(id)
                .orElseThrow(() -> new NotFoundException("Class", id));

        Teacher teacher = teacherRepository.findById(request.getTeacherId())
                .orElseThrow(() -> new NotFoundException("Teacher", request.getTeacherId()));

        entity.setName(request.getName().trim());
        entity.setDescription(request.getDescription());
        entity.setTeacher(teacher);

        entity = classRepository.save(entity);
        return toSummaryResponse(entity);
    }

    // ─── DELETE ─────────────────────────────────────────────────────────────

    @Transactional
    public void delete(Integer id) {
        ClassEntity entity = classRepository.findById(id)
                .orElseThrow(() -> new NotFoundException("Class", id));

        // Remove all class_students first to avoid FK violation
        classStudentRepository.deleteByClassId(id);
        classRepository.delete(entity);
    }

    // ─── ADD STUDENT ────────────────────────────────────────────────────────

    @Transactional
    public ClassStudentResponse addStudent(Integer classId, Integer studentId) {
        ClassEntity cls = classRepository.findById(classId)
                .orElseThrow(() -> new NotFoundException("Class", classId));

        Student student = studentRepository.findById(studentId)
                .orElseThrow(() -> new NotFoundException("Student", studentId));

        if (classStudentRepository.existsByClassEntityAndStudent(cls, student)) {
            throw new BadRequestException("Student is already enrolled in this class");
        }

        ClassStudent cs = ClassStudent.builder()
                .classEntity(cls)
                .student(student)
                .build();

        cs = classStudentRepository.save(cs);
        return toStudentResponse(cs);
    }

    // ─── REMOVE STUDENT ─────────────────────────────────────────────────────

    @Transactional
    public void removeStudent(Integer classId, Integer studentId) {
        ClassEntity cls = classRepository.findById(classId)
                .orElseThrow(() -> new NotFoundException("Class", classId));

        Student student = studentRepository.findById(studentId)
                .orElseThrow(() -> new NotFoundException("Student", studentId));

        ClassStudent cs = classStudentRepository.findByClassEntityAndStudent(cls, student)
                .orElseThrow(() -> new NotFoundException("Enrollment for student " + studentId + " in class", classId));

        classStudentRepository.delete(cs);
    }

    // ─── GET STUDENTS OF CLASS ──────────────────────────────────────────────

    @Transactional(readOnly = true)
    public List<ClassStudentResponse> getStudents(Integer classId) {
        if (!classRepository.existsById(classId)) {
            throw new NotFoundException("Class", classId);
        }
        return classStudentRepository.findByClassIdWithStudentUser(classId)
                .stream()
                .map(this::toStudentResponse)
                .collect(Collectors.toList());
    }

    // ─── MAPPERS ────────────────────────────────────────────────────────────

    private ClassResponse toSummaryResponse(ClassEntity entity) {
        long totalStudents = classRepository.countStudentsByClassId(entity.getId());
        return ClassResponse.builder()
                .id(entity.getId())
                .name(entity.getName())
                .teacherId(entity.getTeacher().getId())
                .teacherName(entity.getTeacher().getUser().getFullName())
                .description(entity.getDescription())
                .createdAt(entity.getCreatedAt())
                .totalStudents((int) totalStudents)
                .build();
    }

    private ClassResponse buildDetailResponse(ClassEntity entity, List<ClassStudentResponse> students) {
        return ClassResponse.builder()
                .id(entity.getId())
                .name(entity.getName())
                .teacherId(entity.getTeacher().getId())
                .teacherName(entity.getTeacher().getUser().getFullName())
                .description(entity.getDescription())
                .createdAt(entity.getCreatedAt())
                .totalStudents(students.size())
                .students(students)
                .build();
    }

    private ClassStudentResponse toStudentResponse(ClassStudent cs) {
        Student student = cs.getStudent();
        var user = student.getUser();
        return ClassStudentResponse.builder()
                .studentId(student.getId())
                .studentCode(student.getStudentCode())
                .fullName(user.getFullName())
                .username(user.getUsername())
                .email(user.getEmail())
                .joinedAt(cs.getJoinedAt())
                .build();
    }
}
