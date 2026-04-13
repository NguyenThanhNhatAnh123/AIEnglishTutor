package com.ai.englishsystem.submission.service;

import com.ai.englishsystem.common.exception.NotFoundException;
import com.ai.englishsystem.exam.entity.Exam;
import com.ai.englishsystem.exam.repository.ExamRepository;
import com.ai.englishsystem.exam.service.StudentExamService;
import com.ai.englishsystem.submission.dto.StartSubmissionRequest;
import com.ai.englishsystem.submission.dto.SubmissionListResponse;
import com.ai.englishsystem.submission.dto.SubmissionResponse;
import com.ai.englishsystem.submission.dto.SubmitSubmissionRequest;
import com.ai.englishsystem.submission.entity.Submission;
import com.ai.englishsystem.submission.repository.SubmissionRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class SubmissionService {

    private final SubmissionRepository submissionRepository;
    private final ExamRepository examRepository;
    private final StudentExamService studentExamService;

    @Transactional
    public SubmissionResponse start(StartSubmissionRequest request) {
        return studentExamService.startExam(request.getExamId());
    }

    @Transactional
    public SubmissionResponse submit(SubmitSubmissionRequest request) {
        var graded = studentExamService.submitExam(request.getSubmissionId());
        Submission persisted = submissionRepository.findWithAssociationsById(graded.getSubmissionId())
                .orElse(null);
        return SubmissionResponse.builder()
                .id(graded.getSubmissionId())
                .examId(graded.getExamId())
                .studentId(graded.getStudentId())
                .attemptId(persisted != null && persisted.getExamAttempt() != null
                        ? persisted.getExamAttempt().getId() : null)
                .durationMinutes(persisted != null && persisted.getExam() != null
                        ? persisted.getExam().getDurationMinutes() : null)
                .startTime(persisted != null ? persisted.getStartTime() : null)
                .submitTime(graded.getSubmitTime())
                .status(graded.getStatus())
                .build();
    }

    @Transactional(readOnly = true)
    public List<SubmissionListResponse> listByExam(Integer examId) {
        Exam exam = examRepository.findById(examId)
                .orElseThrow(() -> new NotFoundException("Exam", examId));
        return submissionRepository.findByExam(exam).stream()
                .map(this::toListResponse)
                .collect(Collectors.toList());
    }

    private SubmissionListResponse toListResponse(Submission s) {
        return SubmissionListResponse.builder()
                .id(s.getId())
                .examId(s.getExam().getId())
                .examTitle(s.getExam().getTitle())
                .studentId(s.getStudent().getId())
                .studentName(s.getStudent().getUser().getFullName())
                .status(s.getStatus().name())
                .startTime(s.getStartTime())
                .submitTime(s.getSubmitTime())
                .build();
    }

}
