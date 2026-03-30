package com.ai.englishsystem.submission.service;

import com.ai.englishsystem.common.exception.BadRequestException;
import com.ai.englishsystem.common.exception.ForbiddenException;
import com.ai.englishsystem.common.exception.NotFoundException;
import com.ai.englishsystem.common.util.SecurityUtils;
import com.ai.englishsystem.exam.entity.ExamSection;
import com.ai.englishsystem.exam.entity.Question;
import com.ai.englishsystem.exam.repository.QuestionRepository;
import com.ai.englishsystem.student.entity.Student;
import com.ai.englishsystem.student.repository.StudentRepository;
import com.ai.englishsystem.submission.dto.AnswerRequest;
import com.ai.englishsystem.submission.dto.AnswerResponse;
import com.ai.englishsystem.submission.entity.Answer;
import com.ai.englishsystem.submission.entity.Submission;
import com.ai.englishsystem.submission.repository.AnswerRepository;
import com.ai.englishsystem.submission.repository.SubmissionRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class AnswerService {

    private final AnswerRepository answerRepository;
    private final SubmissionRepository submissionRepository;
    private final QuestionRepository questionRepository;
    private final StudentRepository studentRepository;

    @Transactional
    public AnswerResponse saveOrUpdate(AnswerRequest request) {
        Integer userId = SecurityUtils.getCurrentUserId();
        Student student = studentRepository.findByUser_Id(userId)
                .orElseThrow(() -> new ForbiddenException("Student profile not found for current user"));

        Submission submission = submissionRepository.findById(request.getSubmissionId())
                .orElseThrow(() -> new NotFoundException("Submission", request.getSubmissionId()));

        if (!submission.getStudent().getId().equals(student.getId())) {
            throw new ForbiddenException("Cannot answer for another student's submission");
        }

        if (!"IN_PROGRESS".equals(submission.getStatus())) {
            throw new BadRequestException("Submission is not in progress");
        }

        Question question = questionRepository.findById(request.getQuestionId())
                .orElseThrow(() -> new NotFoundException("Question", request.getQuestionId()));

        if (!questionBelongsToExam(question, submission.getExam())) {
            throw new BadRequestException("Question does not belong to this exam");
        }

        var existing = answerRepository.findBySubmissionAndQuestion(submission, question);
        Answer answer;
        if (existing.isPresent()) {
            answer = existing.get();
            answer.setAnswerText(request.getAnswerText());
            answer.setSelectedOptionId(request.getSelectedOptionId());
            answer.setAudioUrl(request.getAudioUrl());
            answer.setImageUrl(request.getImageUrl());
        } else {
            answer = Answer.builder()
                    .submission(submission)
                    .question(question)
                    .answerText(request.getAnswerText())
                    .selectedOptionId(request.getSelectedOptionId())
                    .audioUrl(request.getAudioUrl())
                    .imageUrl(request.getImageUrl())
                    .build();
        }
        answer = answerRepository.save(answer);
        return AnswerResponse.builder()
                .id(answer.getId())
                .submissionId(answer.getSubmission().getId())
                .questionId(answer.getQuestion().getId())
                .build();
    }

    private boolean questionBelongsToExam(Question question, com.ai.englishsystem.exam.entity.Exam exam) {
        ExamSection section = question.getSection();
        return section != null && section.getExam() != null && section.getExam().getId().equals(exam.getId());
    }
}
