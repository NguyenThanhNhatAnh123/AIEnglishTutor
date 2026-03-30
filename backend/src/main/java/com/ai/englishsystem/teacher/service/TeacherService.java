package com.ai.englishsystem.teacher.service;

import com.ai.englishsystem.common.exception.BadRequestException;
import com.ai.englishsystem.common.exception.NotFoundException;
import com.ai.englishsystem.teacher.dto.TeacherRequest;
import com.ai.englishsystem.teacher.dto.TeacherResponse;
import com.ai.englishsystem.teacher.entity.Teacher;
import com.ai.englishsystem.teacher.repository.TeacherRepository;
import com.ai.englishsystem.user.entity.User;
import com.ai.englishsystem.user.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class TeacherService {

    private final TeacherRepository teacherRepository;
    private final UserRepository userRepository;

    @Transactional(readOnly = true)
    public List<TeacherResponse> findAll() {
        return teacherRepository.findAll().stream()
                .map(this::toResponse)
                .collect(Collectors.toList());
    }

    @Transactional
    public TeacherResponse create(TeacherRequest request) {
        User user = userRepository.findById(request.getUserId())
                .orElseThrow(() -> new NotFoundException("User", request.getUserId()));

        if (teacherRepository.existsByTeacherCode(request.getTeacherCode())) {
            throw new BadRequestException("Teacher code already exists");
        }

        Teacher teacher = Teacher.builder()
                .user(user)
                .teacherCode(request.getTeacherCode())
                .department(request.getDepartment())
                .build();

        teacher = teacherRepository.save(teacher);
        return toResponse(teacher);
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
