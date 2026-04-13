package com.ai.englishsystem.result.service;

import com.ai.englishsystem.common.exception.ForbiddenException;
import com.ai.englishsystem.common.exception.NotFoundException;
import com.ai.englishsystem.common.util.SecurityUtils;
import com.ai.englishsystem.result.dto.ScoreResponse;
import com.ai.englishsystem.result.entity.Score;
import com.ai.englishsystem.result.repository.ScoreRepository;
import com.ai.englishsystem.student.entity.Student;
import com.ai.englishsystem.student.repository.StudentRepository;
import com.ai.englishsystem.submission.entity.Submission;
import com.ai.englishsystem.submission.repository.SubmissionRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class ScoreService {

    private final ScoreRepository scoreRepository;
    private final SubmissionRepository submissionRepository;
    private final StudentRepository studentRepository;

    @Transactional(readOnly = true)
    public ScoreResponse getBySubmissionId(Integer submissionId) {
        Submission submission = submissionRepository.findById(submissionId)
                .orElseThrow(() -> new NotFoundException("Submission", submissionId));

        if (!SecurityUtils.isTeacherOrAdmin()) {
            Integer userId = SecurityUtils.getCurrentUserId();
            Student student = studentRepository.findByUser_Id(userId)
                    .orElseThrow(() -> new ForbiddenException("Student profile not found for current user"));
            if (!submission.getStudent().getId().equals(student.getId())) {
                throw new ForbiddenException("Cannot view another student's score");
            }
        }

        return scoreRepository.findFirstBySubmissionOrderByIdAsc(submission)
                .map(this::toResponse)
                .orElseThrow(() -> new NotFoundException("Score not found for submission"));
    }

    private ScoreResponse toResponse(Score score) {
        return ScoreResponse.builder()
                .id(score.getId())
                .submissionId(score.getSubmission().getId())
                .mcScore(score.getMcScore())
                .writingScore(score.getWritingScore())
                .speakingScore(score.getSpeakingScore())
                .totalScore(score.getTotalScore())
                .gradedBy(score.getGradedBy())
                .gradedAt(score.getGradedAt())
                .build();
    }
}
