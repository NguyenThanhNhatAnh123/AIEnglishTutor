package com.ai.englishsystem.submission.service;

import com.ai.englishsystem.common.exception.BadRequestException;
import com.ai.englishsystem.common.exception.ForbiddenException;
import com.ai.englishsystem.common.exception.NotFoundException;
import com.ai.englishsystem.common.util.SecurityUtils;
import com.ai.englishsystem.exam.entity.Exam;
import com.ai.englishsystem.exam.repository.ExamRepository;
import com.ai.englishsystem.student.entity.Student;
import com.ai.englishsystem.student.repository.StudentRepository;
import com.ai.englishsystem.submission.dto.StartSubmissionRequest;
import com.ai.englishsystem.submission.dto.SubmissionListResponse;
import com.ai.englishsystem.submission.dto.SubmissionResponse;
import com.ai.englishsystem.submission.dto.SubmitSubmissionRequest;
import com.ai.englishsystem.submission.entity.Submission;
import com.ai.englishsystem.submission.repository.SubmissionRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class SubmissionService {

    private final SubmissionRepository submissionRepository;
    private final ExamRepository examRepository;
    private final StudentRepository studentRepository;

    @Transactional
    public SubmissionResponse start(StartSubmissionRequest request) {
        Integer userId = SecurityUtils.getCurrentUserId();
        Student student = studentRepository.findByUser_Id(userId)
                .orElseThrow(() -> new ForbiddenException("Student profile not found for current user"));

        Exam exam = examRepository.findById(request.getExamId())
                .orElseThrow(() -> new NotFoundException("Exam", request.getExamId()));

        if (!"ACTIVE".equals(exam.getStatus()) && !"IN_PROGRESS".equals(exam.getStatus())) {
            throw new BadRequestException("Exam is not available for taking");
        }

        var existing = submissionRepository.findByExamAndStudentAndStatus(exam, student, "IN_PROGRESS");
        if (existing.isPresent()) {
            return toResponse(existing.get());
        }

        Submission submission = Submission.builder()
                .exam(exam)
                .student(student)
                .startTime(LocalDateTime.now())
                .status("IN_PROGRESS")
                .build();

        submission = submissionRepository.save(submission);
        return toResponse(submission);
    }

    @Transactional
    public SubmissionResponse submit(SubmitSubmissionRequest request) {
        Integer userId = SecurityUtils.getCurrentUserId();
        Student student = studentRepository.findByUser_Id(userId)
                .orElseThrow(() -> new ForbiddenException("Student profile not found for current user"));

        Submission submission = submissionRepository.findById(request.getSubmissionId())
                .orElseThrow(() -> new NotFoundException("Submission", request.getSubmissionId()));

        if (!submission.getStudent().getId().equals(student.getId())) {
            throw new ForbiddenException("Cannot submit another student's exam");
        }

        if (!"IN_PROGRESS".equals(submission.getStatus())) {
            throw new BadRequestException("Submission is not in progress");
        }

        Exam exam = submission.getExam();
        int durationMinutes = exam.getDurationMinutes() != null ? exam.getDurationMinutes() : 60;
        LocalDateTime deadline = submission.getStartTime().plusMinutes(durationMinutes);
        if (LocalDateTime.now().isAfter(deadline)) {
            throw new BadRequestException("Exam time has expired");
        }

        submission.setSubmitTime(LocalDateTime.now());
        submission.setStatus("SUBMITTED");
        submission = submissionRepository.save(submission);

        return toResponse(submission);
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
                .status(s.getStatus())
                .startTime(s.getStartTime())
                .submitTime(s.getSubmitTime())
                .build();
    }

    private SubmissionResponse toResponse(Submission s) {
        return SubmissionResponse.builder()
                .id(s.getId())
                .examId(s.getExam().getId())
                .studentId(s.getStudent().getId())
                .startTime(s.getStartTime())
                .submitTime(s.getSubmitTime())
                .status(s.getStatus())
                .build();
    }
}
