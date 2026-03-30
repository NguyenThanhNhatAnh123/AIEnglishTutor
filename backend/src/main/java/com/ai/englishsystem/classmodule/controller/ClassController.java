package com.ai.englishsystem.classmodule.controller;

import com.ai.englishsystem.classmodule.dto.ClassRequest;
import com.ai.englishsystem.classmodule.dto.ClassResponse;
import com.ai.englishsystem.classmodule.service.ClassService;
import com.ai.englishsystem.common.dto.ApiResponse;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/classes")
@RequiredArgsConstructor
public class ClassController {

    private final ClassService classService;

    @GetMapping
    @org.springframework.security.access.prepost.PreAuthorize("hasAnyRole('TEACHER', 'ADMIN')")
    public ResponseEntity<ApiResponse<List<ClassResponse>>> getAll() {
        return ResponseEntity.ok(ApiResponse.success(classService.findAll()));
    }

    @PostMapping
    @org.springframework.security.access.prepost.PreAuthorize("hasAnyRole('TEACHER', 'ADMIN')")
    public ResponseEntity<ApiResponse<ClassResponse>> create(@Valid @RequestBody ClassRequest request) {
        ClassResponse response = classService.create(request);
        return ResponseEntity.ok(ApiResponse.success("Class created", response));
    }
}
