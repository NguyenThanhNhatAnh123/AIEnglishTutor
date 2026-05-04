package com.ai.englishsystem.result.controller;

import com.ai.englishsystem.common.dto.ApiResponse;
import com.ai.englishsystem.result.dto.GenerateWritingReviewRequest;
import com.ai.englishsystem.result.dto.UpdateWritingReviewRequest;
import com.ai.englishsystem.result.dto.WritingReviewResponse;
import com.ai.englishsystem.result.service.WritingReviewService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/writing-reviews")
@RequiredArgsConstructor
public class WritingReviewController {

    private final WritingReviewService writingReviewService;

    @PostMapping("/answers/{answerId}/generate-draft")
    @PreAuthorize("hasAnyRole('TEACHER', 'ADMIN')")
    public ResponseEntity<ApiResponse<WritingReviewResponse>> generateDraft(
            @PathVariable Integer answerId,
            @RequestBody(required = false) GenerateWritingReviewRequest request) {
        String customPrompt = request != null ? request.getCustomPrompt() : null;
        WritingReviewResponse response = writingReviewService.generateDraft(answerId, customPrompt);
        return ResponseEntity.ok(ApiResponse.success("Draft AI writing review generated", response));
    }

    @PutMapping("/answers/{answerId}")
    @PreAuthorize("hasAnyRole('TEACHER', 'ADMIN')")
    public ResponseEntity<ApiResponse<WritingReviewResponse>> updateDraft(
            @PathVariable Integer answerId,
            @RequestBody UpdateWritingReviewRequest request) {
        WritingReviewResponse response = writingReviewService.updateDraft(answerId, request);
        return ResponseEntity.ok(ApiResponse.success("Draft writing review updated", response));
    }

    @PostMapping("/answers/{answerId}/approve-publish")
    @PreAuthorize("hasAnyRole('TEACHER', 'ADMIN')")
    public ResponseEntity<ApiResponse<WritingReviewResponse>> approveAndPublish(@PathVariable Integer answerId) {
        WritingReviewResponse response = writingReviewService.approveAndPublish(answerId);
        return ResponseEntity.ok(ApiResponse.success("Writing review published", response));
    }

    @PostMapping("/answers/{answerId}/revert-draft")
    @PreAuthorize("hasAnyRole('TEACHER', 'ADMIN')")
    public ResponseEntity<ApiResponse<WritingReviewResponse>> revertToDraft(@PathVariable Integer answerId) {
        WritingReviewResponse response = writingReviewService.revertToDraft(answerId);
        return ResponseEntity.ok(ApiResponse.success("Writing review moved back to draft", response));
    }
}
