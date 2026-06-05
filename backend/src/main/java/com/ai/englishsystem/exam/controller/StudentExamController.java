package com.ai.englishsystem.exam.controller;

import com.ai.englishsystem.common.dto.ApiResponse;
import com.ai.englishsystem.exam.dto.ExamResponse;
import com.ai.englishsystem.exam.dto.student.StudentExamDetailResponse;
import com.ai.englishsystem.exam.service.StudentExamService;
import com.ai.englishsystem.submission.dto.AnswerBatchRequest;
import com.ai.englishsystem.submission.dto.AnswerRequest;
import com.ai.englishsystem.submission.dto.AnswerResponse;
import com.ai.englishsystem.submission.dto.StudentSubmitExamResponse;
import com.ai.englishsystem.submission.dto.SubmitExamRequest;
import com.ai.englishsystem.submission.dto.SubmissionResponse;
import com.ai.englishsystem.submission.service.AnswerService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/student")
@RequiredArgsConstructor
@PreAuthorize("hasRole('STUDENT')")
public class StudentExamController {

    private final StudentExamService studentExamService;
    private final AnswerService answerService;

    /** List only ACTIVE exams for students; never exposes DRAFT/CLOSED. */
    @GetMapping("/exams")
    public ResponseEntity<ApiResponse<List<ExamResponse>>> getActiveExams() {
        List<ExamResponse> list = studentExamService.getActiveExams();
        return ResponseEntity.ok(ApiResponse.success(list));
    }

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

    @PostMapping("/answers/batch")
    public ResponseEntity<ApiResponse<List<AnswerResponse>>> saveAnswersBatch(
            @Valid @RequestBody AnswerBatchRequest request) {
        List<AnswerResponse> body = answerService.saveOrUpdateBatch(request.getAnswers());
        return ResponseEntity.ok(ApiResponse.success("Answers saved", body));
    }

    /** Load saved answers for resume; students can only see their own. */
    @GetMapping("/submissions/{submissionId}/answers")
    public ResponseEntity<ApiResponse<List<AnswerResponse>>> getAnswers(@PathVariable Integer submissionId) {
        List<AnswerResponse> list = answerService.getAnswersForSubmission(submissionId);
        return ResponseEntity.ok(ApiResponse.success(list));
    }

    @PostMapping("/submissions/{submissionId}/submit")
    public ResponseEntity<ApiResponse<StudentSubmitExamResponse>> submitExam(
            @PathVariable Integer submissionId,
            @RequestBody(required = false) SubmitExamRequest body) {
        StudentSubmitExamResponse graded = studentExamService.submitExam(submissionId, body);
        return ResponseEntity.ok(ApiResponse.success("Exam submitted", graded));
    }
}
