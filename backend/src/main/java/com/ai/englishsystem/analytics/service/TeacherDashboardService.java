package com.ai.englishsystem.analytics.service;

import com.ai.englishsystem.analytics.dto.TeacherDashboardSummaryResponse;
import com.ai.englishsystem.analytics.dto.TeacherDashboardSubmissionRow;
import com.ai.englishsystem.classmodule.repository.ClassRepository;
import com.ai.englishsystem.common.exception.BadRequestException;
import com.ai.englishsystem.common.util.SecurityUtils;
import com.ai.englishsystem.exam.dto.ExamDashboardRow;
import com.ai.englishsystem.exam.dto.ExamResponse;
import com.ai.englishsystem.exam.repository.ExamRepository;
import com.ai.englishsystem.submission.dto.SubmissionListResponse;
import com.ai.englishsystem.submission.repository.SubmissionRepository;
import com.ai.englishsystem.teacher.repository.TeacherRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Comparator;
import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class TeacherDashboardService {

    private final ExamRepository examRepository;
    private final ClassRepository classRepository;
    private final SubmissionRepository submissionRepository;
    private final TeacherRepository teacherRepository;

    @Transactional(readOnly = true)
    public TeacherDashboardSummaryResponse summary() {
        Integer teacherId = resolveTeacherId();
        List<ExamResponse> exams = loadDashboardExams(teacherId);
        List<SubmissionListResponse> submissions = loadDashboardSubmissions(teacherId);

        return TeacherDashboardSummaryResponse.builder()
                .classCount(resolveClassCount())
                .exams(exams)
                .submissions(submissions)
                .build();
    }

    private Integer resolveTeacherId() {
        if (!SecurityUtils.hasRole("TEACHER") || SecurityUtils.hasRole("ADMIN")) {
            return null;
        }
        return teacherRepository.findIdByUserId(SecurityUtils.getCurrentUserId())
                .orElseThrow(() -> new BadRequestException("Current user does not have a teacher profile."));
    }

    private List<ExamResponse> loadDashboardExams(Integer teacherId) {
        List<ExamDashboardRow> rows = teacherId == null
                ? examRepository.findDashboardRowsForAdmin()
                : examRepository.findDashboardRowsForTeacher("ACTIVE", teacherId);
        return rows.stream()
                .map(ExamDashboardRow::toResponse)
                .sorted(Comparator.comparing(
                        ExamResponse::getCreatedAt,
                        Comparator.nullsLast(Comparator.reverseOrder())))
                .collect(Collectors.toList());
    }

    private List<SubmissionListResponse> loadDashboardSubmissions(Integer teacherId) {
        List<TeacherDashboardSubmissionRow> rows = teacherId == null
                ? submissionRepository.findDashboardRowsForAdmin()
                : submissionRepository.findDashboardRowsForTeacher(teacherId);
        return rows.stream()
                .map(TeacherDashboardSubmissionRow::toResponse)
                .toList();
    }

    private int resolveClassCount() {
        if (SecurityUtils.hasRole("TEACHER") && !SecurityUtils.hasRole("ADMIN")) {
            return Math.toIntExact(classRepository.countByTeacher_User_Id(SecurityUtils.getCurrentUserId()));
        }
        return Math.toIntExact(classRepository.count());
    }
}
