package com.ai.englishsystem.speaking.controller;

import com.ai.englishsystem.common.dto.ApiResponse;
import com.ai.englishsystem.common.async.BoundedAsyncExecutor;
import com.ai.englishsystem.speaking.dto.SpeakingUploadResponse;
import com.ai.englishsystem.speaking.service.SpeakingUploadService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.concurrent.CompletableFuture;

@RestController
@RequestMapping("/api/speaking")
@RequiredArgsConstructor
@PreAuthorize("hasRole('STUDENT')")
public class SpeakingController {

    private final SpeakingUploadService speakingUploadService;
    private final BoundedAsyncExecutor boundedAsyncExecutor;

    @PostMapping("/upload")
    public CompletableFuture<ResponseEntity<ApiResponse<SpeakingUploadResponse>>> upload(
            @RequestParam("file") MultipartFile file,
            @RequestParam("submissionId") Integer submissionId,
            @RequestParam("questionId") Integer questionId) {
        return boundedAsyncExecutor.submit(() -> {
            SpeakingUploadResponse body = speakingUploadService.upload(submissionId, questionId, file);
            return ResponseEntity.ok(ApiResponse.success("Audio uploaded", body));
        });
    }
}
