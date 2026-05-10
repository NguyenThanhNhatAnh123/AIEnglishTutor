package com.ai.englishsystem.ai;

import com.ai.englishsystem.ai.dto.ImageOcrTtsResponse;
import com.ai.englishsystem.ai.service.AiScoringService;
import com.ai.englishsystem.ai.service.ImageOcrTtsService;
import com.ai.englishsystem.exam.dto.QuestionResponse;
import com.ai.englishsystem.exam.service.QuestionService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

import java.util.List;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;
import org.springframework.mock.web.MockMultipartFile;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class AiControllerSecurityTest {

    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private AiScoringService aiScoringService;

    @MockBean
    private ImageOcrTtsService imageOcrTtsService;

    @MockBean
    private QuestionService questionService;

    @Test
    @WithMockUser(roles = "STUDENT")
    void studentCannotCallManualWritingScoringEndpoint() throws Exception {
        mockMvc.perform(post("/api/ai/score-writing")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "answerId": 1,
                                  "essayText": "Some essay text"
                                }
                                """))
                .andExpect(status().isForbidden());

        verifyNoInteractions(aiScoringService);
    }

    @Test
    @WithMockUser(roles = "STUDENT")
    void studentCannotCallOcrToQuestionEndpoint() throws Exception {
        MockMultipartFile file = new MockMultipartFile(
                "file",
                "q.png",
                "image/png",
                "fake-image-bytes".getBytes()
        );

        mockMvc.perform(multipart("/api/ai/ocr-to-question")
                        .file(file)
                        .param("sectionId", "1")
                        .param("correctChoiceIndex", "0"))
                .andExpect(status().isForbidden());

        verifyNoInteractions(imageOcrTtsService);
        verifyNoInteractions(questionService);
    }

    @Test
    @WithMockUser(roles = "TEACHER")
    void teacherCanCallOcrToQuestionEndpoint() throws Exception {
        MockMultipartFile file = new MockMultipartFile(
                "file",
                "q.png",
                "image/png",
                "fake-image-bytes".getBytes()
        );

        ImageOcrTtsResponse ocr = ImageOcrTtsResponse.builder()
                .questionText("What is 2 + 2?")
                .extractedText("What is 2 + 2?\nA. 4\nB. 5")
                .choices(List.of("4", "5"))
                .audioUrl("/uploads/audio/tts/x.mp3")
                .build();
        QuestionResponse question = QuestionResponse.builder()
                .id(101)
                .questionText("What is 2 + 2?")
                .questionType("LISTENING")
                .build();

        given(imageOcrTtsService.processImage(any())).willReturn(ocr);
        given(questionService.create(any())).willReturn(question);

        mockMvc.perform(multipart("/api/ai/ocr-to-question")
                        .file(file)
                        .param("sectionId", "1")
                        .param("points", "1")
                        .param("correctChoiceIndex", "0"))
                .andExpect(status().isOk());
    }
}
