package com.ai.englishsystem.submission.service;

import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.stream.Collectors;

import com.ai.englishsystem.common.exception.BadRequestException;
import com.ai.englishsystem.common.exception.ForbiddenException;
import com.ai.englishsystem.common.exception.NotFoundException;
import com.ai.englishsystem.common.security.AccessControlService;
import com.ai.englishsystem.common.util.SecurityUtils;
import com.ai.englishsystem.exam.entity.ExamSection;
import com.ai.englishsystem.exam.entity.Question;
import com.ai.englishsystem.exam.service.StudentExamService;
import com.ai.englishsystem.result.entity.Feedback;
import com.ai.englishsystem.result.repository.FeedbackRepository;
import com.ai.englishsystem.exam.repository.QuestionRepository;
import com.ai.englishsystem.student.entity.Student;
import com.ai.englishsystem.student.repository.StudentRepository;
import com.ai.englishsystem.submission.dto.AnswerRequest;
import com.ai.englishsystem.submission.dto.AnswerResponse;
import com.ai.englishsystem.submission.entity.Answer;
import com.ai.englishsystem.submission.entity.AnswerType;
import com.ai.englishsystem.submission.entity.Submission;
import com.ai.englishsystem.submission.entity.SubmissionStatus;
import com.ai.englishsystem.submission.mapper.AnswerMapper;
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
    private final FeedbackRepository feedbackRepository;
    private final AnswerMapper answerMapper;
    private final AccessControlService accessControlService;

    @Transactional
    public AnswerResponse saveOrUpdate(AnswerRequest request) {
        return saveOrUpdateBatch(List.of(request)).get(0);
    }

    @Transactional
    public List<AnswerResponse> saveOrUpdateBatch(List<AnswerRequest> requests) {
        if (requests == null || requests.isEmpty()) {
            throw new BadRequestException("answers is required");
        }
        if (requests.size() > 200) {
            throw new BadRequestException("At most 200 answers can be saved in one batch");
        }
        if (requests.stream().anyMatch(Objects::isNull)) {
            throw new BadRequestException("Answer payload cannot be null");
        }

        List<Integer> submissionIds = requests.stream()
                .map(AnswerRequest::getSubmissionId)
                .filter(Objects::nonNull)
                .distinct()
                .toList();
        if (submissionIds.size() != 1 || requests.stream().anyMatch(r -> r.getSubmissionId() == null)) {
            throw new BadRequestException("All answers in one batch must target the same submission");
        }

        Map<Integer, AnswerRequest> requestByQuestionId = new LinkedHashMap<>();
        for (AnswerRequest request : requests) {
            if (request.getQuestionId() == null) {
                throw new BadRequestException("questionId is required");
            }
            requestByQuestionId.put(request.getQuestionId(), request);
        }

        Integer userId = SecurityUtils.getCurrentUserId();
        Student student = studentRepository.findByUser_Id(userId)
                .orElseThrow(() -> new ForbiddenException("Student profile not found for current user"));

        Integer submissionId = submissionIds.get(0);
        Submission submission = submissionRepository.findWithAssociationsByIdForUpdate(submissionId)
                .orElseThrow(() -> new NotFoundException("Submission", submissionId));

        if (!submission.getStudent().getId().equals(student.getId())) {
            throw new ForbiddenException("Cannot answer for another student's submission");
        }
        studentExamService.assertStudentCanAccessExam(student, submission.getExam().getId());

        if (submission.getStatus() != SubmissionStatus.IN_PROGRESS) {
            throw new BadRequestException("Submission is not in progress");
        }

        studentExamService.assertWithinDeadline(submission);

        Map<Integer, Question> questionById = questionRepository.findByIdInWithSectionExam(requestByQuestionId.keySet())
                .stream()
                .collect(Collectors.toMap(Question::getId, question -> question));
        for (Integer questionId : requestByQuestionId.keySet()) {
            if (!questionById.containsKey(questionId)) {
                throw new NotFoundException("Question", questionId);
            }
        }

        Map<Integer, Answer> existingByQuestionId = answerRepository.findBySubmissionFetchQuestion(submission).stream()
                .filter(answer -> answer.getQuestion() != null && answer.getQuestion().getId() != null)
                .collect(Collectors.toMap(answer -> answer.getQuestion().getId(), answer -> answer, (a, b) -> a));

        List<Answer> toSave = requestByQuestionId.entrySet().stream()
                .map(entry -> {
                    Question question = questionById.get(entry.getKey());
                    AnswerRequest request = entry.getValue();

                    if (!questionBelongsToExam(question, submission.getExam())) {
                        throw new BadRequestException("Question does not belong to this exam");
                    }
                    validateAnswerShape(question, request);

                    Answer answer = existingByQuestionId.get(question.getId());
                    if (answer != null) {
                        mergeAnswerFromRequest(answer, request);
                        return answer;
                    }
                    return Answer.builder()
                            .submission(submission)
                            .question(question)
                            .answerType(resolveAnswerType(question, request))
                            .answerText(request.getAnswerText())
                            .selectedOptionId(request.getSelectedOptionId())
                            .speakingAudioUrl(request.getSpeakingAudioUrl())
                            .speakingDurationSeconds(request.getSpeakingDurationSeconds())
                            .speakingFormat(request.getSpeakingFormat())
                            .imageUrl(request.getImageUrl())
                            .build();
                })
                .toList();

        return answerRepository.saveAll(toSave).stream()
                .map(answer -> answerMapper.toResponse(answer, null, false))
                .sorted(Comparator.comparing(AnswerResponse::getQuestionId, Comparator.nullsLast(Integer::compareTo)))
                .collect(Collectors.toList());
    }

    private boolean optionBelongsToQuestion(Question question, Integer optionId) {
        if (optionId == null) {
            return false;
        }
        return question.getOptions() != null && question.getOptions().stream()
                .anyMatch(option -> option.getId() != null && option.getId().equals(optionId));
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
                if (hasMc && !optionBelongsToQuestion(question, request.getSelectedOptionId())) {
                    throw new BadRequestException("Selected option does not belong to this question");
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
        answer.setAnswerType(resolveAnswerType(answer));
    }

    private AnswerType resolveAnswerType(Question question, AnswerRequest request) {
        String type = question.getQuestionType() == null ? "" : question.getQuestionType().trim().toUpperCase();
        return switch (type) {
            case "MULTIPLE_CHOICE", "LISTENING" -> request.getSelectedOptionId() != null ? AnswerType.CHOICE : null;
            case "WRITING" -> hasText(request.getAnswerText()) ? AnswerType.TEXT : null;
            case "SPEAKING" -> hasText(request.getSpeakingAudioUrl()) ? AnswerType.AUDIO : null;
            default -> {
                if (request.getSelectedOptionId() != null) {
                    yield AnswerType.CHOICE;
                }
                if (hasText(request.getSpeakingAudioUrl())) {
                    yield AnswerType.AUDIO;
                }
                yield hasText(request.getAnswerText()) ? AnswerType.TEXT : null;
            }
        };
    }

    private boolean hasText(String value) {
        return value != null && !value.isBlank();
    }

    private AnswerType resolveAnswerType(Answer answer) {
        String type = answer.getQuestion() == null || answer.getQuestion().getQuestionType() == null
                ? "" : answer.getQuestion().getQuestionType().trim().toUpperCase();
        return switch (type) {
            case "MULTIPLE_CHOICE", "LISTENING" -> answer.getSelectedOptionId() != null ? AnswerType.CHOICE : null;
            case "WRITING" -> hasText(answer.getAnswerText()) ? AnswerType.TEXT : null;
            case "SPEAKING" -> hasText(answer.getSpeakingAudioUrl()) ? AnswerType.AUDIO : null;
            default -> {
                if (answer.getSelectedOptionId() != null) {
                    yield AnswerType.CHOICE;
                }
                if (hasText(answer.getSpeakingAudioUrl())) {
                    yield AnswerType.AUDIO;
                }
                yield hasText(answer.getAnswerText()) ? AnswerType.TEXT : null;
            }
        };
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

        List<Answer> answers = answerRepository.findBySubmissionFetchQuestion(submission);
        Map<Integer, Feedback> feedbackByAnswerId = feedbackRepository.findByAnswerIn(answers).stream()
                .filter(f -> f.getAnswer() != null && f.getAnswer().getId() != null)
                .collect(Collectors.toMap(f -> f.getAnswer().getId(), f -> f));

        boolean submitted = submission.getStatus() != SubmissionStatus.IN_PROGRESS;
        return answers.stream()
                .map(answer -> submitted
                        ? answerMapper.toResponse(answer, feedbackByAnswerId.get(answer.getId()), true)
                        : answerMapper.toResponse(answer, null, false))
                .sorted(Comparator.comparing(AnswerResponse::getQuestionId, Comparator.nullsLast(Integer::compareTo)))
                .collect(Collectors.toList());
    }

    /**
     * Teacher/Admin: answers for grading, including speaking file paths.
     */
    @Transactional(readOnly = true)
    public List<AnswerResponse> getAnswersForTeacher(Integer submissionId) {
        Submission submission = submissionRepository.findWithAssociationsById(submissionId)
                .orElseThrow(() -> new NotFoundException("Submission", submissionId));

        accessControlService.assertTeacherOrAdminCanAccessSubmission(
                submission,
                "You do not have permission to view this submission"
        );

        List<Answer> answers = answerRepository.findBySubmissionFetchQuestion(submission);
        Map<Integer, Feedback> feedbackByAnswerId = feedbackRepository.findByAnswerIn(answers).stream()
                .filter(f -> f.getAnswer() != null && f.getAnswer().getId() != null)
                .collect(Collectors.toMap(f -> f.getAnswer().getId(), f -> f));

        return answers.stream()
                .map(answer -> answerMapper.toResponse(answer, feedbackByAnswerId.get(answer.getId()), false))
                .sorted(Comparator.comparing(AnswerResponse::getQuestionId, Comparator.nullsLast(Integer::compareTo)))
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
        List<Integer> uniqueSubmissionIds = submissionIds.stream()
                .filter(Objects::nonNull)
                .distinct()
                .toList();
        if (uniqueSubmissionIds.isEmpty()) {
            return Map.of();
        }
        if (uniqueSubmissionIds.size() > 200) {
            throw new BadRequestException("Too many submissions requested at once. Please request at most 200.");
        }

        List<Submission> submissions = submissionRepository.findAllWithAssociationsByIdIn(uniqueSubmissionIds);
        for (Submission submission : submissions) {
            accessControlService.assertTeacherOrAdminCanAccessSubmission(
                    submission,
                    "You do not have permission to view this submission"
            );
        }

        List<Answer> fetchedAnswers = answerRepository.findBySubmissionIdInFetchQuestion(uniqueSubmissionIds);
        Map<Integer, Feedback> feedbackByAnswerId = feedbackRepository.findByAnswerIn(fetchedAnswers).stream()
                .filter(f -> f.getAnswer() != null && f.getAnswer().getId() != null)
                .collect(Collectors.toMap(f -> f.getAnswer().getId(), f -> f));

        Map<Integer, List<AnswerResponse>> grouped = fetchedAnswers.stream()
                .map(answer -> answerMapper.toResponse(answer, feedbackByAnswerId.get(answer.getId()), false))
                .collect(Collectors.groupingBy(AnswerResponse::getSubmissionId));

        for (Integer submissionId : uniqueSubmissionIds) {
            grouped.computeIfAbsent(submissionId, ignored -> List.of());
        }

        grouped.replaceAll((ignored, answerList) -> answerList.stream()
                .sorted(Comparator.comparing(AnswerResponse::getQuestionId, Comparator.nullsLast(Integer::compareTo)))
                .collect(Collectors.toList()));

        return grouped;
    }

}
