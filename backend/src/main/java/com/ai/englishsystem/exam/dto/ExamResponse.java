package com.ai.englishsystem.exam.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ExamResponse {
    private Integer id;
    private String title;
    private String description;
    private Integer teacherId;
    private String teacherName;
    private Integer durationMinutes;
    private String status;
    private LocalDateTime createdAt;
    /** Populated in list responses when sections are eager-fetched (e.g. teacher's exams). */
    @JsonInclude(JsonInclude.Include.NON_NULL)
    private Integer sectionCount;
    /** Teacher portal: false when this exam is ACTIVE but owned by another teacher (view-only). */
    @JsonInclude(JsonInclude.Include.NON_NULL)
    private Boolean canManage;
    private List<ExamSectionResponse> sections;
}
