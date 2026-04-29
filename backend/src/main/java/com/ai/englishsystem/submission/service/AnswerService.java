package com.ai.englishsystem.submission.service;

import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

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

        Question question = questionRepository.findByIdWithSectionExam(request.getQuestionId())
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
                    .speakingAudioUrl(request.getSpeakingAudioUrl())
                    .speakingDurationSeconds(request.getSpeakingDurationSeconds())
                    .speakingFormat(request.getSpeakingFormat())
                    .imageUrl(request.getImageUrl())
                    .build();
        }
        answer = answerRepository.save(answer);
        return toResponse(answer);
    }

    private boolean questionBelongsToExam(Question question, com.ai.englishsystem.exam.entity.Exam exam) {
        ExamSection section = question.getSection();
        return section != null && section.getExam() != null && section.getExam().getId().equals(exam.getId());
    }

    private void validateAnswerShape(Question question, AnswerRequest request) {
        String type = question.getQuestionType() == null ? "" : question.getQuestionType().trim().toUpperCase();
        boolean hasMc = request.getSelectedOptionId() != null;
        boolean hasText = request.getAnswerText() != null && !request.getAnswerText().isBlank();
        boolean hasSpeaking = request.getSpeakingAudioUrl() != null && !request.getSpeakingAudioUrl().isBlank();

        switch (type) {
            case "MULTIPLE_CHOICE":
            case "LISTENING":
                if (hasText || hasSpeaking) {
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
                    throw new BadRequestException("Use speakingAudioUrl for speaking questions");
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
        if (request.getSpeakingAudioUrl() != null) {
            answer.setSpeakingAudioUrl(request.getSpeakingAudioUrl());
        }
        if (request.getSpeakingDurationSeconds() != null) {
            answer.setSpeakingDurationSeconds(request.getSpeakingDurationSeconds());
        }
        if (request.getSpeakingFormat() != null) {
            answer.setSpeakingFormat(request.getSpeakingFormat());
        }
        if (request.getImageUrl() != null) {
            answer.setImageUrl(request.getImageUrl());
        }
    }

    /**
     * Load all saved answers for a submission — used for exam resume.
     * Validates student ownership.
     */
    @Transactional(readOnly = true)
    public List<AnswerResponse> getAnswersForSubmission(Integer submissionId) {
        Integer userId = SecurityUtils.getCurrentUserId();
        Student student = studentRepository.findByUser_Id(userId)
                .orElseThrow(() -> new ForbiddenException("Student profile not found for current user"));

        Submission submission = submissionRepository.findWithAssociationsById(submissionId)
                .orElseThrow(() -> new NotFoundException("Submission", submissionId));

        if (!submission.getStudent().getId().equals(student.getId())) {
            throw new ForbiddenException("Cannot view another student's answers");
        }

        return answerRepository.findBySubmissionFetchQuestion(submission).stream()
                .map(this::toResponse)
                .collect(Collectors.toList());
    }

    /**
     * Teacher/Admin: answers for grading, including speaking file paths.
     */
    @Transactional(readOnly = true)
    public List<AnswerResponse> getAnswersForTeacher(Integer submissionId) {
        Submission submission = submissionRepository.findWithAssociationsById(submissionId)
                .orElseThrow(() -> new NotFoundException("Submission", submissionId));

        assertTeacherCanAccess(submission);

        return answerRepository.findBySubmissionFetchQuestion(submission).stream()
                .map(this::toResponse)
                .collect(Collectors.toList());
    }

    /**
     * Teacher/Admin: batch answers for a submission table without N+1 HTTP requests.
     */
    @Transactional(readOnly = true)
    public Map<Integer, List<AnswerResponse>> getAnswersForTeacherBatch(List<Integer> submissionIds) {
        if (submissionIds == null || submissionIds.isEmpty()) {
            return Map.of();
        }

        List<Submission> submissions = submissionRepository.findAllWithAssociationsByIdIn(submissionIds);
        for (Submission submission : submissions) {
            assertTeacherCanAccess(submission);
        }

        Map<Integer, List<AnswerResponse>> grouped = answerRepository.findBySubmissionIdInFetchQuestion(submissionIds).stream()
                .map(this::toResponse)
                .collect(Collectors.groupingBy(AnswerResponse::getSubmissionId));

        for (Integer submissionId : submissionIds) {
            grouped.computeIfAbsent(submissionId, ignored -> List.of());
        }

        grouped.replaceAll((ignored, answers) -> answers.stream()
                .sorted(Comparator.comparing(AnswerResponse::getQuestionId, Comparator.nullsLast(Integer::compareTo)))
                .collect(Collectors.toList()));

        return grouped;
    }

    private void assertTeacherCanAccess(Submission submission) {
        if (SecurityUtils.hasRole("ADMIN")) {
            return;
        }
        if (SecurityUtils.hasRole("TEACHER")) {
            Integer currentUserId = SecurityUtils.getCurrentUserId();
            Integer ownerUserId = submission.getExam().getTeacher().getUser().getId();
            if (!currentUserId.equals(ownerUserId)) {
                throw new ForbiddenException("You do not have permission to view this submission");
            }
            return;
        }
        throw new ForbiddenException("Not allowed");
    }

    private AnswerResponse toResponse(Answer answer) {
        return AnswerResponse.builder()
                .id(answer.getId())
                .submissionId(answer.getSubmission().getId())
                .questionId(answer.getQuestion().getId())
                .questionType(answer.getQuestion().getQuestionType())
                .answerText(answer.getAnswerText())
                .selectedOptionId(answer.getSelectedOptionId())
                .speakingAudioUrl(answer.getSpeakingAudioUrl())
                .speakingDurationSeconds(answer.getSpeakingDurationSeconds())
                .speakingFormat(answer.getSpeakingFormat())
                .imageUrl(answer.getImageUrl())
                .build();
    }
}
