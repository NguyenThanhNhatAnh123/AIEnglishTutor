package com.ai.englishsystem.ai.controller;

import com.ai.englishsystem.ai.dto.AiScoreResponse;
import com.ai.englishsystem.ai.dto.SpeakingScoreRequest;
import com.ai.englishsystem.ai.dto.WritingScoreRequest;
import com.ai.englishsystem.ai.service.AiScoringService;
import com.ai.englishsystem.common.dto.ApiResponse;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/ai")
@RequiredArgsConstructor
public class AiController {

    private final AiScoringService aiScoringService;

    @PostMapping("/score-writing")
    @PreAuthorize("hasAnyRole('TEACHER', 'ADMIN', 'STUDENT')")
    public ResponseEntity<ApiResponse<AiScoreResponse>> scoreWriting(@Valid @RequestBody WritingScoreRequest request) {
        AiScoreResponse response = aiScoringService.scoreWriting(request);
        return ResponseEntity.ok(ApiResponse.success("Writing scored", response));
    }

    @PostMapping("/score-speaking")
    @PreAuthorize("hasAnyRole('TEACHER', 'ADMIN', 'STUDENT')")
    public ResponseEntity<ApiResponse<AiScoreResponse>> scoreSpeaking(@Valid @RequestBody SpeakingScoreRequest request) {
        AiScoreResponse response = aiScoringService.scoreSpeaking(request);
        return ResponseEntity.ok(ApiResponse.success("Speaking scored", response));
    }
}
