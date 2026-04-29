package com.ai.englishsystem.ai;

import com.ai.englishsystem.ai.service.AiScoringService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

import static org.mockito.Mockito.verifyNoInteractions;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class AiControllerSecurityTest {

    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private AiScoringService aiScoringService;

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
}
