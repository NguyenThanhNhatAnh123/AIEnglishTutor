package com.ai.englishsystem.ai.controller;

import com.ai.englishsystem.ai.dto.AiScoreResponse;
import com.ai.englishsystem.ai.dto.ImageOcrTtsResponse;
import com.ai.englishsystem.ai.dto.SpeakingScoreRequest;
import com.ai.englishsystem.ai.dto.WritingScoreRequest;
import com.ai.englishsystem.ai.service.AiScoringService;
import com.ai.englishsystem.ai.service.ImageOcrTtsService;
import com.ai.englishsystem.common.dto.ApiResponse;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.http.MediaType;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

@RestController
@RequestMapping("/api/ai")
@RequiredArgsConstructor
public class AiController {

    private final AiScoringService aiScoringService;
    private final ImageOcrTtsService imageOcrTtsService;

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

    @PostMapping(value = "/image-ocr-tts", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @PreAuthorize("hasAnyRole('TEACHER', 'ADMIN', 'STUDENT')")
    public ResponseEntity<ApiResponse<ImageOcrTtsResponse>> imageOcrTts(@RequestParam("file") MultipartFile file) {
        ImageOcrTtsResponse response = imageOcrTtsService.processImage(file);
        return ResponseEntity.ok(ApiResponse.success("Image processed with OCR + TTS", response));
    }
}
