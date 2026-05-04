package com.ai.englishsystem.result.controller;

import com.ai.englishsystem.common.dto.ApiResponse;
import com.ai.englishsystem.result.dto.GenerateSpeakingReviewRequest;
import com.ai.englishsystem.result.dto.SpeakingReviewResponse;
import com.ai.englishsystem.result.dto.UpdateSpeakingReviewRequest;
import com.ai.englishsystem.result.service.SpeakingReviewService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/speaking-reviews")
@RequiredArgsConstructor
public class SpeakingReviewController {

    private final SpeakingReviewService speakingReviewService;

    @PostMapping("/answers/{answerId}/generate-draft")
    @PreAuthorize("hasAnyRole('TEACHER', 'ADMIN')")
    public ResponseEntity<ApiResponse<SpeakingReviewResponse>> generateDraft(
            @PathVariable Integer answerId,
            @RequestBody(required = false) GenerateSpeakingReviewRequest request) {
        String customPrompt = request != null ? request.getCustomPrompt() : null;
        String language = request != null ? request.getLanguage() : null;
        SpeakingReviewResponse response = speakingReviewService.generateDraft(answerId, customPrompt, language);
        return ResponseEntity.ok(ApiResponse.success("Draft AI speaking review generated", response));
    }

    @PutMapping("/answers/{answerId}")
    @PreAuthorize("hasAnyRole('TEACHER', 'ADMIN')")
    public ResponseEntity<ApiResponse<SpeakingReviewResponse>> updateDraft(
            @PathVariable Integer answerId,
            @RequestBody UpdateSpeakingReviewRequest request) {
        SpeakingReviewResponse response = speakingReviewService.updateDraft(answerId, request);
        return ResponseEntity.ok(ApiResponse.success("Draft speaking review updated", response));
    }

    @PostMapping("/answers/{answerId}/approve-publish")
    @PreAuthorize("hasAnyRole('TEACHER', 'ADMIN')")
    public ResponseEntity<ApiResponse<SpeakingReviewResponse>> approveAndPublish(@PathVariable Integer answerId) {
        SpeakingReviewResponse response = speakingReviewService.approveAndPublish(answerId);
        return ResponseEntity.ok(ApiResponse.success("Speaking review published", response));
    }

    @PostMapping("/answers/{answerId}/revert-draft")
    @PreAuthorize("hasAnyRole('TEACHER', 'ADMIN')")
    public ResponseEntity<ApiResponse<SpeakingReviewResponse>> revertToDraft(@PathVariable Integer answerId) {
        SpeakingReviewResponse response = speakingReviewService.revertToDraft(answerId);
        return ResponseEntity.ok(ApiResponse.success("Speaking review moved back to draft", response));
    }
}
