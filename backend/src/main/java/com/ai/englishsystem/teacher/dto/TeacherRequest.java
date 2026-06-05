package com.ai.englishsystem.teacher.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class TeacherRequest {
    /** Optional legacy path. New clients should send username/email/password instead. */
    private Integer userId;

    @NotBlank
    private String teacherCode;

    private String department;

    @Size(max = 50)
    private String username;

    @Email
    @Size(max = 150)
    private String email;

    @Size(min = 6, max = 100)
    private String password;

    @Size(max = 150)
    private String fullName;

    private String status;
}
