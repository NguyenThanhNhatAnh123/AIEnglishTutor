package com.ai.englishsystem.classmodule.controller;

import com.ai.englishsystem.classmodule.dto.ClassRequest;
import com.ai.englishsystem.classmodule.dto.ClassResponse;
import com.ai.englishsystem.classmodule.dto.ClassWorkspaceResponse;
import com.ai.englishsystem.classmodule.service.ClassService;
import com.ai.englishsystem.common.dto.ApiResponse;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/classes")
@RequiredArgsConstructor
@PreAuthorize("hasAnyRole('TEACHER', 'ADMIN')")
public class ClassController {

    private final ClassService classService;

    @GetMapping
    public ResponseEntity<ApiResponse<List<ClassResponse>>> getAll() {
        return ResponseEntity.ok(ApiResponse.success(classService.findAll()));
    }

    @GetMapping("/workspace")
    public ResponseEntity<ApiResponse<ClassWorkspaceResponse>> workspace() {
        return ResponseEntity.ok(ApiResponse.success(classService.workspace()));
    }

    @GetMapping("/{id}")
    public ResponseEntity<ApiResponse<ClassResponse>> getById(@PathVariable Integer id) {
        return ResponseEntity.ok(ApiResponse.success(classService.findById(id)));
    }

    @PostMapping
    public ResponseEntity<ApiResponse<ClassResponse>> create(@Valid @RequestBody ClassRequest request) {
        ClassResponse response = classService.create(request);
        return ResponseEntity.ok(ApiResponse.success("Class created successfully", response));
    }

    @PutMapping("/{id}")
    public ResponseEntity<ApiResponse<ClassResponse>> update(
            @PathVariable Integer id,
            @Valid @RequestBody ClassRequest request) {
        ClassResponse response = classService.update(id, request);
        return ResponseEntity.ok(ApiResponse.success("Class updated successfully", response));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<ApiResponse<Void>> delete(@PathVariable Integer id) {
        classService.delete(id);
        return ResponseEntity.ok(ApiResponse.success("Class deleted successfully", null));
    }
}
