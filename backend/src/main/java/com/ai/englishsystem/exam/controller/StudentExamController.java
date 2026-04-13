package com.ai.englishsystem.exam.controller;

import com.ai.englishsystem.common.dto.ApiResponse;
import com.ai.englishsystem.exam.dto.student.StudentExamDetailResponse;
import com.ai.englishsystem.exam.service.StudentExamService;
import com.ai.englishsystem.submission.dto.AnswerRequest;
import com.ai.englishsystem.submission.dto.AnswerResponse;
import com.ai.englishsystem.submission.dto.StudentSubmitExamResponse;
import com.ai.englishsystem.submission.dto.SubmissionResponse;
import com.ai.englishsystem.submission.service.AnswerService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/student")
@RequiredArgsConstructor
@PreAuthorize("hasRole('STUDENT')")
public class StudentExamController {

    private final StudentExamService studentExamService;
    private final AnswerService answerService;

    @PostMapping("/exams/{examId}/start")
    public ResponseEntity<ApiResponse<SubmissionResponse>> startExam(@PathVariable Integer examId) {
        SubmissionResponse body = studentExamService.startExam(examId);
        return ResponseEntity.ok(ApiResponse.success("Exam started", body));
    }

    @GetMapping("/exams/{examId}")
    public ResponseEntity<ApiResponse<StudentExamDetailResponse>> getExam(@PathVariable Integer examId) {
        StudentExamDetailResponse body = studentExamService.getExamForStudent(examId);
        return ResponseEntity.ok(ApiResponse.success(body));
    }

    @PostMapping("/answers")
    public ResponseEntity<ApiResponse<AnswerResponse>> saveAnswer(@Valid @RequestBody AnswerRequest request) {
        AnswerResponse body = answerService.saveOrUpdate(request);
        return ResponseEntity.ok(ApiResponse.success("Answer saved", body));
    }

    @PostMapping("/submissions/{submissionId}/submit")
    public ResponseEntity<ApiResponse<StudentSubmitExamResponse>> submitExam(@PathVariable Integer submissionId) {
        StudentSubmitExamResponse body = studentExamService.submitExam(submissionId);
        return ResponseEntity.ok(ApiResponse.success("Exam submitted", body));
    }
}
