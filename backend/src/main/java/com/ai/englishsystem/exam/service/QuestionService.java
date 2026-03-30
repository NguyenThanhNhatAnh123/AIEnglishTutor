package com.ai.englishsystem.exam.service;

import com.ai.englishsystem.common.exception.NotFoundException;
import com.ai.englishsystem.exam.dto.QuestionRequest;
import com.ai.englishsystem.exam.dto.QuestionResponse;
import com.ai.englishsystem.exam.dto.QuestionOptionResponse;
import com.ai.englishsystem.exam.entity.ExamSection;
import com.ai.englishsystem.exam.entity.Question;
import com.ai.englishsystem.exam.entity.QuestionOption;
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

    @Transactional(readOnly = true)
    public List<QuestionResponse> findAll() {
        return questionRepository.findAll().stream()
                .map(this::toResponse)
                .collect(Collectors.toList());
    }

    @Transactional
    public QuestionResponse create(QuestionRequest request) {
        ExamSection section = examSectionRepository.findById(request.getSectionId())
                .orElseThrow(() -> new NotFoundException("Exam section", request.getSectionId()));

        Question question = Question.builder()
                .section(section)
                .questionText(request.getQuestionText())
                .questionType(request.getQuestionType() != null ? request.getQuestionType() : "MULTIPLE_CHOICE")
                .points(request.getPoints() != null ? request.getPoints() : 1)
                .build();

        question = questionRepository.save(question);

        if (request.getOptions() != null && !request.getOptions().isEmpty()) {
            for (var optReq : request.getOptions()) {
                QuestionOption option = QuestionOption.builder()
                        .question(question)
                        .optionText(optReq.getOptionText())
                        .isCorrect(optReq.getIsCorrect() != null ? optReq.getIsCorrect() : false)
                        .build();
                question.getOptions().add(option);
            }
            question = questionRepository.save(question);
        }

        return toResponse(question);
    }

    private QuestionResponse toResponse(Question question) {
        return QuestionResponse.builder()
                .id(question.getId())
                .sectionId(question.getSection().getId())
                .questionText(question.getQuestionText())
                .questionType(question.getQuestionType())
                .points(question.getPoints())
                .createdAt(question.getCreatedAt())
                .options(question.getOptions().stream()
                        .map(o -> QuestionOptionResponse.builder()
                                .id(o.getId())
                                .optionText(o.getOptionText())
                                .isCorrect(o.getIsCorrect())
                                .build())
                        .collect(Collectors.toList()))
                .build();
    }
}
