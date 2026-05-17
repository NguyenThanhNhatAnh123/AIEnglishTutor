package com.ai.englishsystem.analytics.controller;

import com.ai.englishsystem.analytics.dto.TeacherDashboardSummaryResponse;
import com.ai.englishsystem.analytics.service.TeacherDashboardService;
import com.ai.englishsystem.common.dto.ApiResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/teacher/dashboard")
@RequiredArgsConstructor
public class TeacherDashboardController {

    private final TeacherDashboardService teacherDashboardService;

    @GetMapping("/summary")
    @PreAuthorize("hasAnyRole('TEACHER', 'ADMIN')")
    public ResponseEntity<ApiResponse<TeacherDashboardSummaryResponse>> summary() {
        return ResponseEntity.ok(ApiResponse.success(teacherDashboardService.summary()));
    }
}
