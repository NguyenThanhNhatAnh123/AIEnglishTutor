package com.ai.englishsystem.submission.controller;

import com.ai.englishsystem.common.dto.ApiResponse;
import com.ai.englishsystem.submission.dto.AnswerRequest;
import com.ai.englishsystem.submission.dto.AnswerResponse;
import com.ai.englishsystem.submission.service.AnswerService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/answers")
@RequiredArgsConstructor
public class AnswerController {

    private final AnswerService answerService;

    @PostMapping
    @PreAuthorize("hasRole('STUDENT')")
    public ResponseEntity<ApiResponse<AnswerResponse>> save(@Valid @RequestBody AnswerRequest request) {
        AnswerResponse response = answerService.saveOrUpdate(request);
        return ResponseEntity.ok(ApiResponse.success("Answer saved", response));
    }
}
