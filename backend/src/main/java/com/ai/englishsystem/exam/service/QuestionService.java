package com.ai.englishsystem.exam.service;

import com.ai.englishsystem.common.exception.BadRequestException;
import com.ai.englishsystem.common.exception.ForbiddenException;
import com.ai.englishsystem.common.exception.NotFoundException;
import com.ai.englishsystem.common.util.SecurityUtils;
import com.ai.englishsystem.exam.dto.QuestionOptionRequest;
import com.ai.englishsystem.exam.dto.QuestionOptionResponse;
import com.ai.englishsystem.exam.dto.QuestionRequest;
import com.ai.englishsystem.exam.dto.QuestionResponse;
import com.ai.englishsystem.exam.entity.Exam;
import com.ai.englishsystem.exam.entity.ExamSection;
import com.ai.englishsystem.exam.entity.ExamSectionType;
import com.ai.englishsystem.exam.entity.Question;
import com.ai.englishsystem.exam.entity.QuestionOption;
import com.ai.englishsystem.exam.repository.ExamRepository;
import com.ai.englishsystem.exam.repository.ExamSectionRepository;
import com.ai.englishsystem.exam.repository.QuestionRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class QuestionService {

    private final QuestionRepository questionRepository;
    private final ExamSectionRepository examSectionRepository;
    private final ExamRepository examRepository;

    @Transactional(readOnly = true)
    public List<QuestionResponse> findAll(Integer examId) {
        if (SecurityUtils.hasRole("ADMIN")) {
            if (examId != null) {
                return questionRepository.findByExamId(examId).stream()
                        .map(this::toResponse)
                        .collect(Collectors.toList());
            }
            return questionRepository.findAllWithAssociations().stream()
                    .map(this::toResponse)
                    .collect(Collectors.toList());
        }
        if (!SecurityUtils.hasRole("TEACHER")) {
            throw new ForbiddenException("Access denied");
        }
        if (examId != null) {
            Exam exam = examRepository.findById(examId)
                    .orElseThrow(() -> new NotFoundException("Exam", examId));
            assertExamOwnerOrAdmin(exam);
            return questionRepository.findByExamId(examId).stream()
                    .map(this::toResponse)
                    .collect(Collectors.toList());
        }
        Integer userId = SecurityUtils.getCurrentUserId();
        return questionRepository.findByTeacherUserId(userId).stream()
                .map(this::toResponse)
                .collect(Collectors.toList());
    }

    @Transactional
    public QuestionResponse create(QuestionRequest request) {
        ExamSection section = examSectionRepository.findById(request.getSectionId())
                .orElseThrow(() -> new NotFoundException("Exam section", request.getSectionId()));
        assertSectionOwnerOrAdmin(section);

        String qType = request.getQuestionType() != null
                ? request.getQuestionType().trim().toUpperCase()
                : "MULTIPLE_CHOICE";
        validateQuestionForSection(section.getSectionType(), qType, request);

        Question question = Question.builder()
                .section(section)
                .questionText(request.getQuestionText().trim())
                .questionType(qType)
                .points(request.getPoints() != null ? request.getPoints() : 1)
                .listeningAudioUrl(trimToNull(request.getListeningAudioUrl()))
                .transcript(request.getTranscript())
                .minWords(request.getMinWords())
                .maxWords(request.getMaxWords())
                .build();

        question = questionRepository.save(question);
        attachOptions(question, request.getOptions());
        question = questionRepository.save(question);

        return toResponse(question);
    }

    @Transactional
    public QuestionResponse update(Integer id, QuestionRequest request) {
        Question question = questionRepository.findDetailById(id)
                .orElseThrow(() -> new NotFoundException("Question", id));
        assertSectionOwnerOrAdmin(question.getSection());

        ExamSection targetSection = question.getSection();
        if (request.getSectionId() != null && !request.getSectionId().equals(targetSection.getId())) {
            targetSection = examSectionRepository.findById(request.getSectionId())
                    .orElseThrow(() -> new NotFoundException("Exam section", request.getSectionId()));
            assertSectionOwnerOrAdmin(targetSection);
            question.setSection(targetSection);
        }

        if (request.getQuestionText() != null && !request.getQuestionText().isBlank()) {
            question.setQuestionText(request.getQuestionText().trim());
        }
        String qType = request.getQuestionType() != null
                ? request.getQuestionType().trim().toUpperCase()
                : question.getQuestionType();
        if (qType == null) {
            qType = "MULTIPLE_CHOICE";
        }
        QuestionRequest effective = mergeForValidation(question, request, qType);
        validateQuestionForSection(targetSection.getSectionType(), qType, effective);
        question.setQuestionType(qType);

        if (request.getPoints() != null) {
            question.setPoints(request.getPoints());
        }
        if (request.getListeningAudioUrl() != null) {
            question.setListeningAudioUrl(trimToNull(request.getListeningAudioUrl()));
        }
        if (request.getTranscript() != null) {
            question.setTranscript(request.getTranscript());
        }
        if (request.getMinWords() != null) {
            question.setMinWords(request.getMinWords());
        }
        if (request.getMaxWords() != null) {
            question.setMaxWords(request.getMaxWords());
        }

        if (request.getOptions() != null) {
            question.getOptions().clear();
            attachOptions(question, request.getOptions());
        }

        question = questionRepository.save(question);
        return toResponse(question);
    }

    @Transactional
    public void delete(Integer id) {
        Question question = questionRepository.findDetailById(id)
                .orElseThrow(() -> new NotFoundException("Question", id));
        assertSectionOwnerOrAdmin(question.getSection());
        questionRepository.delete(question);
    }

    /**
     * Builds a full request shape for validation on PATCH-style updates (null = keep existing).
     */
    private QuestionRequest mergeForValidation(Question q, QuestionRequest r, String qType) {
        List<QuestionOptionRequest> opts;
        if (r.getOptions() != null) {
            opts = r.getOptions();
        } else if (q.getOptions() != null) {
            opts = q.getOptions().stream()
                    .map(o -> QuestionOptionRequest.builder()
                            .optionText(o.getOptionText())
                            .isCorrect(o.getIsCorrect())
                            .build())
                    .collect(Collectors.toList());
        } else {
            opts = List.of();
        }
        return QuestionRequest.builder()
                .sectionId(q.getSection().getId())
                .questionText(r.getQuestionText() != null && !r.getQuestionText().isBlank()
                        ? r.getQuestionText() : q.getQuestionText())
                .questionType(qType)
                .points(r.getPoints() != null ? r.getPoints() : q.getPoints())
                .listeningAudioUrl(r.getListeningAudioUrl() != null ? r.getListeningAudioUrl() : q.getListeningAudioUrl())
                .transcript(r.getTranscript() != null ? r.getTranscript() : q.getTranscript())
                .minWords(r.getMinWords() != null ? r.getMinWords() : q.getMinWords())
                .maxWords(r.getMaxWords() != null ? r.getMaxWords() : q.getMaxWords())
                .options(opts)
                .build();
    }

    private static String trimToNull(String s) {
        if (s == null) {
            return null;
        }
        String t = s.trim();
        return t.isEmpty() ? null : t;
    }

    private void attachOptions(Question question, List<QuestionOptionRequest> optionRequests) {
        if (optionRequests == null || optionRequests.isEmpty()) {
            return;
        }
        for (QuestionOptionRequest optReq : optionRequests) {
            if (optReq == null || optReq.getOptionText() == null || optReq.getOptionText().isBlank()) {
                continue;
            }
            QuestionOption option = QuestionOption.builder()
                    .question(question)
                    .optionText(optReq.getOptionText().trim())
                    .isCorrect(optReq.getIsCorrect() != null ? optReq.getIsCorrect() : false)
                    .build();
            question.getOptions().add(option);
        }
    }

    private void validateQuestionForSection(ExamSectionType sectionType, String qType, QuestionRequest request) {
        switch (sectionType) {
            case READING -> {
                if (!"MULTIPLE_CHOICE".equals(qType)) {
                    throw new BadRequestException("READING sections only support MULTIPLE_CHOICE questions");
                }
            }
            case LISTENING -> {
                if (!"LISTENING".equals(qType)) {
                    throw new BadRequestException("LISTENING sections only support LISTENING questions");
                }
            }
            case WRITING -> {
                if (!"WRITING".equals(qType)) {
                    throw new BadRequestException("WRITING sections only support WRITING questions");
                }
            }
            case SPEAKING -> {
                if (!"SPEAKING".equals(qType)) {
                    throw new BadRequestException("SPEAKING sections only support SPEAKING questions");
                }
            }
        }

        switch (qType) {
            case "MULTIPLE_CHOICE" -> validateMcqOptions(request.getOptions());
            case "LISTENING" -> {
                validateAudioRequired(request, "LISTENING");
                validateMcqOptions(request.getOptions());
            }
            case "WRITING" -> validateWriting(request);
            case "SPEAKING" -> validateAudioRequired(request, "SPEAKING");
            default -> throw new BadRequestException("Unsupported questionType: " + qType);
        }
    }

    private void validateAudioRequired(QuestionRequest request, String qType) {
        String audio = trimToNull(request.getListeningAudioUrl());
        if (audio == null) {
            throw new BadRequestException("LISTENING".equals(qType)
                    ? "Listening questions require an uploaded audio URL (listeningAudioUrl)"
                    : "Speaking questions require a prompt/instruction audio URL (listeningAudioUrl)");
        }
    }

    private void validateWriting(QuestionRequest request) {
        Integer min = request.getMinWords();
        Integer max = request.getMaxWords();
        if (min == null || max == null) {
            throw new BadRequestException("Writing questions require minWords and maxWords");
        }
        if (min < 1 || max < 1) {
            throw new BadRequestException("minWords and maxWords must be at least 1");
        }
        if (max < min) {
            throw new BadRequestException("maxWords must be greater than or equal to minWords");
        }
    }

    private void validateMcqOptions(List<QuestionOptionRequest> options) {
        if (options == null) {
            throw new BadRequestException("Provide at least two non-blank answer options");
        }
        List<QuestionOptionRequest> nonBlank = options.stream()
                .filter(o -> o != null && o.getOptionText() != null && !o.getOptionText().isBlank())
                .collect(Collectors.toList());
        if (nonBlank.size() < 2) {
            throw new BadRequestException("Provide at least two non-blank answer options");
        }
        long correct = nonBlank.stream().filter(o -> Boolean.TRUE.equals(o.getIsCorrect())).count();
        if (correct != 1) {
            throw new BadRequestException("Mark exactly one option as correct");
        }
    }

    private void assertExamOwnerOrAdmin(Exam exam) {
        if (SecurityUtils.hasRole("ADMIN")) {
            return;
        }
        Integer currentUserId = SecurityUtils.getCurrentUserId();
        Integer ownerUserId = exam.getTeacher().getUser().getId();
        if (!currentUserId.equals(ownerUserId)) {
            throw new ForbiddenException("You do not have permission to access this exam");
        }
    }

    private void assertSectionOwnerOrAdmin(ExamSection section) {
        if (SecurityUtils.hasRole("ADMIN")) {
            return;
        }
        if (section.getExam() == null) {
            throw new BadRequestException("Section is not linked to an exam");
        }
        assertExamOwnerOrAdmin(section.getExam());
    }

    private QuestionResponse toResponse(Question question) {
        ExamSection section = question.getSection();
        Exam exam = section != null ? section.getExam() : null;
        return QuestionResponse.builder()
                .id(question.getId())
                .sectionId(section != null ? section.getId() : null)
                .sectionName(section != null ? section.getName() : null)
                .sectionType(section != null && section.getSectionType() != null
                        ? section.getSectionType().name() : null)
                .examId(exam != null ? exam.getId() : null)
                .examTitle(exam != null ? exam.getTitle() : null)
                .questionText(question.getQuestionText())
                .questionType(question.getQuestionType())
                .listeningAudioUrl(question.getListeningAudioUrl())
                .transcript(question.getTranscript())
                .points(question.getPoints())
                .minWords(question.getMinWords())
                .maxWords(question.getMaxWords())
                .createdAt(question.getCreatedAt())
                .options(question.getOptions() == null ? List.of()
                        : question.getOptions().stream()
                        .map(o -> QuestionOptionResponse.builder()
                                .id(o.getId())
                                .optionText(o.getOptionText())
                                .isCorrect(o.getIsCorrect())
                                .build())
                        .collect(Collectors.toList()))
                .build();
    }
}
