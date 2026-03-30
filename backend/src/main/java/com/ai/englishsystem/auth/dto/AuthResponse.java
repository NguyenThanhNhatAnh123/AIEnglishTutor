package com.ai.englishsystem.auth.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AuthResponse {
    // FIX: renamed from "token" → "accessToken" for frontend compatibility
    private String accessToken;

    // FIX: @Builder.Default required — Lombok @Builder ignores Java field initializers
    @Builder.Default
    private String tokenType = "Bearer";

    private Integer userId;
    private String username;
    private String email;
    private String role;
}
