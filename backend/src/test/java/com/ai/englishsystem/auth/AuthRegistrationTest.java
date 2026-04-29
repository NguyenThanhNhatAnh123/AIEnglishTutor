package com.ai.englishsystem.auth;

import com.ai.englishsystem.student.repository.StudentRepository;
import com.ai.englishsystem.user.entity.User;
import com.ai.englishsystem.user.repository.UserRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class AuthRegistrationTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private StudentRepository studentRepository;

    @Test
    void registerCreatesStudentAccountByDefault() throws Exception {
        String email = "fresh.student@example.com";

        mockMvc.perform(post("/api/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "username": "freshstudent",
                                  "email": "%s",
                                  "password": "secret123",
                                  "fullName": "Fresh Student"
                                }
                                """.formatted(email)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.role").value("STUDENT"))
                .andExpect(jsonPath("$.data.accessToken").isNotEmpty());

        User created = userRepository.findByEmail(email).orElseThrow();
        assertThat(created.getRole().getName()).isEqualTo("STUDENT");
        assertThat(studentRepository.findByUser(created)).isPresent();
    }

    @Test
    void registerRejectsNonStudentRoleId() throws Exception {
        mockMvc.perform(post("/api/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "username": "wrongroleuser",
                                  "email": "wrong.role@example.com",
                                  "password": "secret123",
                                  "fullName": "Wrong Role",
                                  "roleId": 2
                                }
                                """))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("Public registration can only create student accounts"));
    }
}
