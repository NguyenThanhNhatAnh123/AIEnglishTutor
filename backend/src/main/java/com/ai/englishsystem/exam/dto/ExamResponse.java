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

    /** OFFICIAL or PRACTICE */
    private String examType;
    /** Null means unlimited attempts. */
    private Integer maxAttempts;
    /** Student portal: completed attempts for the current student when available. */
    @JsonInclude(JsonInclude.Include.NON_NULL)
    private Long completedAttempts;
    /** Student portal: null means unlimited attempts, 0 means limit reached. */
    @JsonInclude(JsonInclude.Include.NON_NULL)
    private Integer remainingAttempts;
    /** Student portal: true when the student can resume an in-progress submission. */
    @JsonInclude(JsonInclude.Include.NON_NULL)
    private Boolean hasInProgressSubmission;

    private LocalDateTime createdAt;
    /** Populated in list responses when sections are eager-fetched (e.g. teacher's exams). */
    @JsonInclude(JsonInclude.Include.NON_NULL)
    private Integer sectionCount;
    /** Populated when sections/questions are available for readiness display. */
    @JsonInclude(JsonInclude.Include.NON_NULL)
    private Integer questionCount;
    /** Teacher portal: false when this exam is ACTIVE but owned by another teacher (view-only). */
    @JsonInclude(JsonInclude.Include.NON_NULL)
    private Boolean canManage;
    /** Empty means unrestricted access by class. */
    @JsonInclude(JsonInclude.Include.NON_NULL)
    private List<ExamAllowedClassResponse> allowedClasses;
    private List<ExamSectionResponse> sections;
}
