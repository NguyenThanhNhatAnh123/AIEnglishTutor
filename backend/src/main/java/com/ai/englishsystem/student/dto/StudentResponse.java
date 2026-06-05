package com.ai.englishsystem.student.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDate;
import java.time.LocalDateTime;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class StudentResponse {
    private Integer id;
    private Integer userId;
    private String username;
    private String studentCode;
    private String fullName;
    private String email;
    private String status;
    private LocalDate dateOfBirth;
    private LocalDateTime createdAt;
}
