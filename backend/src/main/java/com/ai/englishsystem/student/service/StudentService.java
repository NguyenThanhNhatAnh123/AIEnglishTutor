package com.ai.englishsystem.student.service;

import com.ai.englishsystem.auth.entity.Role;
import com.ai.englishsystem.auth.repository.RoleRepository;
import com.ai.englishsystem.common.exception.BadRequestException;
import com.ai.englishsystem.common.exception.ForbiddenException;
import com.ai.englishsystem.common.exception.NotFoundException;
import com.ai.englishsystem.common.util.SecurityUtils;
import com.ai.englishsystem.classmodule.entity.ClassEntity;
import com.ai.englishsystem.classmodule.entity.ClassStudent;
import com.ai.englishsystem.classmodule.repository.ClassRepository;
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
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.LinkedHashSet;
import java.util.Locale;
import java.util.Set;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class StudentService {

    private static final Set<String> ACCOUNT_STATUSES = Set.of("ACTIVE", "INACTIVE");

    private final StudentRepository studentRepository;
    private final UserRepository userRepository;
    private final SubmissionRepository submissionRepository;
    private final ClassStudentRepository classStudentRepository;
    private final ClassRepository classRepository;
    private final RoleRepository roleRepository;
    private final PasswordEncoder passwordEncoder;

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
            return studentRepository.findAllActiveStudents().stream()
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
            return studentRepository.findAllActiveStudents(pageable)
                    .map(this::toResponse);
        }
        throw new ForbiddenException("Access denied");
    }

    @Transactional
    public StudentResponse create(StudentRequest request) {
        User user = request.getUserId() != null
                ? userRepository.findById(request.getUserId())
                .orElseThrow(() -> new NotFoundException("User", request.getUserId()))
                : createStudentUser(request);

        String studentCode = request.getStudentCode() == null ? "" : request.getStudentCode().trim();
        if (studentCode.isBlank()) {
            throw new BadRequestException("Student code is required");
        }
        if (studentRepository.findByUser(user).isPresent()) {
            throw new BadRequestException("This user already has a student profile");
        }
        if (studentRepository.existsByStudentCode(studentCode)) {
            throw new BadRequestException("Student code already exists");
        }

        Student student = Student.builder()
                .user(user)
                .studentCode(studentCode)
                .dateOfBirth(request.getDateOfBirth())
                .build();

        try {
            student = studentRepository.save(student);
            syncInitialClasses(student, request.getClassIds());
        } catch (DataIntegrityViolationException ex) {
            throw new BadRequestException("Student code already exists");
        }
        return toResponse(student);
    }

    private User createStudentUser(StudentRequest request) {
        String username = request.getUsername() == null ? "" : request.getUsername().trim();
        String email = request.getEmail() == null ? "" : request.getEmail().trim();
        String password = request.getPassword();
        if (username.isBlank() || email.isBlank() || password == null || password.isBlank()) {
            throw new BadRequestException("Username, email, and password are required");
        }
        if (password.length() < 6) {
            throw new BadRequestException("Password must be at least 6 characters");
        }
        if (userRepository.existsByUsername(username)) {
            throw new BadRequestException("Username already exists");
        }
        if (userRepository.existsByEmail(email)) {
            throw new BadRequestException("Email already exists");
        }

        Role studentRole = roleRepository.findByName("STUDENT")
                .orElseThrow(() -> new BadRequestException("Student role not found"));
        User user = User.builder()
                .username(username)
                .email(email)
                .password(passwordEncoder.encode(password))
                .fullName(resolveFullName(request, username))
                .role(studentRole)
                .status(normalizeAccountStatus(request.getStatus()))
                .build();
        try {
            return userRepository.save(user);
        } catch (DataIntegrityViolationException ex) {
            throw new BadRequestException("Email or username already exists");
        }
    }

    private String resolveFullName(StudentRequest request, String username) {
        String fullName = request.getFullName() == null ? "" : request.getFullName().trim();
        return fullName.isBlank() ? username : fullName;
    }

    private void syncInitialClasses(Student student, List<Integer> classIds) {
        Set<Integer> desiredIds = classIds == null ? Set.of()
                : classIds.stream()
                .filter(id -> id != null)
                .collect(Collectors.toCollection(LinkedHashSet::new));

        if (SecurityUtils.hasRole("TEACHER") && desiredIds.isEmpty()) {
            throw new BadRequestException("Select at least one class for this student");
        }
        if (desiredIds.isEmpty()) {
            return;
        }

        List<ClassEntity> classes = classRepository.findAllById(desiredIds);
        if (classes.size() != desiredIds.size()) {
            throw new NotFoundException("One or more classes were not found");
        }
        if (SecurityUtils.hasRole("TEACHER")) {
            Integer teacherUserId = SecurityUtils.getCurrentUserId();
            boolean invalidOwnership = classes.stream()
                    .anyMatch(cls -> cls.getTeacher() == null
                            || cls.getTeacher().getUser() == null
                            || !teacherUserId.equals(cls.getTeacher().getUser().getId()));
            if (invalidOwnership) {
                throw new ForbiddenException("Teachers can only add students to their own classes");
            }
        }

        for (ClassEntity cls : classes) {
            classStudentRepository.save(ClassStudent.builder()
                    .classEntity(cls)
                    .student(student)
                    .build());
        }
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
        if (request.getStatus() != null && !request.getStatus().isBlank()) {
            user.setStatus(normalizeAccountStatus(request.getStatus()));
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
                .status(student.getUser().getStatus())
                .dateOfBirth(student.getDateOfBirth())
                .createdAt(student.getCreatedAt())
                .build();
    }

    private static String normalizeAccountStatus(String status) {
        if (status == null || status.isBlank()) {
            return "ACTIVE";
        }
        String normalized = status.trim().toUpperCase(Locale.ROOT);
        if (!ACCOUNT_STATUSES.contains(normalized)) {
            throw new BadRequestException("Unsupported account status");
        }
        return normalized;
    }
}
