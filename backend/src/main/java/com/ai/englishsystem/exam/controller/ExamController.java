package com.ai.englishsystem.exam.controller;

import com.ai.englishsystem.common.dto.ApiResponse;
import com.ai.englishsystem.exam.dto.ExamRequest;
import com.ai.englishsystem.exam.dto.ExamResponse;
import com.ai.englishsystem.exam.service.ExamService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/exams")  // canonical path — no trailing slash, consistent with frontend
@RequiredArgsConstructor
public class ExamController {

    private final ExamService examService;

    // Only TEACHERS and ADMINS can list all exams (including DRAFT/CLOSED).
    // Students must use /api/student/exams which only returns ACTIVE exams.
    @GetMapping
    @PreAuthorize("hasAnyRole('TEACHER', 'ADMIN')")
    public ResponseEntity<ApiResponse<List<ExamResponse>>> getAll() {
        return ResponseEntity.ok(ApiResponse.success(examService.findAll()));
    }

    // Full exam payload may include correct MCQ keys — not exposed to students (use /api/student/exams/{id})
    @GetMapping("/{id}")
    @PreAuthorize("hasAnyRole('TEACHER', 'ADMIN')")
    public ResponseEntity<ApiResponse<ExamResponse>> getById(@PathVariable Integer id) {
        return ResponseEntity.ok(ApiResponse.success(examService.findById(id)));
    }

    // FIX: only TEACHER / ADMIN may create — teacher resolved from JWT (not request body)
    @PostMapping
    @PreAuthorize("hasAnyRole('TEACHER', 'ADMIN')")
    public ResponseEntity<ApiResponse<ExamResponse>> create(@Valid @RequestBody ExamRequest request) {
        ExamResponse response = examService.create(request);
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.success("Exam created successfully", response));
    }

    // FIX: NEW — full update endpoint
    @PutMapping("/{id}")
    @PreAuthorize("hasAnyRole('TEACHER', 'ADMIN')")
    public ResponseEntity<ApiResponse<ExamResponse>> update(
            @PathVariable Integer id,
            @Valid @RequestBody ExamRequest request) {
        ExamResponse response = examService.update(id, request);
        return ResponseEntity.ok(ApiResponse.success("Exam updated successfully", response));
    }

    // FIX: NEW — partial update endpoint (only non-null fields are applied)
    @PatchMapping("/{id}")
    @PreAuthorize("hasAnyRole('TEACHER', 'ADMIN')")
    public ResponseEntity<ApiResponse<ExamResponse>> partialUpdate(
            @PathVariable Integer id,
            @RequestBody ExamRequest request) {  // no @Valid — fields are optional in PATCH
        ExamResponse response = examService.partialUpdate(id, request);
        return ResponseEntity.ok(ApiResponse.success("Exam updated successfully", response));
    }

    // FIX: NEW — delete endpoint, returns 204 No Content on success
    @DeleteMapping("/{id}")
    @PreAuthorize("hasAnyRole('TEACHER', 'ADMIN')")
    public ResponseEntity<Void> delete(@PathVariable Integer id) {
        examService.delete(id);
        return ResponseEntity.noContent().build();
    }
}
