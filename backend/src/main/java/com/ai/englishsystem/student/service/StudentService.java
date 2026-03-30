package com.ai.englishsystem.student.service;

import com.ai.englishsystem.common.exception.BadRequestException;
import com.ai.englishsystem.common.exception.ForbiddenException;
import com.ai.englishsystem.common.exception.NotFoundException;
import com.ai.englishsystem.common.util.SecurityUtils;
import com.ai.englishsystem.student.dto.StudentRequest;
import com.ai.englishsystem.student.dto.StudentResponse;
import com.ai.englishsystem.student.entity.Student;
import com.ai.englishsystem.student.repository.StudentRepository;
import com.ai.englishsystem.user.entity.User;
import com.ai.englishsystem.user.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class StudentService {

    private final StudentRepository studentRepository;
    private final UserRepository userRepository;

    @Transactional(readOnly = true)
    public StudentResponse getCurrentStudent() {
        Integer userId = SecurityUtils.getCurrentUserId();
        return studentRepository.findByUser_Id(userId)
                .map(this::toResponse)
                .orElseThrow(() -> new ForbiddenException("Student profile not found for current user"));
    }

    @Transactional(readOnly = true)
    public List<StudentResponse> findAll() {
        return studentRepository.findAll().stream()
                .map(this::toResponse)
                .collect(Collectors.toList());
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

        student = studentRepository.save(student);
        return toResponse(student);
    }

    private StudentResponse toResponse(Student student) {
        return StudentResponse.builder()
                .id(student.getId())
                .userId(student.getUser().getId())
                .studentCode(student.getStudentCode())
                .fullName(student.getUser().getFullName())
                .email(student.getUser().getEmail())
                .dateOfBirth(student.getDateOfBirth())
                .createdAt(student.getCreatedAt())
                .build();
    }
}
