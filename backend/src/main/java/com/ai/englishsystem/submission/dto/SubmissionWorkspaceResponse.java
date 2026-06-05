package com.ai.englishsystem.submission.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;
import java.util.Map;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class SubmissionWorkspaceResponse {
    private List<SubmissionListResponse> submissions;
    private Map<Integer, List<AnswerResponse>> answersBySubmissionId;
}
