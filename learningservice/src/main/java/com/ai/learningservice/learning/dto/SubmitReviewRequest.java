package com.ai.learningservice.learning.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class SubmitReviewRequest {

    @NotNull(message = "itemId is required")
    private Long itemId;

    @NotBlank(message = "rating is required")
    private String rating;

    @NotBlank(message = "requestId is required")
    @Size(max = 80, message = "requestId must be at most 80 characters")
    private String requestId;
}
