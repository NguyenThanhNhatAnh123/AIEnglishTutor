package com.ai.englishsystem.ai.controller;

import com.ai.englishsystem.ai.dto.AiScoreResponse;
import com.ai.englishsystem.ai.dto.ImageOcrTtsResponse;
import com.ai.englishsystem.ai.dto.OcrToQuestionResponse;
import com.ai.englishsystem.ai.dto.PaperOcrResponse;
import com.ai.englishsystem.ai.dto.SpeakingScoreRequest;
import com.ai.englishsystem.ai.dto.TextToSpeechRequest;
import com.ai.englishsystem.ai.dto.TextToSpeechResponse;
import com.ai.englishsystem.ai.dto.WritingScoreRequest;
import com.ai.englishsystem.ai.service.AiScoringService;
import com.ai.englishsystem.ai.service.ImageOcrTtsService;
import com.ai.englishsystem.common.dto.ApiResponse;
import com.ai.englishsystem.common.exception.BadRequestException;
import com.ai.englishsystem.exam.dto.QuestionOptionRequest;
import com.ai.englishsystem.exam.dto.QuestionRequest;
import com.ai.englishsystem.exam.dto.QuestionResponse;
import com.ai.englishsystem.exam.service.QuestionService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.http.MediaType;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.util.StringUtils;

import java.util.ArrayList;
import java.util.List;

@RestController
@RequestMapping("/api/ai")
@RequiredArgsConstructor
public class AiController {

    private final AiScoringService aiScoringService;
    private final ImageOcrTtsService imageOcrTtsService;
    private final QuestionService questionService;

    @PostMapping("/score-writing")
    @PreAuthorize("hasAnyRole('TEACHER', 'ADMIN')")
    public ResponseEntity<ApiResponse<AiScoreResponse>> scoreWriting(@Valid @RequestBody WritingScoreRequest request) {
        AiScoreResponse response = aiScoringService.scoreWriting(request);
        return ResponseEntity.ok(ApiResponse.success("Writing scored", response));
    }

    @PostMapping("/score-speaking")
    @PreAuthorize("hasAnyRole('TEACHER', 'ADMIN')")
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

    @PostMapping(value = "/ocr-paper", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @PreAuthorize("hasAnyRole('TEACHER', 'ADMIN')")
    public ResponseEntity<ApiResponse<PaperOcrResponse>> ocrPaper(@RequestParam("file") MultipartFile file) {
        PaperOcrResponse response = imageOcrTtsService.processPaper(file);
        return ResponseEntity.ok(ApiResponse.success("Paper processed with OCR", response));
    }

    @PostMapping("/tts")
    @PreAuthorize("hasAnyRole('TEACHER', 'ADMIN', 'STUDENT')")
    public ResponseEntity<ApiResponse<TextToSpeechResponse>> textToSpeech(
            @RequestBody(required = false) TextToSpeechRequest request,
            @RequestParam(name = "text", required = false) String text) {
        String effective = request != null ? request.getText() : text;
        if (!StringUtils.hasText(effective)) {
            // Keep consistent with other validation responses
            throw new com.ai.englishsystem.common.exception.BadRequestException("text must not be blank");
        }
        String audioUrl = imageOcrTtsService.synthesizeTextToAudio(effective);
        TextToSpeechResponse response = TextToSpeechResponse.builder().audioUrl(audioUrl).build();
        return ResponseEntity.ok(ApiResponse.success("Text converted to speech", response));
    }

    @PostMapping(value = "/ocr-to-question", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @PreAuthorize("hasAnyRole('TEACHER', 'ADMIN')")
    public ResponseEntity<ApiResponse<OcrToQuestionResponse>> ocrToQuestion(
            @RequestParam("file") MultipartFile file,
            @RequestParam("sectionId") Integer sectionId,
            @RequestParam(name = "points", required = false, defaultValue = "1") Integer points,
            @RequestParam(name = "correctChoiceIndex", required = false, defaultValue = "0") Integer correctChoiceIndex,
            @RequestParam(name = "questionType", required = false, defaultValue = "MULTIPLE_CHOICE") String questionType) {
        ImageOcrTtsResponse ocr = imageOcrTtsService.processImage(file);
        QuestionRequest questionRequest = buildQuestionRequest(ocr, sectionId, points, correctChoiceIndex, questionType);
        QuestionResponse created = questionService.create(questionRequest);
        OcrToQuestionResponse response = OcrToQuestionResponse.builder()
                .ocr(ocr)
                .question(created)
                .build();
        return ResponseEntity.ok(ApiResponse.success("OCR completed and question created", response));
    }

    private QuestionRequest buildQuestionRequest(
            ImageOcrTtsResponse ocr,
            Integer sectionId,
            Integer points,
            Integer correctChoiceIndex,
            String questionType
    ) {
        String questionText = ocr.getQuestionText() != null && !ocr.getQuestionText().isBlank()
                ? ocr.getQuestionText().trim()
                : (ocr.getExtractedText() != null ? ocr.getExtractedText().trim() : "");
        if (questionText.isBlank()) {
            throw new BadRequestException("OCR did not return question text");
        }

        List<String> rawChoices = ocr.getChoices() == null ? List.of() : ocr.getChoices();
        List<String> nonBlankChoices = rawChoices.stream()
                .map(choice -> choice == null ? "" : choice.trim())
                .filter(choice -> !choice.isBlank())
                .toList();
        if (nonBlankChoices.size() < 2) {
            throw new BadRequestException("OCR did not return at least two non-blank choices");
        }

        int correctIndex = correctChoiceIndex == null ? 0 : correctChoiceIndex;
        if (correctIndex < 0 || correctIndex >= nonBlankChoices.size()) {
            throw new BadRequestException("correctChoiceIndex is out of range for OCR choices");
        }
        String normalizedType = questionType == null ? "MULTIPLE_CHOICE" : questionType.trim().toUpperCase();
        if (!List.of("MULTIPLE_CHOICE", "LISTENING").contains(normalizedType)) {
            throw new BadRequestException("questionType must be MULTIPLE_CHOICE or LISTENING");
        }
        if ("LISTENING".equals(normalizedType) && !StringUtils.hasText(ocr.getAudioUrl())) {
            throw new BadRequestException("OCR TTS audio is not available. Retry OCR or create as MULTIPLE_CHOICE.");
        }

        List<QuestionOptionRequest> options = new ArrayList<>();
        for (int i = 0; i < nonBlankChoices.size(); i++) {
            options.add(QuestionOptionRequest.builder()
                    .optionText(nonBlankChoices.get(i))
                    .isCorrect(i == correctIndex)
                    .build());
        }

        return QuestionRequest.builder()
                .sectionId(sectionId)
                .questionText(questionText)
                .questionType(normalizedType)
                .points(points == null || points < 1 ? 1 : points)
                .listeningAudioUrl("LISTENING".equals(normalizedType) ? ocr.getAudioUrl() : null)
                .transcript(ocr.getExtractedText())
                .options(options)
                .build();
    }
}
