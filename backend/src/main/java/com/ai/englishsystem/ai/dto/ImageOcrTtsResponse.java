package com.ai.englishsystem.ai.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ImageOcrTtsResponse {
    private String imageUrl;
    private String extractedText;
    private String audioUrl;
}
