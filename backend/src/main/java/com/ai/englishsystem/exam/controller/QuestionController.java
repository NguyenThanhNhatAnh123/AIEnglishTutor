package com.ai.englishsystem.exam.controller;

import com.ai.englishsystem.common.dto.ApiResponse;
import com.ai.englishsystem.common.dto.PageResponse;
import com.ai.englishsystem.exam.dto.BulkQuestionCreateRequest;
import com.ai.englishsystem.exam.dto.QuestionRequest;
import com.ai.englishsystem.exam.dto.QuestionResponse;
import com.ai.englishsystem.exam.service.QuestionService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/questions")
@RequiredArgsConstructor
public class QuestionController {

    private final QuestionService questionService;

    @GetMapping
    @PreAuthorize("hasAnyRole('TEACHER', 'ADMIN')")
    public ResponseEntity<ApiResponse<?>> getAll(
            @RequestParam(required = false) Integer examId,
            @RequestParam(required = false) Integer page,
            @RequestParam(required = false) Integer size) {
        if (page != null || size != null) {
            return ResponseEntity.ok(ApiResponse.success(PageResponse.from(
                    questionService.findAll(examId, pageRequest(page, size)))));
        }
        return ResponseEntity.ok(ApiResponse.success(questionService.findAll(examId)));
    }

    @PostMapping
    @PreAuthorize("hasAnyRole('TEACHER', 'ADMIN')")
    public ResponseEntity<ApiResponse<QuestionResponse>> create(@Valid @RequestBody QuestionRequest request) {
        QuestionResponse response = questionService.create(request);
        return ResponseEntity.ok(ApiResponse.success("Question created", response));
    }

    @PostMapping("/bulk")
    @PreAuthorize("hasAnyRole('TEACHER', 'ADMIN')")
    public ResponseEntity<ApiResponse<List<QuestionResponse>>> createBulk(
            @Valid @RequestBody BulkQuestionCreateRequest request) {
        List<QuestionResponse> response = questionService.createBulk(request.getQuestions());
        return ResponseEntity.ok(ApiResponse.success("Questions created", response));
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasAnyRole('TEACHER', 'ADMIN')")
    public ResponseEntity<ApiResponse<QuestionResponse>> update(
            @PathVariable Integer id,
            @RequestBody QuestionRequest request) {
        QuestionResponse response = questionService.update(id, request);
        return ResponseEntity.ok(ApiResponse.success("Question updated", response));
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasAnyRole('TEACHER', 'ADMIN')")
    public ResponseEntity<Void> delete(@PathVariable Integer id) {
        questionService.delete(id);
        return ResponseEntity.noContent().build();
    }

    private PageRequest pageRequest(Integer page, Integer size) {
        int safePage = page == null ? 0 : Math.max(0, page);
        int safeSize = size == null ? 25 : Math.min(Math.max(1, size), 100);
        return PageRequest.of(safePage, safeSize, Sort.by(Sort.Direction.DESC, "id"));
    }
}
