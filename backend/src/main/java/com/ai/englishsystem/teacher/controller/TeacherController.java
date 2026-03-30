package com.ai.englishsystem.teacher.controller;

import com.ai.englishsystem.common.dto.ApiResponse;
import com.ai.englishsystem.teacher.dto.TeacherRequest;
import com.ai.englishsystem.teacher.dto.TeacherResponse;
import com.ai.englishsystem.teacher.service.TeacherService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/teachers")
@RequiredArgsConstructor
public class TeacherController {

    private final TeacherService teacherService;

    @GetMapping
    @org.springframework.security.access.prepost.PreAuthorize("hasAnyRole('TEACHER', 'ADMIN')")
    public ResponseEntity<ApiResponse<List<TeacherResponse>>> getAll() {
        return ResponseEntity.ok(ApiResponse.success(teacherService.findAll()));
    }

    @PostMapping
    @org.springframework.security.access.prepost.PreAuthorize("hasAnyRole('ADMIN')")
    public ResponseEntity<ApiResponse<TeacherResponse>> create(@Valid @RequestBody TeacherRequest request) {
        TeacherResponse response = teacherService.create(request);
        return ResponseEntity.ok(ApiResponse.success("Teacher created", response));
    }
}
