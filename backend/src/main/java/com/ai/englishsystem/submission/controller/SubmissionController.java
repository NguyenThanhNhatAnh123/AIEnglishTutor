package com.ai.englishsystem.submission.controller;

import com.ai.englishsystem.common.dto.ApiResponse;
import com.ai.englishsystem.submission.dto.AnswerResponse;
import com.ai.englishsystem.submission.dto.StartSubmissionRequest;
import com.ai.englishsystem.submission.dto.SubmissionListResponse;
import com.ai.englishsystem.submission.dto.SubmissionResponse;
import com.ai.englishsystem.submission.dto.SubmitSubmissionRequest;
import com.ai.englishsystem.submission.service.AnswerService;
import com.ai.englishsystem.submission.service.SubmissionService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.core.io.Resource;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/submissions")
@RequiredArgsConstructor
public class SubmissionController {

    private final SubmissionService submissionService;
    private final AnswerService answerService;

    /** Teacher/Admin: list submissions for a given exam */
    @GetMapping
    @PreAuthorize("hasAnyRole('TEACHER', 'ADMIN')")
    public ResponseEntity<ApiResponse<List<SubmissionListResponse>>> listByExam(@RequestParam Integer examId) {
        List<SubmissionListResponse> list = submissionService.listByExam(examId);
        return ResponseEntity.ok(ApiResponse.success(list));
    }

    /** Teacher/Admin/Student: get submission detail (ownership enforced in service). */
    @GetMapping("/{submissionId}")
    @PreAuthorize("hasAnyRole('TEACHER', 'ADMIN', 'STUDENT')")
    public ResponseEntity<ApiResponse<SubmissionResponse>> getById(@PathVariable Integer submissionId) {
        SubmissionResponse response = submissionService.getById(submissionId);
        return ResponseEntity.ok(ApiResponse.success(response));
    }

    /** Teacher/Admin: saved answers (e.g. speaking audio URLs) for review. */
    @GetMapping("/{submissionId}/answers")
    @PreAuthorize("hasAnyRole('TEACHER', 'ADMIN')")
    public ResponseEntity<ApiResponse<List<AnswerResponse>>> answersForSubmission(@PathVariable Integer submissionId) {
        List<AnswerResponse> list = answerService.getAnswersForTeacher(submissionId);
        return ResponseEntity.ok(ApiResponse.success(list));
    }

    /** Teacher/Admin: batch saved answers for review tables. */
    @GetMapping("/answers")
    @PreAuthorize("hasAnyRole('TEACHER', 'ADMIN')")
    public ResponseEntity<ApiResponse<java.util.Map<Integer, List<AnswerResponse>>>> answersBatch(
            @RequestParam("submissionId") List<Integer> submissionIds) {
        var map = answerService.getAnswersForTeacherBatch(submissionIds);
        return ResponseEntity.ok(ApiResponse.success(map));
    }

    /** Teacher/Admin/Student: stream normalized speaking MP3 (ownership enforced in service). */
    @GetMapping("/{submissionId}/answers/{answerId}/speaking")
    @PreAuthorize("hasAnyRole('TEACHER', 'ADMIN', 'STUDENT')")
    public ResponseEntity<Resource> downloadSpeaking(
            @PathVariable Integer submissionId,
            @PathVariable Integer answerId) {
        Resource resource = submissionService.loadSpeakingAudioResource(submissionId, answerId);
        String filename = submissionService.speakingDownloadFilename(answerId);
        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType("audio/mpeg"))
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + filename + "\"")
                .body(resource);
    }

    /** Teacher/Admin: delete submission and remove speaking files from disk. */
    @DeleteMapping("/{submissionId}")
    @PreAuthorize("hasAnyRole('TEACHER', 'ADMIN')")
    public ResponseEntity<ApiResponse<String>> deleteSubmission(@PathVariable Integer submissionId) {
        submissionService.deleteSubmission(submissionId);
        return ResponseEntity.ok(ApiResponse.success("Submission deleted", "ok"));
    }

    /** Student: get own submission history */
    @GetMapping("/my")
    @PreAuthorize("hasRole('STUDENT')")
    public ResponseEntity<ApiResponse<List<SubmissionListResponse>>> mySubmissions() {
        List<SubmissionListResponse> list = submissionService.listMySubmissions();
        return ResponseEntity.ok(ApiResponse.success(list));
    }

    // POST /api/submissions/start and POST /api/submissions/submit are deprecated.
    // Students must use /api/student/submissions/{id}/submit (StudentExamController).
    // Kept only for backward compatibility; will be removed in a future release.

    /**
     * @deprecated Use POST /api/student/submissions/{submissionId}/submit instead.
     */
    @Deprecated
    @PostMapping("/start")
    @PreAuthorize("hasRole('STUDENT')")
    public ResponseEntity<ApiResponse<SubmissionResponse>> start(@Valid @RequestBody StartSubmissionRequest request) {
        SubmissionResponse response = submissionService.start(request);
        return ResponseEntity.ok(ApiResponse.success("Exam started", response));
    }

    /**
     * @deprecated Use POST /api/student/submissions/{submissionId}/submit instead.
     */
    @Deprecated
    @PostMapping("/submit")
    @PreAuthorize("hasRole('STUDENT')")
    public ResponseEntity<ApiResponse<SubmissionResponse>> submit(@Valid @RequestBody SubmitSubmissionRequest request) {
        SubmissionResponse response = submissionService.submit(request);
        return ResponseEntity.ok(ApiResponse.success("Exam submitted", response));
    }
}
