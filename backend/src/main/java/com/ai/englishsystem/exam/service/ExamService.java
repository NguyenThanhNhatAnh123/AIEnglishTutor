package com.ai.englishsystem.exam.service;

import com.ai.englishsystem.common.exception.BadRequestException;
import com.ai.englishsystem.common.exception.ForbiddenException;
import com.ai.englishsystem.common.exception.NotFoundException;
import com.ai.englishsystem.common.exception.UnauthorizedException;
import com.ai.englishsystem.common.util.SecurityUtils;
import com.ai.englishsystem.exam.dto.ExamRequest;
import com.ai.englishsystem.exam.dto.ExamResponse;
import com.ai.englishsystem.exam.dto.ExamSectionRequest;
import com.ai.englishsystem.exam.dto.ExamSectionResponse;
import com.ai.englishsystem.exam.dto.ExamSectionSummaryResponse;
import com.ai.englishsystem.exam.dto.ExamSectionUpdateRequest;
import com.ai.englishsystem.exam.dto.QuestionOptionResponse;
import com.ai.englishsystem.exam.dto.QuestionResponse;
import com.ai.englishsystem.exam.entity.Exam;
import com.ai.englishsystem.exam.entity.ExamAttempt;
import com.ai.englishsystem.exam.entity.ExamSection;
import com.ai.englishsystem.exam.entity.ExamSectionType;
import com.ai.englishsystem.exam.entity.ExamType;
import com.ai.englishsystem.exam.repository.ExamRepository;
import com.ai.englishsystem.exam.repository.ExamSectionRepository;
import com.ai.englishsystem.exam.repository.ExamAttemptRepository;
import com.ai.englishsystem.result.repository.FeedbackRepository;
import com.ai.englishsystem.result.repository.ScoreRepository;
import com.ai.englishsystem.ai.repository.AiResultRepository;
import com.ai.englishsystem.classmodule.entity.ClassEntity;
import com.ai.englishsystem.classmodule.repository.ClassRepository;
import com.ai.englishsystem.speaking.service.SpeakingFileStorage;
import com.ai.englishsystem.teacher.entity.Teacher;
import com.ai.englishsystem.teacher.repository.TeacherRepository;
import com.ai.englishsystem.submission.entity.Answer;
import com.ai.englishsystem.submission.entity.Submission;
import com.ai.englishsystem.submission.repository.AnswerRepository;
import com.ai.englishsystem.submission.repository.SubmissionRepository;
import com.ai.englishsystem.submission.repository.SubmissionSuspiciousEventRepository;
import com.ai.englishsystem.user.entity.User;
import com.ai.englishsystem.user.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.hibernate.Hibernate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class ExamService {

    private final ExamRepository examRepository;
    private final ExamSectionRepository examSectionRepository;
    private final TeacherRepository teacherRepository;
    private final UserRepository userRepository;
    private final SubmissionRepository submissionRepository;
    private final AnswerRepository answerRepository;
    private final ScoreRepository scoreRepository;
    private final AiResultRepository aiResultRepository;
    private final FeedbackRepository feedbackRepository;
    private final ExamAttemptRepository examAttemptRepository;
    private final SubmissionSuspiciousEventRepository submissionSuspiciousEventRepository;
    private final SpeakingFileStorage speakingFileStorage;
    private final ClassRepository classRepository;

    // ─── READ ────────────────────────────────────────────────────────────────

    /**
     * Admins see all exams. Teachers see every ACTIVE exam (same pool as students) plus their own
     * non-active drafts. Students hitting this endpoint get ACTIVE-only (prefer /api/student/exams).
     */
    @Transactional(readOnly = true)
    public List<ExamResponse> findAll() {
        if (SecurityUtils.hasRole("ADMIN")) {
            List<Exam> exams = examRepository.findAll();
            initializeListResponseAssociations(exams);
            return exams.stream()
                    .sorted(byCreatedDesc())
                    .map(this::toResponse)
                    .collect(Collectors.toList());
        }
        if (SecurityUtils.hasRole("TEACHER")) {
            Teacher teacher = resolveCurrentTeacher();
            List<Exam> exams = examRepository.findActiveOrOwnedByTeacher("ACTIVE", teacher);
            initializeListResponseAssociations(exams);
            Integer myTeacherId = teacher.getId();
            return exams.stream()
                    .sorted(byCreatedDesc())
                    .map(e -> toResponse(e, e.getTeacher().getId().equals(myTeacherId)))
                    .collect(Collectors.toList());
        }
        List<Exam> exams = examRepository.findByStatusWithTeacher("ACTIVE");
        return exams.stream()
                .sorted(byCreatedDesc())
                .map(this::toResponse)
                .collect(Collectors.toList());
    }

    private static Comparator<Exam> byCreatedDesc() {
        return Comparator.comparing(Exam::getCreatedAt, Comparator.nullsLast(Comparator.reverseOrder()));
    }

    /**
     * Full exam detail with sections. Ownership-checked for teachers.
     */
    @Transactional(readOnly = true)
    public ExamResponse findById(Integer id) {
        Exam exam = examRepository.findById(id)
                .orElseThrow(() -> new NotFoundException("Exam", id));

        // Ownership check: teachers can only view their own exams
        assertOwnerOrAdmin(exam);

        return toResponseWithSections(exam);
    }

    // ─── CREATE ───────────────────────────────────────────────────────────────

    @Transactional
    public ExamResponse create(ExamRequest request) {
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

        ExamType examType = parseExamType(request.getExamType());
        Exam exam = Exam.builder()
                .title(request.getTitle())
                .description(request.getDescription())
                .teacher(teacher)
                .durationMinutes(request.getDurationMinutes() != null ? request.getDurationMinutes() : 60)
                .status(request.getStatus() != null ? request.getStatus() : "DRAFT")
                .examType(examType)
                .maxAttempts(resolveMaxAttempts(examType, request.getMaxAttempts()))
                .build();
        exam.setAllowedClasses(resolveAllowedClassesForWrite(request.getAllowedClassIds()));

        exam = examRepository.save(exam);
        assertReadyToPublishIfActive(exam);

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
        if (request.getExamType() != null && !request.getExamType().isBlank()) {
            exam.setExamType(parseExamType(request.getExamType()));
        }
        if (request.getMaxAttempts() != null || (request.getExamType() != null && !request.getExamType().isBlank())) {
            exam.setMaxAttempts(resolveMaxAttempts(exam.getExamType(), request.getMaxAttempts()));
        }
        if (request.getAllowedClassIds() != null) {
            exam.setAllowedClasses(resolveAllowedClassesForWrite(request.getAllowedClassIds()));
        }

        assertReadyToPublishIfActive(exam);
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
        if (request.getExamType() != null && !request.getExamType().isBlank()) {
            exam.setExamType(parseExamType(request.getExamType()));
        }
        if (request.getMaxAttempts() != null) {
            exam.setMaxAttempts(resolveMaxAttempts(exam.getExamType(), request.getMaxAttempts()));
        }
        if (request.getAllowedClassIds() != null) {
            exam.setAllowedClasses(resolveAllowedClassesForWrite(request.getAllowedClassIds()));
        }

        assertReadyToPublishIfActive(exam);
        exam = examRepository.save(exam);
        return toResponseWithSections(exam);
    }

    // ─── DELETE ───────────────────────────────────────────────────────────────

    @Transactional
    public void delete(Integer id) {
        Exam exam = examRepository.findById(id)
                .orElseThrow(() -> new NotFoundException("Exam", id));

        assertOwnerOrAdmin(exam);
        List<Submission> submissions = submissionRepository.findByExam(exam);
        for (Submission submission : submissions) {
            List<Answer> answers = answerRepository.findBySubmission(submission);
            if (!answers.isEmpty()) {
                feedbackRepository.deleteByAnswerIn(answers);
                aiResultRepository.deleteByAnswerIn(answers);
            }
            for (Answer answer : answers) {
                speakingFileStorage.deleteIfExists(answer.getSpeakingAudioUrl());
            }
        }
        if (!submissions.isEmpty()) {
            // Delete FK-dependent child rows before submissions
            submissionSuspiciousEventRepository.deleteBySubmissionIn(submissions);
            scoreRepository.deleteBySubmissionIn(submissions);
            submissionRepository.deleteByExam(exam);
        }
        List<ExamAttempt> attempts = examAttemptRepository.findByExam(exam);
        if (!attempts.isEmpty()) {
            examAttemptRepository.deleteAllInBatch(attempts);
        }
        examRepository.delete(exam);
        log.info("Exam deleted with cascade cleanup: examId={}, submissions={}, attempts={}",
                exam.getId(), submissions.size(), attempts.size());
    }

    // ─── SECTIONS (teacher / admin — same ownership rules as exam) ───────────

    @Transactional(readOnly = true)
    public List<ExamSectionSummaryResponse> listSections(Integer examId) {
        Exam exam = examRepository.findById(examId)
                .orElseThrow(() -> new NotFoundException("Exam", examId));
        assertOwnerOrAdmin(exam);
        return exam.getSections().stream()
                .sorted((a, b) -> Integer.compare(
                        a.getOrderIndex() != null ? a.getOrderIndex() : 0,
                        b.getOrderIndex() != null ? b.getOrderIndex() : 0))
                .map(this::toSectionSummary)
                .collect(Collectors.toList());
    }

    @Transactional
    public ExamSectionSummaryResponse createSection(Integer examId, ExamSectionRequest request) {
        Exam exam = examRepository.findById(examId)
                .orElseThrow(() -> new NotFoundException("Exam", examId));
        assertOwnerOrAdmin(exam);

        List<ExamSection> existing = examSectionRepository.findByExamOrderByOrderIndex(exam);
        int maxOrder = existing.stream()
                .mapToInt(s -> s.getOrderIndex() != null ? s.getOrderIndex() : 0)
                .max()
                .orElse(-1);
        int order = request.getOrderIndex() != null ? request.getOrderIndex() : maxOrder + 1;

        ExamSectionType sectionType = parseSectionType(request.getSectionType());
        ExamSection section = ExamSection.builder()
                .exam(exam)
                .name(request.getName().trim())
                .sectionType(sectionType)
                .orderIndex(order)
                .build();
        section = examSectionRepository.save(section);
        exam.getSections().add(section);

        return ExamSectionSummaryResponse.builder()
                .id(section.getId())
                .name(section.getName())
                .sectionType(sectionType.name())
                .orderIndex(section.getOrderIndex())
                .questionCount(0)
                .build();
    }

    @Transactional
    public ExamSectionSummaryResponse updateSection(Integer examId, Integer sectionId, ExamSectionUpdateRequest request) {
        Exam exam = examRepository.findById(examId)
                .orElseThrow(() -> new NotFoundException("Exam", examId));
        assertOwnerOrAdmin(exam);

        ExamSection section = examSectionRepository.findById(sectionId)
                .orElseThrow(() -> new NotFoundException("ExamSection", sectionId));
        if (!section.getExam().getId().equals(examId)) {
            throw new BadRequestException("Section does not belong to this exam");
        }

        boolean touched = false;
        if (request.getName() != null) {
            if (request.getName().isBlank()) {
                throw new BadRequestException("Section name cannot be empty");
            }
            section.setName(request.getName().trim());
            touched = true;
        }
        if (request.getOrderIndex() != null) {
            section.setOrderIndex(request.getOrderIndex());
            touched = true;
        }
        if (request.getSectionType() != null && !request.getSectionType().isBlank()) {
            section.setSectionType(parseSectionType(request.getSectionType()));
            touched = true;
        }
        if (!touched) {
            throw new BadRequestException("Provide name, orderIndex, and/or sectionType to update");
        }

        section = examSectionRepository.save(section);
        return toSectionSummary(section);
    }

    @Transactional
    public void deleteSection(Integer examId, Integer sectionId) {
        Exam exam = examRepository.findById(examId)
                .orElseThrow(() -> new NotFoundException("Exam", examId));
        assertOwnerOrAdmin(exam);

        ExamSection section = examSectionRepository.findById(sectionId)
                .orElseThrow(() -> new NotFoundException("ExamSection", sectionId));
        if (!section.getExam().getId().equals(examId)) {
            throw new BadRequestException("Section does not belong to this exam");
        }

        if (section.getQuestions() != null && !section.getQuestions().isEmpty()) {
            throw new BadRequestException("Remove or move questions before deleting this section");
        }

        exam.getSections().remove(section);
        examSectionRepository.delete(section);
    }

    // ─── PRIVATE HELPERS ─────────────────────────────────────────────────────

    private Teacher resolveCurrentTeacher() {
        Integer userId = SecurityUtils.getCurrentUserId();

        User user = userRepository.findById(userId)
                .orElseThrow(() -> new UnauthorizedException("Authenticated user not found in database"));

        return teacherRepository.findFirstByUser(user)
                .orElseThrow(() -> new BadRequestException(
                        "Current user does not have a teacher profile. " +
                                "Only teachers can create exams."));
    }

    private ExamSectionType parseSectionType(String raw) {
        try {
            return ExamSectionType.fromString(raw);
        } catch (IllegalArgumentException e) {
            throw new BadRequestException("Invalid sectionType. Use READING, LISTENING, WRITING, or SPEAKING.");
        }
    }

    private static ExamType parseExamType(String raw) {
        if (raw == null || raw.isBlank()) {
            return ExamType.PRACTICE;
        }
        try {
            return ExamType.fromString(raw);
        } catch (IllegalArgumentException e) {
            throw new BadRequestException("Invalid examType. Use OFFICIAL or PRACTICE.");
        }
    }

    private Integer resolveMaxAttempts(ExamType examType, Integer requestedMaxAttempts) {
        if (requestedMaxAttempts != null && requestedMaxAttempts < 1) {
            throw new BadRequestException("maxAttempts must be at least 1 when provided");
        }
        if (requestedMaxAttempts != null) {
            return requestedMaxAttempts;
        }
        if (examType == ExamType.OFFICIAL) {
            return 1;
        }
        return null;
    }

    private void assertReadyToPublishIfActive(Exam exam) {
        if (!"ACTIVE".equalsIgnoreCase(exam.getStatus())) {
            return;
        }
        List<ExamSection> sections = exam.getSections() != null ? exam.getSections() : List.of();
        if (sections.isEmpty()) {
            throw new BadRequestException("Add at least one section before publishing this exam");
        }
        List<String> emptySections = sections.stream()
                .filter(section -> section.getQuestions() == null || section.getQuestions().isEmpty())
                .map(ExamSection::getName)
                .toList();
        if (!emptySections.isEmpty()) {
            throw new BadRequestException("Add at least one question to every section before publishing: "
                    + String.join(", ", emptySections));
        }
    }

    private List<ClassEntity> resolveAllowedClassesForWrite(List<Integer> allowedClassIds) {
        if (allowedClassIds == null) {
            return new ArrayList<>();
        }
        if (allowedClassIds.isEmpty()) {
            return new ArrayList<>();
        }

        Set<Integer> dedupedIds = new LinkedHashSet<>(allowedClassIds);
        List<ClassEntity> classes = classRepository.findAllById(dedupedIds);
        if (classes.size() != dedupedIds.size()) {
            throw new BadRequestException("One or more allowedClassIds do not exist");
        }

        if (SecurityUtils.hasRole("TEACHER")) {
            Integer teacherUserId = SecurityUtils.getCurrentUserId();
            boolean invalidOwnership = classes.stream()
                    .anyMatch(c -> c.getTeacher() == null
                            || c.getTeacher().getUser() == null
                            || !teacherUserId.equals(c.getTeacher().getUser().getId()));
            if (invalidOwnership) {
                throw new ForbiddenException("You can only assign classes that you own");
            }
        }

        return new ArrayList<>(classes);
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
        return toResponse(exam, null);
    }

    /**
     * @param canManage when non-null, sets {@link ExamResponse#setCanManage(Boolean)} (teacher list).
     */
    private ExamResponse toResponse(Exam exam, Boolean canManage) {
        ExamResponse.ExamResponseBuilder b = ExamResponse.builder()
                .id(exam.getId())
                .title(exam.getTitle())
                .description(exam.getDescription())
                .teacherId(exam.getTeacher().getId())
                .teacherName(exam.getTeacher().getUser().getFullName())
                .durationMinutes(exam.getDurationMinutes())
                .status(exam.getStatus())
                .examType(exam.getExamType() != null ? exam.getExamType().name() : ExamType.PRACTICE.name())
                .maxAttempts(exam.getMaxAttempts())
                .createdAt(exam.getCreatedAt());
        if (Hibernate.isInitialized(exam.getSections())) {
            b.sectionCount(exam.getSections() != null ? exam.getSections().size() : 0);
            b.questionCount(questionCount(exam));
        }
        if (Hibernate.isInitialized(exam.getAllowedClasses())) {
            b.allowedClasses(exam.getAllowedClasses().stream()
                    .sorted(Comparator.comparing(ClassEntity::getName, Comparator.nullsLast(String::compareToIgnoreCase)))
                    .map(c -> com.ai.englishsystem.exam.dto.ExamAllowedClassResponse.builder()
                            .id(c.getId())
                            .name(c.getName())
                            .build())
                    .collect(Collectors.toList()));
        }
        if (canManage != null) {
            b.canManage(canManage);
        }
        return b.build();
    }

    private ExamResponse toResponseWithSections(Exam exam) {
        initializeDetailAssociations(exam);
        ExamResponse response = toResponse(exam);
        List<ExamSectionResponse> sections = exam.getSections().stream()
                .sorted((a, b) -> Integer.compare(
                        a.getOrderIndex() != null ? a.getOrderIndex() : 0,
                        b.getOrderIndex() != null ? b.getOrderIndex() : 0))
                .map(s -> ExamSectionResponse.builder()
                        .id(s.getId())
                        .name(s.getName())
                        .sectionType(s.getSectionType() != null ? s.getSectionType().name() : ExamSectionType.READING.name())
                        .orderIndex(s.getOrderIndex())
                        .questions(s.getQuestions() != null
                                ? s.getQuestions().stream()
                                .map(q -> QuestionResponse.builder()
                                        .id(q.getId())
                                        .sectionId(s.getId())
                                        .sectionName(s.getName())
                                        .sectionType(s.getSectionType() != null ? s.getSectionType().name() : null)
                                        .examId(exam.getId())
                                        .examTitle(exam.getTitle())
                                        .questionText(q.getQuestionText())
                                        .questionType(q.getQuestionType())
                                        .listeningAudioUrl(q.getListeningAudioUrl())
                                        .transcript(q.getTranscript())
                                        .points(q.getPoints())
                                        .minWords(q.getMinWords())
                                        .maxWords(q.getMaxWords())
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

    private ExamSectionSummaryResponse toSectionSummary(ExamSection s) {
        return ExamSectionSummaryResponse.builder()
                .id(s.getId())
                .name(s.getName())
                .sectionType(s.getSectionType() != null ? s.getSectionType().name() : ExamSectionType.READING.name())
                .orderIndex(s.getOrderIndex())
                .questionCount(s.getQuestions() != null ? s.getQuestions().size() : 0)
                .build();
    }

    private void initializeListResponseAssociations(List<Exam> exams) {
        exams.forEach(exam -> {
            Hibernate.initialize(exam.getSections());
            for (ExamSection section : exam.getSections()) {
                Hibernate.initialize(section.getQuestions());
            }
            Hibernate.initialize(exam.getAllowedClasses());
        });
    }

    private int questionCount(Exam exam) {
        if (exam.getSections() == null) {
            return 0;
        }
        return exam.getSections().stream()
                .mapToInt(section -> section.getQuestions() != null ? section.getQuestions().size() : 0)
                .sum();
    }

    private void initializeDetailAssociations(Exam exam) {
        Hibernate.initialize(exam.getAllowedClasses());
        Hibernate.initialize(exam.getSections());
        for (ExamSection section : exam.getSections()) {
            Hibernate.initialize(section.getQuestions());
            for (var question : section.getQuestions()) {
                Hibernate.initialize(question.getOptions());
            }
        }
    }
}
