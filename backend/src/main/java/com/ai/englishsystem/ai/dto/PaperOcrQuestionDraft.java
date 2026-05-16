package com.ai.englishsystem.ai.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class PaperOcrQuestionDraft {
    private Integer questionNumber;
    private String questionText;
    private List<String> choices;
    private Integer correctChoiceIndex;
    private String rawText;
}
