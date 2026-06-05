package com.ai.englishsystem.exam.mapper;

import com.ai.englishsystem.exam.dto.QuestionOptionResponse;
import com.ai.englishsystem.exam.dto.QuestionResponse;
import com.ai.englishsystem.exam.entity.Exam;
import com.ai.englishsystem.exam.entity.ExamSection;
import com.ai.englishsystem.exam.entity.Question;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.stream.Collectors;

@Component
public class QuestionMapper {

    public QuestionResponse toResponse(Question question) {
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
