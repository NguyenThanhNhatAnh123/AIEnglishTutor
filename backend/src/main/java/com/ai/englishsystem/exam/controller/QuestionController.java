package com.ai.englishsystem.exam.controller;

import com.ai.englishsystem.common.dto.ApiResponse;
import com.ai.englishsystem.exam.dto.QuestionRequest;
import com.ai.englishsystem.exam.dto.QuestionResponse;
import com.ai.englishsystem.exam.service.QuestionService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/questions")
@RequiredArgsConstructor
public class QuestionController {

    private final QuestionService questionService;

    @GetMapping
    @org.springframework.security.access.prepost.PreAuthorize("hasAnyRole('TEACHER', 'ADMIN')")
    public ResponseEntity<ApiResponse<List<QuestionResponse>>> getAll() {
        return ResponseEntity.ok(ApiResponse.success(questionService.findAll()));
    }

    @PostMapping
    @org.springframework.security.access.prepost.PreAuthorize("hasAnyRole('TEACHER', 'ADMIN')")
    public ResponseEntity<ApiResponse<QuestionResponse>> create(@Valid @RequestBody QuestionRequest request) {
        QuestionResponse response = questionService.create(request);
        return ResponseEntity.ok(ApiResponse.success("Question created", response));
    }
}
