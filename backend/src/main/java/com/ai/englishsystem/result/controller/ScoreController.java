package com.ai.englishsystem.result.controller;

import com.ai.englishsystem.common.dto.ApiResponse;
import com.ai.englishsystem.result.dto.ScoreResponse;
import com.ai.englishsystem.result.service.ScoreService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/scores")
@RequiredArgsConstructor
public class ScoreController {

    private final ScoreService scoreService;

    @GetMapping("/{submissionId}")
    @org.springframework.security.access.prepost.PreAuthorize("hasAnyRole('STUDENT', 'TEACHER', 'ADMIN')")
    public ResponseEntity<ApiResponse<ScoreResponse>> getBySubmissionId(@PathVariable Integer submissionId) {
        ScoreResponse response = scoreService.getBySubmissionId(submissionId);
        return ResponseEntity.ok(ApiResponse.success(response));
    }
}
