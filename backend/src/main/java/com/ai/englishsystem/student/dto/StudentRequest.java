package com.ai.englishsystem.student.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDate;
import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class StudentRequest {
    /** Optional legacy path: link an existing STUDENT user. */
    private Integer userId;

    @NotBlank
    private String studentCode;

    private LocalDate dateOfBirth;

    /** Preferred create path: user + student profile are created in one transaction. */
    @Size(min = 3, max = 100)
    private String username;

    @Email
    @Size(max = 150)
    private String email;

    @Size(min = 6)
    private String password;

    @Size(max = 150)
    private String fullName;

    private String status;

    /** Optional initial class enrollments. Required for teacher-created students. */
    private List<Integer> classIds;
}
