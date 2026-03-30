package com.ai.englishsystem.classmodule.service;

import com.ai.englishsystem.common.exception.NotFoundException;
import com.ai.englishsystem.classmodule.dto.ClassRequest;
import com.ai.englishsystem.classmodule.dto.ClassResponse;
import com.ai.englishsystem.classmodule.entity.ClassEntity;
import com.ai.englishsystem.classmodule.repository.ClassRepository;
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
    private final TeacherRepository teacherRepository;

    @Transactional(readOnly = true)
    public List<ClassResponse> findAll() {
        return classRepository.findAll().stream()
                .map(this::toResponse)
                .collect(Collectors.toList());
    }

    @Transactional
    public ClassResponse create(ClassRequest request) {
        Teacher teacher = teacherRepository.findById(request.getTeacherId())
                .orElseThrow(() -> new NotFoundException("Teacher", request.getTeacherId()));

        ClassEntity classEntity = ClassEntity.builder()
                .name(request.getName())
                .teacher(teacher)
                .description(request.getDescription())
                .build();

        classEntity = classRepository.save(classEntity);
        return toResponse(classEntity);
    }

    private ClassResponse toResponse(ClassEntity entity) {
        return ClassResponse.builder()
                .id(entity.getId())
                .name(entity.getName())
                .teacherId(entity.getTeacher().getId())
                .teacherName(entity.getTeacher().getUser().getFullName())
                .description(entity.getDescription())
                .createdAt(entity.getCreatedAt())
                .build();
    }
}
