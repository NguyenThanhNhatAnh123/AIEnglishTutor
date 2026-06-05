package com.ai.englishsystem.exam.service;

import com.ai.englishsystem.common.exception.BadRequestException;
import com.ai.englishsystem.common.exception.ForbiddenException;
import com.ai.englishsystem.common.exception.NotFoundException;
import com.ai.englishsystem.common.exception.UnauthorizedException;
import com.ai.englishsystem.common.util.SecurityUtils;
import com.ai.englishsystem.classmodule.dto.ClassSummaryRow;
import com.ai.englishsystem.exam.dto.ExamAllowedClassRow;
import com.ai.englishsystem.exam.dto.ExamRequest;
import com.ai.englishsystem.exam.dto.ExamResponse;
import com.ai.englishsystem.exam.dto.ExamSectionRequest;
import com.ai.englishsystem.exam.dto.ExamSectionResponse;
import com.ai.englishsystem.exam.dto.ExamSectionSummaryResponse;
import com.ai.englishsystem.exam.dto.ExamWorkspaceResponse;
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
import com.ai.englishsystem.teacher.dto.TeacherResponse;
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
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
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
     * Admins see all exams. Teachers see only exams they own.
     * Students hitting this endpoint get ACTIVE-only (prefer /api/student/exams).
     */
    @Transactional(readOnly = true)
    public List<ExamResponse> findAll() {
        if (SecurityUtils.hasRole("ADMIN")) {
            return toListResponses(examRepository.findDashboardRowsForAdmin());
        }
        if (SecurityUtils.hasRole("TEACHER")) {
            Teacher teacher = resolveCurrentTeacher();
            return toListResponses(examRepository.findDashboardRowsForTeacher(teacher.getId()));
        }
        List<Exam> exams = examRepository.findByStatusWithTeacher("ACTIVE");
        return exams.stream()
                .sorted(byCreatedDesc())
                .map(this::toResponse)
                .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public ExamWorkspaceResponse workspace() {
        List<ExamResponse> exams;
        List<ClassSummaryRow> classRows;
        List<TeacherResponse> teachers;
        if (SecurityUtils.hasRole("ADMIN")) {
            exams = toListResponses(examRepository.findDashboardRowsForAdmin());
            classRows = classRepository.findSummaryRowsOrderByIdDesc();
            teachers = teacherRepository.findAll().stream().map(this::toTeacherOption).toList();
        } else if (SecurityUtils.hasRole("TEACHER")) {
            Teacher teacher = resolveCurrentTeacher();
            exams = toListResponses(examRepository.findDashboardRowsForTeacher(teacher.getId()));
            classRows = classRepository.findSummaryRowsByTeacherUserIdOrderByIdDesc(SecurityUtils.getCurrentUserId());
            teachers = List.of(toTeacherOption(teacher));
        } else {
            throw new ForbiddenException("Access denied");
        }

        return ExamWorkspaceResponse.builder()
                .exams(exams)
                .classes(classRows.stream().map(ClassSummaryRow::toResponse).toList())
                .teachers(teachers)
                .build();
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
        Teacher teacher = resolveTeacherForWrite(request.getTeacherId());

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
        exam.setAllowedClasses(resolveAllowedClassesForWrite(request.getAllowedClassIds(), teacher));
        syncSections(exam, request.getSections());

        exam = examRepository.save(exam);
        assertReadyToPublishIfActive(exam);

        return toResponseWithSections(exam);
    }

    // ─── UPDATE (full) ────────────────────────────────────────────────────────

    @Transactional
    public ExamResponse update(Integer id, ExamRequest request) {
        Exam exam = examRepository.findById(id)
                .orElseThrow(() -> new NotFoundException("Exam", id));

        assertOwnerOrAdmin(exam);
        Teacher teacher = resolveTeacherForWrite(request.getTeacherId());

        if (request.getTitle() != null && !request.getTitle().isBlank()) {
            exam.setTitle(request.getTitle());
        }
        exam.setDescription(request.getDescription());
        exam.setTeacher(teacher);
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
            exam.setAllowedClasses(resolveAllowedClassesForWrite(request.getAllowedClassIds(), teacher));
        }
        syncSections(exam, request.getSections());

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
        Teacher teacher = exam.getTeacher();
        if (request.getTeacherId() != null) {
            teacher = resolveTeacherForWrite(request.getTeacherId());
            exam.setTeacher(teacher);
        }

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
            exam.setAllowedClasses(resolveAllowedClassesForWrite(request.getAllowedClassIds(), teacher));
        }
        syncSections(exam, request.getSections());

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
        List<Answer> answers = List.of();
        if (!submissions.isEmpty()) {
            List<Integer> submissionIds = submissions.stream().map(Submission::getId).toList();
            answers = answerRepository.findBySubmission_IdIn(submissionIds);
        }
        if (!answers.isEmpty()) {
            feedbackRepository.deleteByAnswerIn(answers);
            aiResultRepository.deleteByAnswerIn(answers);
        }
        deleteSpeakingFilesAfterCommit(answers.stream()
                .map(Answer::getSpeakingAudioUrl)
                .filter(url -> url != null && !url.isBlank())
                .toList());
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
        return examSectionRepository.findSummaryRowsByExamId(examId).stream()
                .map(this::toSectionSummary)
                .collect(Collectors.toList());
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

    private Teacher resolveTeacherForWrite(Integer requestedTeacherId) {
        if (requestedTeacherId == null) {
            throw new BadRequestException("teacherId is required");
        }
        if (SecurityUtils.hasRole("ADMIN")) {
            return teacherRepository.findById(requestedTeacherId)
                    .orElseThrow(() -> new NotFoundException("Teacher", requestedTeacherId));
        }
        if (SecurityUtils.hasRole("TEACHER")) {
            Teacher current = resolveCurrentTeacher();
            if (!current.getId().equals(requestedTeacherId)) {
                throw new ForbiddenException("Teachers can only manage their own exams");
            }
            return current;
        }
        throw new ForbiddenException("Access denied");
    }

    private ExamSectionType parseSectionType(String raw) {
        try {
            return ExamSectionType.fromString(raw);
        } catch (IllegalArgumentException e) {
            throw new BadRequestException("Invalid sectionType. Use READING, LISTENING, WRITING, or SPEAKING.");
        }
    }

    private void syncSections(Exam exam, List<ExamSectionRequest> requestedSections) {
        if (requestedSections == null) {
            return;
        }
        if (exam.getSections() == null) {
            exam.setSections(new ArrayList<>());
        }
        Hibernate.initialize(exam.getSections());

        Map<Integer, ExamSection> existingById = exam.getSections().stream()
                .filter(section -> section.getId() != null)
                .collect(Collectors.toMap(ExamSection::getId, section -> section, (a, b) -> a, LinkedHashMap::new));
        Set<Integer> seenIds = new LinkedHashSet<>();
        Set<Integer> usedOrders = new LinkedHashSet<>();

        for (int i = 0; i < requestedSections.size(); i++) {
            ExamSectionRequest request = requestedSections.get(i);
            if (request == null) {
                throw new BadRequestException("Section payload cannot be null");
            }
            String name = request.getName() == null ? "" : request.getName().trim();
            if (name.isBlank()) {
                throw new BadRequestException("Section name cannot be empty");
            }
            ExamSectionType sectionType = parseSectionType(request.getSectionType());
            int orderIndex = request.getOrderIndex() != null ? request.getOrderIndex() : i;
            if (!usedOrders.add(orderIndex)) {
                throw new BadRequestException("Section orderIndex must be unique within an exam");
            }

            ExamSection section;
            if (request.getId() == null) {
                section = ExamSection.builder()
                        .exam(exam)
                        .questions(new ArrayList<>())
                        .build();
                exam.getSections().add(section);
            } else {
                if (!seenIds.add(request.getId())) {
                    throw new BadRequestException("Duplicate section id in request: " + request.getId());
                }
                section = existingById.get(request.getId());
                if (section == null) {
                    throw new BadRequestException("Section does not belong to this exam: " + request.getId());
                }
            }

            section.setName(name);
            section.setSectionType(sectionType);
            section.setOrderIndex(orderIndex);
        }

        List<ExamSection> removed = exam.getSections().stream()
                .filter(section -> section.getId() != null && !seenIds.contains(section.getId()))
                .toList();
        for (ExamSection section : removed) {
            if (examSectionRepository.countQuestionsBySectionId(section.getId()) > 0) {
                throw new BadRequestException("Cannot remove section with questions: " + section.getName());
            }
        }

        exam.getSections().removeAll(removed);
        exam.getSections().sort(Comparator.comparing(
                section -> section.getOrderIndex() != null ? section.getOrderIndex() : Integer.MAX_VALUE));
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
        if (exam.getAllowedClasses() == null || exam.getAllowedClasses().isEmpty()) {
            throw new BadRequestException("Select at least one allowed class before publishing this exam");
        }
        if (exam.getId() == null || examSectionRepository.countByExamId(exam.getId()) == 0) {
            throw new BadRequestException("Add at least one section before publishing this exam");
        }
        List<String> emptySections = examSectionRepository.findSectionNamesWithoutQuestions(exam.getId());
        if (!emptySections.isEmpty()) {
            throw new BadRequestException("Add at least one question to every section before publishing: "
                    + String.join(", ", emptySections));
        }
    }

    private List<ClassEntity> resolveAllowedClassesForWrite(List<Integer> allowedClassIds, Teacher examTeacher) {
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

        Integer ownerTeacherId = examTeacher != null ? examTeacher.getId() : null;
        boolean invalidOwnership = classes.stream()
                .anyMatch(c -> c.getTeacher() == null
                        || c.getTeacher().getId() == null
                        || !c.getTeacher().getId().equals(ownerTeacherId));
        if (invalidOwnership) {
            throw new ForbiddenException("You can only assign classes owned by the exam teacher");
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
                .questionCount((int) examSectionRepository.countQuestionsBySectionId(s.getId()))
                .build();
    }

    private ExamSectionSummaryResponse toSectionSummary(Object[] row) {
        ExamSectionType sectionType = row[2] instanceof ExamSectionType type ? type : ExamSectionType.READING;
        return ExamSectionSummaryResponse.builder()
                .id((Integer) row[0])
                .name((String) row[1])
                .sectionType(sectionType.name())
                .orderIndex((Integer) row[3])
                .questionCount(((Number) row[4]).intValue())
                .build();
    }

    private List<ExamResponse> toListResponses(List<com.ai.englishsystem.exam.dto.ExamDashboardRow> rows) {
        if (rows == null || rows.isEmpty()) {
            return List.of();
        }

        List<ExamResponse> responses = rows.stream()
                .sorted(Comparator.comparing(
                        com.ai.englishsystem.exam.dto.ExamDashboardRow::createdAt,
                        Comparator.nullsLast(Comparator.reverseOrder())))
                .map(com.ai.englishsystem.exam.dto.ExamDashboardRow::toResponse)
                .toList();

        Map<Integer, List<com.ai.englishsystem.exam.dto.ExamAllowedClassResponse>> classesByExamId =
                new LinkedHashMap<>();
        responses.forEach(response -> classesByExamId.put(response.getId(), new ArrayList<>()));

        List<Integer> examIds = responses.stream().map(ExamResponse::getId).toList();
        for (ExamAllowedClassRow row : examRepository.findAllowedClassRowsByExamIds(examIds)) {
            classesByExamId.computeIfAbsent(row.examId(), ignored -> new ArrayList<>())
                    .add(row.toResponse());
        }
        responses.forEach(response -> response.setAllowedClasses(classesByExamId.getOrDefault(response.getId(), List.of())));
        return responses;
    }

    private void deleteSpeakingFilesAfterCommit(List<String> urls) {
        if (urls == null || urls.isEmpty()) {
            return;
        }
        Runnable deleteFiles = () -> urls.forEach(speakingFileStorage::deleteIfExists);
        if (!TransactionSynchronizationManager.isSynchronizationActive()) {
            deleteFiles.run();
            return;
        }
        TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
            @Override
            public void afterCommit() {
                deleteFiles.run();
            }
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

    private TeacherResponse toTeacherOption(Teacher teacher) {
        var user = teacher.getUser();
        return TeacherResponse.builder()
                .id(teacher.getId())
                .userId(user != null ? user.getId() : null)
                .teacherCode(teacher.getTeacherCode())
                .fullName(user != null ? user.getFullName() : null)
                .email(user != null ? user.getEmail() : null)
                .department(teacher.getDepartment())
                .createdAt(teacher.getCreatedAt())
                .build();
    }
}
