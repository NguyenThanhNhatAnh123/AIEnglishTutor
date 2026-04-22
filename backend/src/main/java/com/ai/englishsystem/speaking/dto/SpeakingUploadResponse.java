package com.ai.englishsystem.speaking.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class SpeakingUploadResponse {
    /** Public path e.g. /uploads/audio/speaking/uuid_1_2.mp3 */
    private String url;
    private int durationSeconds;
    /** Always mp3 after server processing */
    private String format;
}
