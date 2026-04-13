package com.ai.englishsystem.submission.service;

import com.ai.englishsystem.common.exception.BadRequestException;
import com.ai.englishsystem.common.exception.ForbiddenException;
import com.ai.englishsystem.common.exception.NotFoundException;
import com.ai.englishsystem.common.util.SecurityUtils;
import com.ai.englishsystem.exam.entity.ExamSection;
import com.ai.englishsystem.exam.entity.Question;
import com.ai.englishsystem.exam.service.StudentExamService;
import com.ai.englishsystem.exam.repository.QuestionRepository;
import com.ai.englishsystem.student.entity.Student;
import com.ai.englishsystem.student.repository.StudentRepository;
import com.ai.englishsystem.submission.dto.AnswerRequest;
import com.ai.englishsystem.submission.dto.AnswerResponse;
import com.ai.englishsystem.submission.entity.Answer;
import com.ai.englishsystem.submission.entity.Submission;
import com.ai.englishsystem.submission.entity.SubmissionStatus;
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
    private final StudentExamService studentExamService;

    @Transactional
    public AnswerResponse saveOrUpdate(AnswerRequest request) {
        Integer userId = SecurityUtils.getCurrentUserId();
        Student student = studentRepository.findByUser_Id(userId)
                .orElseThrow(() -> new ForbiddenException("Student profile not found for current user"));

        Submission submission = submissionRepository.findWithAssociationsById(request.getSubmissionId())
                .orElseThrow(() -> new NotFoundException("Submission", request.getSubmissionId()));

        if (!submission.getStudent().getId().equals(student.getId())) {
            throw new ForbiddenException("Cannot answer for another student's submission");
        }

        if (submission.getStatus() != SubmissionStatus.IN_PROGRESS) {
            throw new BadRequestException("Submission is not in progress");
        }

        studentExamService.assertWithinDeadline(submission);

        Question question = questionRepository.findById(request.getQuestionId())
                .orElseThrow(() -> new NotFoundException("Question", request.getQuestionId()));

        if (!questionBelongsToExam(question, submission.getExam())) {
            throw new BadRequestException("Question does not belong to this exam");
        }

        validateAnswerShape(question, request);

        var existing = answerRepository.findBySubmissionAndQuestion(submission, question);
        Answer answer;
        if (existing.isPresent()) {
            answer = existing.get();
            mergeAnswerFromRequest(answer, request);
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

    private void validateAnswerShape(Question question, AnswerRequest request) {
        String type = question.getQuestionType() == null ? "" : question.getQuestionType().trim().toUpperCase();
        boolean hasMc = request.getSelectedOptionId() != null;
        boolean hasText = request.getAnswerText() != null && !request.getAnswerText().isBlank();
        boolean hasAudio = request.getAudioUrl() != null && !request.getAudioUrl().isBlank();

        switch (type) {
            case "MULTIPLE_CHOICE":
            case "LISTENING":
                if (hasText || hasAudio) {
                    throw new BadRequestException("Use selectedOptionId for this question type");
                }
                break;
            case "WRITING":
                if (hasMc) {
                    throw new BadRequestException("Use answerText for writing questions");
                }
                break;
            case "SPEAKING":
                if (hasMc) {
                    throw new BadRequestException("Use audioUrl for speaking questions");
                }
                break;
            default:
                // unknown types: accept any populated field
        }
    }

    /**
     * PATCH-style merge: JSON omitted fields stay null in the request and must not wipe persisted values
     * (e.g. MCQ save only sends selectedOptionId — do not null out answer_text).
     */
    private void mergeAnswerFromRequest(Answer answer, AnswerRequest request) {
        if (request.getAnswerText() != null) {
            answer.setAnswerText(request.getAnswerText());
        }
        if (request.getSelectedOptionId() != null) {
            answer.setSelectedOptionId(request.getSelectedOptionId());
        }
        if (request.getAudioUrl() != null) {
            answer.setAudioUrl(request.getAudioUrl());
        }
        if (request.getImageUrl() != null) {
            answer.setImageUrl(request.getImageUrl());
        }
    }
}
