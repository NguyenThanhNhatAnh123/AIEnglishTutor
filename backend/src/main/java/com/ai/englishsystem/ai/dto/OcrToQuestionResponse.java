package com.ai.englishsystem.ai.dto;

import com.ai.englishsystem.exam.dto.QuestionResponse;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class OcrToQuestionResponse {
    private ImageOcrTtsResponse ocr;
    private QuestionResponse question;
}
