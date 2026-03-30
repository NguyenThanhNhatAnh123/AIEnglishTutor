package com.ai.englishsystem.submission.controller;

import com.ai.englishsystem.common.dto.ApiResponse;
import com.ai.englishsystem.submission.dto.StartSubmissionRequest;
import com.ai.englishsystem.submission.dto.SubmissionListResponse;
import com.ai.englishsystem.submission.dto.SubmissionResponse;
import com.ai.englishsystem.submission.dto.SubmitSubmissionRequest;
import com.ai.englishsystem.submission.service.SubmissionService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/submissions")
@RequiredArgsConstructor
public class SubmissionController {

    private final SubmissionService submissionService;

    @GetMapping
    @PreAuthorize("hasAnyRole('TEACHER', 'ADMIN')")
    public ResponseEntity<ApiResponse<List<SubmissionListResponse>>> listByExam(@RequestParam Integer examId) {
        List<SubmissionListResponse> list = submissionService.listByExam(examId);
        return ResponseEntity.ok(ApiResponse.success(list));
    }

    @PostMapping("/start")
    @PreAuthorize("hasRole('STUDENT')")
    public ResponseEntity<ApiResponse<SubmissionResponse>> start(@Valid @RequestBody StartSubmissionRequest request) {
        SubmissionResponse response = submissionService.start(request);
        return ResponseEntity.ok(ApiResponse.success("Exam started", response));
    }

    @PostMapping("/submit")
    @PreAuthorize("hasRole('STUDENT')")
    public ResponseEntity<ApiResponse<SubmissionResponse>> submit(@Valid @RequestBody SubmitSubmissionRequest request) {
        SubmissionResponse response = submissionService.submit(request);
        return ResponseEntity.ok(ApiResponse.success("Exam submitted", response));
    }
}
