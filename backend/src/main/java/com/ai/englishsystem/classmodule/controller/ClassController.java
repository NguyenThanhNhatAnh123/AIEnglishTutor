package com.ai.englishsystem.classmodule.controller;

import com.ai.englishsystem.classmodule.dto.ClassRequest;
import com.ai.englishsystem.classmodule.dto.ClassResponse;
import com.ai.englishsystem.classmodule.dto.ClassStudentResponse;
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

    // ─── LIST ───────────────────────────────────────────────────────────────

    @GetMapping
    public ResponseEntity<ApiResponse<List<ClassResponse>>> getAll() {
        return ResponseEntity.ok(ApiResponse.success(classService.findAll()));
    }

    // ─── DETAIL ─────────────────────────────────────────────────────────────

    @GetMapping("/{id}")
    public ResponseEntity<ApiResponse<ClassResponse>> getById(@PathVariable Integer id) {
        return ResponseEntity.ok(ApiResponse.success(classService.findById(id)));
    }

    // ─── CREATE ─────────────────────────────────────────────────────────────

    @PostMapping
    public ResponseEntity<ApiResponse<ClassResponse>> create(@Valid @RequestBody ClassRequest request) {
        ClassResponse response = classService.create(request);
        return ResponseEntity.ok(ApiResponse.success("Class created successfully", response));
    }

    // ─── UPDATE ─────────────────────────────────────────────────────────────

    @PutMapping("/{id}")
    public ResponseEntity<ApiResponse<ClassResponse>> update(
            @PathVariable Integer id,
            @Valid @RequestBody ClassRequest request) {
        ClassResponse response = classService.update(id, request);
        return ResponseEntity.ok(ApiResponse.success("Class updated successfully", response));
    }

    // ─── DELETE ─────────────────────────────────────────────────────────────

    @DeleteMapping("/{id}")
    public ResponseEntity<ApiResponse<Void>> delete(@PathVariable Integer id) {
        classService.delete(id);
        return ResponseEntity.ok(ApiResponse.success("Class deleted successfully", null));
    }

    // ─── GET STUDENTS ────────────────────────────────────────────────────────

    @GetMapping("/{id}/students")
    public ResponseEntity<ApiResponse<List<ClassStudentResponse>>> getStudents(@PathVariable Integer id) {
        return ResponseEntity.ok(ApiResponse.success(classService.getStudents(id)));
    }

    // ─── ADD STUDENT ────────────────────────────────────────────────────────

    @PostMapping("/{id}/students/{studentId}")
    public ResponseEntity<ApiResponse<ClassStudentResponse>> addStudent(
            @PathVariable Integer id,
            @PathVariable Integer studentId) {
        ClassStudentResponse response = classService.addStudent(id, studentId);
        return ResponseEntity.ok(ApiResponse.success("Student added to class", response));
    }

    // ─── REMOVE STUDENT ─────────────────────────────────────────────────────

    @DeleteMapping("/{id}/students/{studentId}")
    public ResponseEntity<ApiResponse<Void>> removeStudent(
            @PathVariable Integer id,
            @PathVariable Integer studentId) {
        classService.removeStudent(id, studentId);
        return ResponseEntity.ok(ApiResponse.success("Student removed from class", null));
    }
}
