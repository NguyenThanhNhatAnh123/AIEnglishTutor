package com.ai.englishsystem.analytics.dto;

import com.ai.englishsystem.exam.dto.ExamResponse;
import com.ai.englishsystem.submission.dto.SubmissionListResponse;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class TeacherDashboardSummaryResponse {
    private Integer classCount;
    private List<ExamResponse> exams;
    private List<SubmissionListResponse> submissions;
}
