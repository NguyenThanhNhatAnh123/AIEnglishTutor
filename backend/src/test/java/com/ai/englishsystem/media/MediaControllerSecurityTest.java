package com.ai.englishsystem.media;

import com.ai.englishsystem.media.service.MediaService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class MediaControllerSecurityTest {

    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private MediaService mediaService;

    @Test
    void anonymousUserCannotUploadMedia() throws Exception {
        MockMultipartFile file = new MockMultipartFile(
                "file",
                "sample.mp3",
                "audio/mpeg",
                "fake-audio".getBytes()
        );

        mockMvc.perform(multipart("/api/media/upload").file(file))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void anonymousUserCannotAccessSpeakingUploads() throws Exception {
        mockMvc.perform(get("/uploads/audio/speaking/private-answer.mp3"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void anonymousUserCanAccessPublicListeningUploads() throws Exception {
        mockMvc.perform(get("/uploads/audio/listening/public-prompt.mp3"))
                .andExpect(status().isNotFound())
                .andExpect(header().doesNotExist("WWW-Authenticate"));
    }

    @Test
    void anonymousUserCannotAccessLegacyMediaFiles() throws Exception {
        mockMvc.perform(get("/api/media/files/legacy-prompt.mp3"))
                .andExpect(status().isUnauthorized());
    }
}
