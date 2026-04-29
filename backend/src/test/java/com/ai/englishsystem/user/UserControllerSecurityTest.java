package com.ai.englishsystem.user;

import com.ai.englishsystem.user.service.UserService;
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
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class UserControllerSecurityTest {

    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private UserService userService;

    @Test
    @WithMockUser(roles = "TEACHER")
    void teacherCannotUpdateUsers() throws Exception {
        mockMvc.perform(put("/api/users/1")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "username": "user1",
                                  "email": "user1@example.com",
                                  "password": "secret123",
                                  "fullName": "User One",
                                  "roleId": 1,
                                  "status": "ACTIVE"
                                }
                                """))
                .andExpect(status().isForbidden());

        verifyNoInteractions(userService);
    }

    @Test
    void anonymousUserCannotUpdateUsers() throws Exception {
        mockMvc.perform(put("/api/users/1")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "username": "user1",
                                  "email": "user1@example.com",
                                  "password": "secret123",
                                  "fullName": "User One",
                                  "roleId": 1,
                                  "status": "ACTIVE"
                                }
                                """))
                .andExpect(status().isUnauthorized());

        verifyNoInteractions(userService);
    }
}
