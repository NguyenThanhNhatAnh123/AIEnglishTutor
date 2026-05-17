package com.ai.englishsystem.student.controller;

import com.ai.englishsystem.common.dto.ApiResponse;
import com.ai.englishsystem.common.dto.PageResponse;
import com.ai.englishsystem.student.dto.StudentRequest;
import com.ai.englishsystem.student.dto.StudentResponse;
import com.ai.englishsystem.student.dto.StudentUpdateRequest;
import com.ai.englishsystem.student.service.StudentService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/students")
@RequiredArgsConstructor
public class StudentController {

    private final StudentService studentService;

    @GetMapping("/me")
    @org.springframework.security.access.prepost.PreAuthorize("hasRole('STUDENT')")
    public ResponseEntity<ApiResponse<StudentResponse>> getCurrentStudent() {
        return ResponseEntity.ok(ApiResponse.success(studentService.getCurrentStudent()));
    }

    @GetMapping
    @org.springframework.security.access.prepost.PreAuthorize("hasAnyRole('TEACHER', 'ADMIN')")
    public ResponseEntity<ApiResponse<?>> getAll(
            @RequestParam(required = false) Integer page,
            @RequestParam(required = false) Integer size) {
        if (page != null || size != null) {
            return ResponseEntity.ok(ApiResponse.success(PageResponse.from(
                    studentService.findAll(pageRequest(page, size)))));
        }
        return ResponseEntity.ok(ApiResponse.success(studentService.findAll()));
    }

    @PostMapping
    @org.springframework.security.access.prepost.PreAuthorize("hasAnyRole('TEACHER', 'ADMIN')")
    public ResponseEntity<ApiResponse<StudentResponse>> create(@Valid @RequestBody StudentRequest request) {
        StudentResponse response = studentService.create(request);
        return ResponseEntity.ok(ApiResponse.success("Student created", response));
    }

    @GetMapping("/{id}")
    @org.springframework.security.access.prepost.PreAuthorize("hasAnyRole('TEACHER', 'ADMIN')")
    public ResponseEntity<ApiResponse<StudentResponse>> getById(@PathVariable Integer id) {
        return ResponseEntity.ok(ApiResponse.success(studentService.findById(id)));
    }

    @PutMapping("/{id}")
    @org.springframework.security.access.prepost.PreAuthorize("hasAnyRole('TEACHER', 'ADMIN')")
    public ResponseEntity<ApiResponse<StudentResponse>> update(
            @PathVariable Integer id,
            @Valid @RequestBody StudentUpdateRequest request) {
        StudentResponse response = studentService.update(id, request);
        return ResponseEntity.ok(ApiResponse.success("Student updated", response));
    }

    @DeleteMapping("/{id}")
    @org.springframework.security.access.prepost.PreAuthorize("hasAnyRole('TEACHER', 'ADMIN')")
    public ResponseEntity<ApiResponse<String>> delete(@PathVariable Integer id) {
        studentService.delete(id);
        return ResponseEntity.ok(ApiResponse.success("Student deleted", "ok"));
    }

    private PageRequest pageRequest(Integer page, Integer size) {
        int safePage = page == null ? 0 : Math.max(0, page);
        int safeSize = size == null ? 25 : Math.min(Math.max(1, size), 100);
        return PageRequest.of(safePage, safeSize, Sort.by(Sort.Direction.DESC, "id"));
    }
}
