package com.ai.englishsystem.exam.controller;

import com.ai.englishsystem.common.dto.ApiResponse;
import com.ai.englishsystem.exam.dto.ExamSectionSummaryResponse;
import com.ai.englishsystem.exam.service.ExamService;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import org.springframework.http.ResponseEntity;

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
}
