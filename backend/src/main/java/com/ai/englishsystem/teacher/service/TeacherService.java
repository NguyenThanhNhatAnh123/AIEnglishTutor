package com.ai.englishsystem.teacher.service;

import com.ai.englishsystem.auth.entity.Role;
import com.ai.englishsystem.auth.repository.RoleRepository;
import com.ai.englishsystem.common.exception.BadRequestException;
import com.ai.englishsystem.common.exception.NotFoundException;
import com.ai.englishsystem.config.CacheNames;
import com.ai.englishsystem.teacher.dto.TeacherRequest;
import com.ai.englishsystem.teacher.dto.TeacherResponse;
import com.ai.englishsystem.teacher.entity.Teacher;
import com.ai.englishsystem.teacher.repository.TeacherRepository;
import com.ai.englishsystem.user.entity.User;
import com.ai.englishsystem.user.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.cache.annotation.CacheEvict;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class TeacherService {

    private final TeacherRepository teacherRepository;
    private final UserRepository userRepository;
    private final RoleRepository roleRepository;
    private final PasswordEncoder passwordEncoder;

    @Transactional(readOnly = true)
    @Cacheable(CacheNames.TEACHERS)
    public List<TeacherResponse> findAll() {
        return teacherRepository.findAll().stream()
                .map(this::toResponse)
                .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public Page<TeacherResponse> findAll(Pageable pageable) {
        return teacherRepository.findAllBy(pageable)
                .map(this::toResponse);
    }

    @Transactional
    @CacheEvict(value = CacheNames.TEACHERS, allEntries = true)
    public TeacherResponse create(TeacherRequest request) {
        User user = request.getUserId() != null
                ? userRepository.findById(request.getUserId())
                .orElseThrow(() -> new NotFoundException("User", request.getUserId()))
                : createTeacherUser(request);

        if (teacherRepository.existsByTeacherCode(request.getTeacherCode())) {
            throw new BadRequestException("Teacher code already exists");
        }
        if (teacherRepository.findFirstByUser(user).isPresent()) {
            throw new BadRequestException("This user already has a teacher profile");
        }

        Teacher teacher = Teacher.builder()
                .user(user)
                .teacherCode(request.getTeacherCode())
                .department(request.getDepartment())
                .build();

        try {
            teacher = teacherRepository.save(teacher);
        } catch (DataIntegrityViolationException ex) {
            throw new BadRequestException("Teacher code already exists");
        }
        return toResponse(teacher);
    }

    private User createTeacherUser(TeacherRequest request) {
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

        Role teacherRole = roleRepository.findByName("TEACHER")
                .orElseThrow(() -> new BadRequestException("Teacher role not found"));
        User user = User.builder()
                .username(username)
                .email(email)
                .password(passwordEncoder.encode(password))
                .fullName(resolveFullName(request, username))
                .role(teacherRole)
                .status(request.getStatus() != null && !request.getStatus().isBlank() ? request.getStatus() : "ACTIVE")
                .build();
        try {
            return userRepository.save(user);
        } catch (DataIntegrityViolationException ex) {
            throw new BadRequestException("Email or username already exists");
        }
    }

    private String resolveFullName(TeacherRequest request, String username) {
        String fullName = request.getFullName() == null ? "" : request.getFullName().trim();
        return fullName.isBlank() ? username : fullName;
    }

    private TeacherResponse toResponse(Teacher teacher) {
        return TeacherResponse.builder()
                .id(teacher.getId())
                .userId(teacher.getUser().getId())
                .teacherCode(teacher.getTeacherCode())
                .fullName(teacher.getUser().getFullName())
                .email(teacher.getUser().getEmail())
                .department(teacher.getDepartment())
                .createdAt(teacher.getCreatedAt())
                .build();
    }
}
