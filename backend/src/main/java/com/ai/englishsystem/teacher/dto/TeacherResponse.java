package com.ai.englishsystem.teacher.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class TeacherResponse {
    private Integer id;
    private Integer userId;
    private String teacherCode;
    private String fullName;
    private String email;
    private String department;
    private LocalDateTime createdAt;
}
