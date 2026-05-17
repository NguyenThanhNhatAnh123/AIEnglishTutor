package com.ai.englishsystem.ai;

import com.ai.englishsystem.ai.service.ImageOcrTtsService;
import com.ai.englishsystem.ai.service.PaperOcrParser;
import com.ai.englishsystem.common.exception.BadRequestException;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

import static org.assertj.core.api.Assertions.assertThatThrownBy;

class ImageOcrTtsServiceValidationTest {

    @Test
    void ttsRejectsTextLongerThanConfiguredLimitBeforeCallingExternalService() {
        ImageOcrTtsService service = new ImageOcrTtsService(new ObjectMapper(), new PaperOcrParser());
        ReflectionTestUtils.setField(service, "ttsMaxTextChars", 100);

        assertThatThrownBy(() -> service.synthesizeTextToAudio("x".repeat(101)))
                .isInstanceOf(BadRequestException.class)
                .hasMessageContaining("text exceeds maximum TTS length");
    }
}
