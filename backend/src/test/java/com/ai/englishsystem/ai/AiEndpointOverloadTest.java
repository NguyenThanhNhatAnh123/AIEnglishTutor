package com.ai.englishsystem.ai;

import com.ai.englishsystem.ai.dto.AiScoreResponse;
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
import org.springframework.test.web.servlet.MvcResult;

import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.BDDMockito.given;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.asyncDispatch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.request;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest(properties = {
        "app.ai.async.core-pool-size=1",
        "app.ai.async.max-pool-size=1",
        "app.ai.async.queue-capacity=0"
})
@AutoConfigureMockMvc
@ActiveProfiles("test")
class AiEndpointOverloadTest {

    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private AiScoringService aiScoringService;

    @Test
    @WithMockUser(roles = "TEACHER")
    void saturatedAiExecutorReturns503InsteadOfRunningOnRequestThread() throws Exception {
        CountDownLatch workerEntered = new CountDownLatch(1);
        CountDownLatch releaseWorker = new CountDownLatch(1);
        given(aiScoringService.scoreWriting(any())).willAnswer(invocation -> {
            workerEntered.countDown();
            assertThat(releaseWorker.await(5, TimeUnit.SECONDS)).isTrue();
            return AiScoreResponse.builder()
                    .overallScore(8.0f)
                    .feedback("ok")
                    .build();
        });

        MvcResult accepted = mockMvc.perform(post("/api/ai/score-writing")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(scoreWritingJson(1)))
                .andExpect(request().asyncStarted())
                .andReturn();

        assertThat(workerEntered.await(5, TimeUnit.SECONDS)).isTrue();

        MvcResult rejected = mockMvc.perform(post("/api/ai/score-writing")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(scoreWritingJson(2)))
                .andExpect(request().asyncStarted())
                .andReturn();

        mockMvc.perform(asyncDispatch(rejected))
                .andExpect(status().isServiceUnavailable());

        releaseWorker.countDown();
        mockMvc.perform(asyncDispatch(accepted))
                .andExpect(status().isOk());
    }

    private String scoreWritingJson(int answerId) {
        return """
                {
                  "answerId": %d,
                  "essayText": "A short essay"
                }
                """.formatted(answerId);
    }
}
