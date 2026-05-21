package com.ai.englishsystem.student.service;

import com.ai.englishsystem.common.exception.BadRequestException;
import com.ai.englishsystem.common.exception.ForbiddenException;
import com.ai.englishsystem.common.exception.NotFoundException;
import com.ai.englishsystem.common.util.SecurityUtils;
import com.ai.englishsystem.classmodule.repository.ClassStudentRepository;
import com.ai.englishsystem.student.dto.StudentRequest;
import com.ai.englishsystem.student.dto.StudentResponse;
import com.ai.englishsystem.student.dto.StudentUpdateRequest;
import com.ai.englishsystem.student.entity.Student;
import com.ai.englishsystem.student.repository.StudentRepository;
import com.ai.englishsystem.submission.repository.SubmissionRepository;
import com.ai.englishsystem.user.entity.User;
import com.ai.englishsystem.user.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class StudentService {

    private final StudentRepository studentRepository;
    private final UserRepository userRepository;
    private final SubmissionRepository submissionRepository;
    private final ClassStudentRepository classStudentRepository;

    @Transactional(readOnly = true)
    public StudentResponse getCurrentStudent() {
        Integer userId = SecurityUtils.getCurrentUserId();
        return studentRepository.findByUser_Id(userId)
                .map(this::toResponse)
                .orElseThrow(() -> new ForbiddenException("Student profile not found for current user"));
    }

    @Transactional(readOnly = true)
    public List<StudentResponse> findAll() {
        if (SecurityUtils.hasRole("ADMIN")) {
            return studentRepository.findAll().stream()
                    .map(this::toResponse)
                    .collect(Collectors.toList());
        }
        if (SecurityUtils.hasRole("TEACHER")) {
            return studentRepository.findAllByTeacherUserId(SecurityUtils.getCurrentUserId()).stream()
                    .map(this::toResponse)
                    .collect(Collectors.toList());
        }
        throw new ForbiddenException("Access denied");
    }

    @Transactional(readOnly = true)
    public Page<StudentResponse> findAll(Pageable pageable) {
        if (SecurityUtils.hasRole("ADMIN")) {
            return studentRepository.findAllBy(pageable)
                    .map(this::toResponse);
        }
        if (SecurityUtils.hasRole("TEACHER")) {
            return studentRepository.findAllByTeacherUserId(SecurityUtils.getCurrentUserId(), pageable)
                    .map(this::toResponse);
        }
        throw new ForbiddenException("Access denied");
    }

    @Transactional
    public StudentResponse create(StudentRequest request) {
        User user = userRepository.findById(request.getUserId())
                .orElseThrow(() -> new NotFoundException("User", request.getUserId()));

        if (studentRepository.existsByStudentCode(request.getStudentCode())) {
            throw new BadRequestException("Student code already exists");
        }

        Student student = Student.builder()
                .user(user)
                .studentCode(request.getStudentCode())
                .dateOfBirth(request.getDateOfBirth())
                .build();

        try {
            student = studentRepository.save(student);
        } catch (DataIntegrityViolationException ex) {
            throw new BadRequestException("Student code already exists");
        }
        return toResponse(student);
    }

    @Transactional(readOnly = true)
    public StudentResponse findById(Integer id) {
        Student student = studentRepository.findById(id)
                .orElseThrow(() -> new NotFoundException("Student", id));
        assertTeacherCanAccessStudent(student);
        return toResponse(student);
    }

    @Transactional
    public StudentResponse update(Integer id, StudentUpdateRequest request) {
        Student student = studentRepository.findById(id)
                .orElseThrow(() -> new NotFoundException("Student", id));
        assertTeacherCanAccessStudent(student);
        User user = student.getUser();

        if (request.getStudentCode() != null && !request.getStudentCode().isBlank()) {
            String code = request.getStudentCode().trim();
            if (studentRepository.existsByStudentCodeAndIdNot(code, id)) {
                throw new BadRequestException("Student code already exists");
            }
            student.setStudentCode(code);
        }
        if (request.getDateOfBirth() != null) {
            student.setDateOfBirth(request.getDateOfBirth());
        }
        if (request.getFullName() != null && !request.getFullName().isBlank()) {
            user.setFullName(request.getFullName().trim());
        }
        if (request.getEmail() != null && !request.getEmail().isBlank()) {
            String email = request.getEmail().trim();
            if (userRepository.existsByEmailAndIdNot(email, user.getId())) {
                throw new BadRequestException("Email already exists");
            }
            user.setEmail(email);
        }

        try {
            userRepository.save(user);
            studentRepository.save(student);
        } catch (DataIntegrityViolationException ex) {
            throw new BadRequestException("Email or student code already exists");
        }
        return toResponse(student);
    }

    @Transactional
    public void delete(Integer id) {
        Student student = studentRepository.findById(id)
                .orElseThrow(() -> new NotFoundException("Student", id));
        assertTeacherCanAccessStudent(student);
        if (submissionRepository.existsByStudent_Id(id)) {
            throw new BadRequestException("Cannot delete a student who has exam submissions");
        }
        classStudentRepository.deleteByStudentId(id);
        studentRepository.delete(student);
    }

    private void assertTeacherCanAccessStudent(Student student) {
        if (SecurityUtils.hasRole("ADMIN")) {
            return;
        }
        if (SecurityUtils.hasRole("TEACHER")) {
            boolean allowed = classStudentRepository.existsByStudentIdAndTeacherUserId(
                    student.getId(), SecurityUtils.getCurrentUserId());
            if (!allowed) {
                throw new ForbiddenException("You do not have permission to access this student");
            }
            return;
        }
        throw new ForbiddenException("Access denied");
    }

    private StudentResponse toResponse(Student student) {
        return StudentResponse.builder()
                .id(student.getId())
                .userId(student.getUser().getId())
                .username(student.getUser().getUsername())
                .studentCode(student.getStudentCode())
                .fullName(student.getUser().getFullName())
                .email(student.getUser().getEmail())
                .dateOfBirth(student.getDateOfBirth())
                .createdAt(student.getCreatedAt())
                .build();
    }
}
