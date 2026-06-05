package com.ai.englishsystem.submission.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AnswerBatchRequest {

    @Valid
    @NotEmpty(message = "answers is required")
    @Size(max = 200, message = "At most 200 answers can be saved in one batch")
    private List<AnswerRequest> answers;
}
