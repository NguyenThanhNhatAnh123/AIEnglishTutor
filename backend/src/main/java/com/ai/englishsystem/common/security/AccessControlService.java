package com.ai.englishsystem.common.security;

import com.ai.englishsystem.common.exception.ForbiddenException;
import com.ai.englishsystem.common.exception.NotFoundException;
import com.ai.englishsystem.common.util.SecurityUtils;
import com.ai.englishsystem.exam.entity.Exam;
import com.ai.englishsystem.submission.entity.Answer;
import com.ai.englishsystem.submission.entity.Submission;
import org.springframework.stereotype.Service;

@Service
public class AccessControlService {

    public void assertTeacherOrAdminOwnsExam(Exam exam, String message) {
        if (SecurityUtils.hasRole("ADMIN")) {
            return;
        }
        if (SecurityUtils.hasRole("TEACHER") && SecurityUtils.getCurrentUserId().equals(examOwnerUserId(exam))) {
            return;
        }
        throw new ForbiddenException(message);
    }

    public void assertTeacherOrAdminCanAccessSubmission(Submission submission, String message) {
        if (SecurityUtils.hasRole("ADMIN")) {
            return;
        }
        if (SecurityUtils.hasRole("TEACHER")
                && SecurityUtils.getCurrentUserId().equals(examOwnerUserId(submission.getExam()))) {
            return;
        }
        throw new ForbiddenException(message);
    }

    public void assertCurrentUserCanViewSubmission(Submission submission) {
        assertCurrentUserCanViewSubmission(
                submission,
                "You do not have permission to view this submission",
                "You do not have permission to view this submission",
                "You do not have permission to view this submission"
        );
    }

    public void assertCurrentUserCanViewSubmission(
            Submission submission,
            String teacherDeniedMessage,
            String studentDeniedMessage,
            String fallbackDeniedMessage
    ) {
        if (SecurityUtils.hasRole("ADMIN")) {
            return;
        }
        Integer currentUserId = SecurityUtils.getCurrentUserId();
        if (SecurityUtils.hasRole("TEACHER") && currentUserId.equals(examOwnerUserId(submission.getExam()))) {
            return;
        }
        if (SecurityUtils.hasRole("STUDENT") && currentUserId.equals(studentUserId(submission))) {
            return;
        }
        if (SecurityUtils.hasRole("TEACHER")) {
            throw new ForbiddenException(teacherDeniedMessage);
        }
        if (SecurityUtils.hasRole("STUDENT")) {
            throw new ForbiddenException(studentDeniedMessage);
        }
        throw new ForbiddenException(fallbackDeniedMessage);
    }

    public void assertCurrentStudentOwnsSubmission(Submission submission, String message) {
        if (SecurityUtils.hasRole("STUDENT") && SecurityUtils.getCurrentUserId().equals(studentUserId(submission))) {
            return;
        }
        throw new ForbiddenException(message);
    }

    public void assertTeacherOrAdminCanManageAnswer(Answer answer, String message) {
        if (answer == null || answer.getSubmission() == null) {
            throw new NotFoundException("Submission not loaded for answer");
        }
        assertTeacherOrAdminCanAccessSubmission(answer.getSubmission(), message);
    }

    private Integer examOwnerUserId(Exam exam) {
        if (exam == null || exam.getTeacher() == null || exam.getTeacher().getUser() == null) {
            throw new NotFoundException("Exam owner not loaded");
        }
        return exam.getTeacher().getUser().getId();
    }

    private Integer studentUserId(Submission submission) {
        if (submission == null || submission.getStudent() == null || submission.getStudent().getUser() == null) {
            throw new NotFoundException("Submission student not loaded");
        }
        return submission.getStudent().getUser().getId();
    }
}
