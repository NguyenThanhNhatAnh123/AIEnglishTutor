package com.ai.englishsystem.classmodule.service;

import com.ai.englishsystem.classmodule.dto.ClassRequest;
import com.ai.englishsystem.classmodule.dto.ClassResponse;
import com.ai.englishsystem.classmodule.dto.ClassStudentResponse;
import com.ai.englishsystem.classmodule.dto.ClassWorkspaceResponse;
import com.ai.englishsystem.classmodule.entity.ClassEntity;
import com.ai.englishsystem.classmodule.entity.ClassStudent;
import com.ai.englishsystem.classmodule.repository.ClassRepository;
import com.ai.englishsystem.classmodule.repository.ClassStudentRepository;
import com.ai.englishsystem.common.exception.BadRequestException;
import com.ai.englishsystem.common.exception.ForbiddenException;
import com.ai.englishsystem.common.exception.NotFoundException;
import com.ai.englishsystem.common.util.SecurityUtils;
import com.ai.englishsystem.student.entity.Student;
import com.ai.englishsystem.student.dto.StudentResponse;
import com.ai.englishsystem.student.repository.StudentRepository;
import com.ai.englishsystem.teacher.entity.Teacher;
import com.ai.englishsystem.teacher.dto.TeacherResponse;
import com.ai.englishsystem.teacher.repository.TeacherRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class ClassService {

    private final ClassRepository classRepository;
    private final ClassStudentRepository classStudentRepository;
    private final TeacherRepository teacherRepository;
    private final StudentRepository studentRepository;


    @Transactional(readOnly = true)
    public List<ClassResponse> findAll() {
        List<com.ai.englishsystem.classmodule.dto.ClassSummaryRow> rows;
        if (SecurityUtils.hasRole("ADMIN")) {
            rows = classRepository.findSummaryRowsOrderByIdDesc();
        } else if (SecurityUtils.hasRole("TEACHER")) {
            rows = classRepository.findSummaryRowsByTeacherUserIdOrderByIdDesc(SecurityUtils.getCurrentUserId());
        } else {
            throw new ForbiddenException("Access denied");
        }
        return rows.stream()
                .map(com.ai.englishsystem.classmodule.dto.ClassSummaryRow::toResponse)
                .collect(Collectors.toList());
    }


    @Transactional(readOnly = true)
    public ClassResponse findById(Integer id) {
        ClassEntity cls = classRepository.findById(id)
                .orElseThrow(() -> new NotFoundException("Class", id));
        assertTeacherOwnsClass(cls);

        List<ClassStudent> enrollments = classStudentRepository.findByClassIdWithStudentUser(id);
        List<ClassStudentResponse> studentResponses = enrollments.stream()
                .map(this::toStudentResponse)
                .collect(Collectors.toList());

        return buildDetailResponse(cls, studentResponses);
    }


    @Transactional
    public ClassResponse create(ClassRequest request) {
        Teacher teacher = resolveTeacherForWrite(request.getTeacherId());
        requireInitialStudents(request.getStudentIds());

        ClassEntity entity = ClassEntity.builder()
                .name(request.getName().trim())
                .teacher(teacher)
                .description(request.getDescription())
                .build();

        entity = classRepository.save(entity);
        syncStudents(entity, request.getStudentIds());
        return request.getStudentIds() == null ? toSummaryResponse(entity) : findById(entity.getId());
    }

    @Transactional(readOnly = true)
    public ClassWorkspaceResponse workspace() {
        List<TeacherResponse> teachers = SecurityUtils.hasRole("ADMIN")
                ? teacherRepository.findAll().stream().map(this::toTeacherOption).toList()
                : List.of(toTeacherOption(resolveCurrentTeacher()));

        return ClassWorkspaceResponse.builder()
                .classes(findAll())
                .students(studentRepository.findAllActiveStudents().stream()
                        .map(this::toStudentOption)
                        .toList())
                .teachers(teachers)
                .build();
    }

    private void requireInitialStudents(List<Integer> studentIds) {
        if (studentIds == null || studentIds.stream().filter(id -> id != null).findAny().isEmpty()) {
            throw new BadRequestException("Select at least one student for this class");
        }
    }


    @Transactional
    public ClassResponse update(Integer id, ClassRequest request) {
        ClassEntity entity = classRepository.findById(id)
                .orElseThrow(() -> new NotFoundException("Class", id));
        assertTeacherOwnsClass(entity);

        Teacher teacher = resolveTeacherForWrite(request.getTeacherId());

        entity.setName(request.getName().trim());
        entity.setDescription(request.getDescription());
        entity.setTeacher(teacher);

        entity = classRepository.save(entity);
        syncStudents(entity, request.getStudentIds());
        return request.getStudentIds() == null ? toSummaryResponse(entity) : findById(entity.getId());
    }


    @Transactional
    public void delete(Integer id) {
        ClassEntity entity = classRepository.findById(id)
                .orElseThrow(() -> new NotFoundException("Class", id));
        assertTeacherOwnsClass(entity);

        // Remove all class_students first to avoid FK violation.
        classStudentRepository.deleteByClassId(id);
        classRepository.delete(entity);
    }

    private void syncStudents(ClassEntity cls, List<Integer> requestedStudentIds) {
        if (requestedStudentIds == null) {
            return;
        }
        Set<Integer> desiredIds = requestedStudentIds.stream()
                .filter(id -> id != null)
                .collect(Collectors.toCollection(LinkedHashSet::new));
        Map<Integer, ClassStudent> existingByStudentId = classStudentRepository.findByClassIdWithStudentUser(cls.getId())
                .stream()
                .collect(Collectors.toMap(enrollment -> enrollment.getStudent().getId(), enrollment -> enrollment));

        for (ClassStudent enrollment : existingByStudentId.values()) {
            if (!desiredIds.contains(enrollment.getStudent().getId())) {
                classStudentRepository.delete(enrollment);
            }
        }

        Set<Integer> existingIds = existingByStudentId.keySet();
        List<Integer> newIds = desiredIds.stream()
                .filter(id -> !existingIds.contains(id))
                .toList();
        if (newIds.isEmpty()) {
            return;
        }

        List<Student> students = studentRepository.findAllById(newIds);
        if (students.size() != newIds.size()) {
            throw new NotFoundException("One or more students were not found");
        }
        boolean hasInactiveStudent = students.stream()
                .anyMatch(student -> student.getUser() == null
                        || !"ACTIVE".equalsIgnoreCase(student.getUser().getStatus()));
        if (hasInactiveStudent) {
            throw new BadRequestException("Only active students can be assigned to a class");
        }
        for (Student student : students) {
            classStudentRepository.save(ClassStudent.builder()
                    .classEntity(cls)
                    .student(student)
                    .build());
        }
    }

    private Teacher resolveTeacherForWrite(Integer requestedTeacherId) {
        if (SecurityUtils.hasRole("ADMIN")) {
            return teacherRepository.findById(requestedTeacherId)
                    .orElseThrow(() -> new NotFoundException("Teacher", requestedTeacherId));
        }
        if (SecurityUtils.hasRole("TEACHER")) {
            Teacher current = resolveCurrentTeacher();
            if (requestedTeacherId == null) {
                return current;
            }
            if (!current.getId().equals(requestedTeacherId)) {
                throw new ForbiddenException("Teachers can only manage their own classes");
            }
            return current;
        }
        throw new ForbiddenException("Access denied");
    }

    private Teacher resolveCurrentTeacher() {
        Integer userId = SecurityUtils.getCurrentUserId();
        return teacherRepository.findIdByUserId(userId)
                .flatMap(teacherRepository::findById)
                .orElseThrow(() -> new BadRequestException(
                        "Current user does not have a teacher profile"));
    }

    private void assertTeacherOwnsClass(ClassEntity cls) {
        if (SecurityUtils.hasRole("ADMIN")) {
            return;
        }
        if (SecurityUtils.hasRole("TEACHER")) {
            Integer currentUserId = SecurityUtils.getCurrentUserId();
            if (cls.getTeacher() == null
                    || cls.getTeacher().getUser() == null
                    || !currentUserId.equals(cls.getTeacher().getUser().getId())) {
                throw new ForbiddenException("You do not have permission to access this class");
            }
            return;
        }
        throw new ForbiddenException("Access denied");
    }


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
                .status(user.getStatus())
                .joinedAt(cs.getJoinedAt())
                .build();
    }

    private StudentResponse toStudentOption(Student student) {
        var user = student.getUser();
        return StudentResponse.builder()
                .id(student.getId())
                .userId(user != null ? user.getId() : null)
                .username(user != null ? user.getUsername() : null)
                .studentCode(student.getStudentCode())
                .fullName(user != null ? user.getFullName() : null)
                .email(user != null ? user.getEmail() : null)
                .status(user != null ? user.getStatus() : null)
                .dateOfBirth(student.getDateOfBirth())
                .createdAt(student.getCreatedAt())
                .build();
    }

    private TeacherResponse toTeacherOption(Teacher teacher) {
        var user = teacher.getUser();
        return TeacherResponse.builder()
                .id(teacher.getId())
                .userId(user != null ? user.getId() : null)
                .teacherCode(teacher.getTeacherCode())
                .fullName(user != null ? user.getFullName() : null)
                .email(user != null ? user.getEmail() : null)
                .department(teacher.getDepartment())
                .createdAt(teacher.getCreatedAt())
                .build();
    }
}
