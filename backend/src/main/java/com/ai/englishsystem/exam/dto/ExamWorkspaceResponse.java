package com.ai.englishsystem.exam.dto;

import com.ai.englishsystem.classmodule.dto.ClassResponse;
import com.ai.englishsystem.teacher.dto.TeacherResponse;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ExamWorkspaceResponse {
    private List<ExamResponse> exams;
    private List<ClassResponse> classes;
    private List<TeacherResponse> teachers;
}
