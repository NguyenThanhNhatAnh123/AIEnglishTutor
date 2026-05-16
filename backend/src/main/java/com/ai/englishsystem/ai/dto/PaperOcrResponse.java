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
public class PaperOcrResponse {
    private String fileUrl;
    private String extractedText;
    private List<PaperOcrQuestionDraft> questions;
}
