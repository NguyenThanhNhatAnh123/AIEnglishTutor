package com.ai.englishsystem.exam.service;

import com.ai.englishsystem.common.exception.BadRequestException;
import com.ai.englishsystem.common.exception.ForbiddenException;
import com.ai.englishsystem.common.exception.NotFoundException;
import com.ai.englishsystem.common.exception.UnauthorizedException;
import com.ai.englishsystem.common.util.SecurityUtils;
import com.ai.englishsystem.exam.dto.ExamRequest;
import com.ai.englishsystem.exam.dto.ExamResponse;
import com.ai.englishsystem.exam.dto.ExamSectionResponse;
import com.ai.englishsystem.exam.dto.QuestionOptionResponse;
import com.ai.englishsystem.exam.dto.QuestionResponse;
import com.ai.englishsystem.exam.entity.Exam;
import com.ai.englishsystem.exam.entity.ExamSection;
import com.ai.englishsystem.exam.repository.ExamRepository;
import com.ai.englishsystem.exam.repository.ExamSectionRepository;
import com.ai.englishsystem.teacher.entity.Teacher;
import com.ai.englishsystem.teacher.repository.TeacherRepository;
import com.ai.englishsystem.user.entity.User;
import com.ai.englishsystem.user.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class ExamService {

    private final ExamRepository examRepository;
    private final ExamSectionRepository examSectionRepository;
    private final TeacherRepository teacherRepository;
    private final UserRepository userRepository;

    // ─── READ ────────────────────────────────────────────────────────────────

    @Transactional(readOnly = true)
    public List<ExamResponse> findAll() {
        return examRepository.findAll().stream()
                .map(this::toResponse)
                .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public ExamResponse findById(Integer id) {
        Exam exam = examRepository.findById(id)
                .orElseThrow(() -> new NotFoundException("Exam", id));
        return toResponseWithSections(exam);
    }

    // ─── CREATE ───────────────────────────────────────────────────────────────

    @Transactional
    public ExamResponse create(ExamRequest request) {
        // ADMIN: dùng teacherId từ request hoặc lấy teacher đầu tiên
        // TEACHER: resolve từ JWT như bình thường
        Teacher teacher;
        if (SecurityUtils.hasRole("ADMIN")) {
            if (request.getTeacherId() != null) {
                teacher = teacherRepository.findById(request.getTeacherId())
                        .orElseThrow(() -> new NotFoundException("Teacher", request.getTeacherId()));
            } else {
                teacher = teacherRepository.findAll().stream().findFirst()
                        .orElseThrow(() -> new BadRequestException("No teacher profile found. Please create a teacher first."));
            }
        } else {
            teacher = resolveCurrentTeacher();
        }

        Exam exam = Exam.builder()
                .title(request.getTitle())
                .description(request.getDescription())
                .teacher(teacher)
                .durationMinutes(request.getDurationMinutes() != null ? request.getDurationMinutes() : 60)
                .status(request.getStatus() != null ? request.getStatus() : "DRAFT")
                .build();

        exam = examRepository.save(exam);

        ExamSection defaultSection = ExamSection.builder()
                .exam(exam)
                .name("Section 1")
                .orderIndex(0)
                .build();
        defaultSection = examSectionRepository.save(defaultSection);
        exam.getSections().add(defaultSection);

        return toResponse(exam);
    }

    // ─── UPDATE (full) ────────────────────────────────────────────────────────

    @Transactional
    public ExamResponse update(Integer id, ExamRequest request) {
        Exam exam = examRepository.findById(id)
                .orElseThrow(() -> new NotFoundException("Exam", id));

        assertOwnerOrAdmin(exam);

        if (request.getTitle() != null && !request.getTitle().isBlank()) {
            exam.setTitle(request.getTitle());
        }
        exam.setDescription(request.getDescription());
        if (request.getDurationMinutes() != null) {
            exam.setDurationMinutes(request.getDurationMinutes());
        }
        if (request.getStatus() != null && !request.getStatus().isBlank()) {
            exam.setStatus(request.getStatus());
        }

        exam = examRepository.save(exam);
        return toResponseWithSections(exam);
    }

    // ─── PARTIAL UPDATE (PATCH) ───────────────────────────────────────────────

    @Transactional
    public ExamResponse partialUpdate(Integer id, ExamRequest request) {
        Exam exam = examRepository.findById(id)
                .orElseThrow(() -> new NotFoundException("Exam", id));

        assertOwnerOrAdmin(exam);

        if (request.getTitle() != null && !request.getTitle().isBlank()) {
            exam.setTitle(request.getTitle());
        }
        if (request.getDescription() != null) {
            exam.setDescription(request.getDescription());
        }
        if (request.getDurationMinutes() != null) {
            exam.setDurationMinutes(request.getDurationMinutes());
        }
        if (request.getStatus() != null && !request.getStatus().isBlank()) {
            exam.setStatus(request.getStatus());
        }

        exam = examRepository.save(exam);
        return toResponseWithSections(exam);
    }

    // ─── DELETE ───────────────────────────────────────────────────────────────

    @Transactional
    public void delete(Integer id) {
        Exam exam = examRepository.findById(id)
                .orElseThrow(() -> new NotFoundException("Exam", id));

        assertOwnerOrAdmin(exam);

        examRepository.delete(exam);
    }

    // ─── PRIVATE HELPERS ─────────────────────────────────────────────────────

    private Teacher resolveCurrentTeacher() {
        Integer userId = SecurityUtils.getCurrentUserId();

        User user = userRepository.findById(userId)
                .orElseThrow(() -> new UnauthorizedException("Authenticated user not found in database"));

        // FIX: findFirstByUser thay vì findByUser để tránh NonUniqueResultException
        return teacherRepository.findFirstByUser(user)
                .orElseThrow(() -> new BadRequestException(
                        "Current user does not have a teacher profile. " +
                                "Only teachers can create exams."));
    }

    private void assertOwnerOrAdmin(Exam exam) {
        if (SecurityUtils.hasRole("ADMIN")) {
            return;
        }

        if (SecurityUtils.hasRole("TEACHER")) {
            Integer currentUserId = SecurityUtils.getCurrentUserId();
            Integer examOwnerUserId = exam.getTeacher().getUser().getId();
            if (!currentUserId.equals(examOwnerUserId)) {
                throw new ForbiddenException("You do not have permission to modify this exam");
            }
            return;
        }

        throw new ForbiddenException("Access denied");
    }

    // ─── MAPPING ──────────────────────────────────────────────────────────────

    private ExamResponse toResponse(Exam exam) {
        return ExamResponse.builder()
                .id(exam.getId())
                .title(exam.getTitle())
                .description(exam.getDescription())
                .teacherId(exam.getTeacher().getId())
                .teacherName(exam.getTeacher().getUser().getFullName())
                .durationMinutes(exam.getDurationMinutes())
                .status(exam.getStatus())
                .createdAt(exam.getCreatedAt())
                .build();
    }

    private ExamResponse toResponseWithSections(Exam exam) {
        ExamResponse response = toResponse(exam);
        List<ExamSectionResponse> sections = exam.getSections().stream()
                .sorted((a, b) -> Integer.compare(
                        a.getOrderIndex() != null ? a.getOrderIndex() : 0,
                        b.getOrderIndex() != null ? b.getOrderIndex() : 0))
                .map(s -> ExamSectionResponse.builder()
                        .id(s.getId())
                        .name(s.getName())
                        .orderIndex(s.getOrderIndex())
                        .questions(s.getQuestions() != null
                                ? s.getQuestions().stream()
                                .map(q -> QuestionResponse.builder()
                                        .id(q.getId())
                                        .sectionId(q.getSection().getId())
                                        .questionText(q.getQuestionText())
                                        .questionType(q.getQuestionType())
                                        .points(q.getPoints())
                                        .createdAt(q.getCreatedAt())
                                        .options(q.getOptions() != null
                                                ? q.getOptions().stream()
                                                .map(o -> QuestionOptionResponse.builder()
                                                        .id(o.getId())
                                                        .optionText(o.getOptionText())
                                                        .isCorrect(o.getIsCorrect())
                                                        .build())
                                                .collect(Collectors.toList())
                                                : List.of())
                                        .build())
                                .collect(Collectors.toList())
                                : List.of())
                        .build())
                .collect(Collectors.toList());
        response.setSections(sections);
        return response;
    }
}