package com.ai.englishsystem.classmodule.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ClassStudentResponse {
    private Integer studentId;
    private String studentCode;
    private String fullName;
    private String username;
    private String email;
    private String status;
    private LocalDateTime joinedAt;
}
