package com.ai.englishsystem.classmodule.dto;

import com.ai.englishsystem.student.dto.StudentResponse;
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
public class ClassWorkspaceResponse {
    private List<ClassResponse> classes;
    private List<StudentResponse> students;
    private List<TeacherResponse> teachers;
}
