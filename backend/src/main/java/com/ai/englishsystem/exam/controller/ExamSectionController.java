package com.ai.englishsystem.exam.controller;

import com.ai.englishsystem.common.dto.ApiResponse;
import com.ai.englishsystem.exam.dto.ExamSectionRequest;
import com.ai.englishsystem.exam.dto.ExamSectionSummaryResponse;
import com.ai.englishsystem.exam.dto.ExamSectionUpdateRequest;
import com.ai.englishsystem.exam.service.ExamService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/exams/{examId}/sections")
@RequiredArgsConstructor
public class ExamSectionController {

    private final ExamService examService;

    @GetMapping
    @PreAuthorize("hasAnyRole('TEACHER', 'ADMIN')")
    public ResponseEntity<ApiResponse<List<ExamSectionSummaryResponse>>> list(@PathVariable Integer examId) {
        return ResponseEntity.ok(ApiResponse.success(examService.listSections(examId)));
    }

    @PostMapping
    @PreAuthorize("hasAnyRole('TEACHER', 'ADMIN')")
    public ResponseEntity<ApiResponse<ExamSectionSummaryResponse>> create(
            @PathVariable Integer examId,
            @Valid @RequestBody ExamSectionRequest request) {
        ExamSectionSummaryResponse body = examService.createSection(examId, request);
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.success("Section created", body));
    }

    @PutMapping("/{sectionId}")
    @PreAuthorize("hasAnyRole('TEACHER', 'ADMIN')")
    public ResponseEntity<ApiResponse<ExamSectionSummaryResponse>> update(
            @PathVariable Integer examId,
            @PathVariable Integer sectionId,
            @RequestBody ExamSectionUpdateRequest request) {
        ExamSectionSummaryResponse body = examService.updateSection(examId, sectionId, request);
        return ResponseEntity.ok(ApiResponse.success("Section updated", body));
    }

    @DeleteMapping("/{sectionId}")
    @PreAuthorize("hasAnyRole('TEACHER', 'ADMIN')")
    public ResponseEntity<Void> delete(@PathVariable Integer examId, @PathVariable Integer sectionId) {
        examService.deleteSection(examId, sectionId);
        return ResponseEntity.noContent().build();
    }
}
