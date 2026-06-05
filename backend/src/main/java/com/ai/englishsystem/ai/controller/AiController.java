package com.ai.englishsystem.ai.controller;

import com.ai.englishsystem.ai.dto.ImageOcrTtsResponse;
import com.ai.englishsystem.ai.dto.PaperOcrResponse;
import com.ai.englishsystem.ai.dto.TextToSpeechRequest;
import com.ai.englishsystem.ai.dto.TextToSpeechResponse;
import com.ai.englishsystem.ai.service.AiConcurrencyLimiter;
import com.ai.englishsystem.ai.service.ImageOcrTtsService;
import com.ai.englishsystem.common.async.BoundedAsyncExecutor;
import com.ai.englishsystem.common.dto.ApiResponse;
import com.ai.englishsystem.common.exception.BadRequestException;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.http.MediaType;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.util.StringUtils;

import java.util.concurrent.CompletableFuture;

@RestController
@RequestMapping("/api/ai")
@RequiredArgsConstructor
public class AiController {

    private final ImageOcrTtsService imageOcrTtsService;
    private final AiConcurrencyLimiter aiConcurrencyLimiter;
    private final BoundedAsyncExecutor boundedAsyncExecutor;

    @PostMapping(value = "/image-ocr-tts", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @PreAuthorize("hasAnyRole('TEACHER', 'ADMIN', 'STUDENT')")
    public CompletableFuture<ResponseEntity<ApiResponse<ImageOcrTtsResponse>>> imageOcrTts(@RequestParam("file") MultipartFile file) {
        return boundedAsyncExecutor.submit(() -> {
            ImageOcrTtsResponse response = aiConcurrencyLimiter.run(() -> imageOcrTtsService.processImage(file));
            return ResponseEntity.ok(ApiResponse.success("Image processed with OCR + TTS", response));
        });
    }

    @PostMapping(value = "/ocr-paper", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @PreAuthorize("hasAnyRole('TEACHER', 'ADMIN')")
    public CompletableFuture<ResponseEntity<ApiResponse<PaperOcrResponse>>> ocrPaper(@RequestParam("file") MultipartFile file) {
        return boundedAsyncExecutor.submit(() -> {
            PaperOcrResponse response = aiConcurrencyLimiter.run(() -> imageOcrTtsService.processPaper(file));
            return ResponseEntity.ok(ApiResponse.success("Paper processed with OCR", response));
        });
    }

    @PostMapping("/tts")
    @PreAuthorize("hasAnyRole('TEACHER', 'ADMIN', 'STUDENT')")
    public CompletableFuture<ResponseEntity<ApiResponse<TextToSpeechResponse>>> textToSpeech(
            @RequestBody(required = false) TextToSpeechRequest request,
            @RequestParam(name = "text", required = false) String text) {
        String effective = request != null ? request.getText() : text;
        if (!StringUtils.hasText(effective)) {
            throw new BadRequestException("text must not be blank");
        }
        return boundedAsyncExecutor.submit(() -> {
            String audioUrl = aiConcurrencyLimiter.run(() -> imageOcrTtsService.synthesizeTextToAudio(effective));
            TextToSpeechResponse response = TextToSpeechResponse.builder().audioUrl(audioUrl).build();
            return ResponseEntity.ok(ApiResponse.success("Text converted to speech", response));
        });
    }
}
