package com.ai.englishsystem.exam.service;

import com.ai.englishsystem.ai.dto.SpeakingScoreRequest;
import com.ai.englishsystem.ai.dto.WritingScoreRequest;
import com.ai.englishsystem.ai.service.AiScoringService;
import com.ai.englishsystem.common.exception.BadRequestException;
import com.ai.englishsystem.common.exception.ForbiddenException;
import com.ai.englishsystem.common.exception.NotFoundException;
import com.ai.englishsystem.common.util.SecurityUtils;
import com.ai.englishsystem.exam.dto.ExamResponse;
import com.ai.englishsystem.exam.dto.student.*;
import com.ai.englishsystem.exam.entity.Exam;
import com.ai.englishsystem.exam.entity.ExamAttempt;
import com.ai.englishsystem.exam.entity.ExamSection;
import com.ai.englishsystem.exam.entity.Question;
import com.ai.englishsystem.exam.repository.ExamAttemptRepository;
import com.ai.englishsystem.exam.repository.ExamRepository;
import com.ai.englishsystem.result.entity.Score;
import com.ai.englishsystem.result.repository.ScoreRepository;
import com.ai.englishsystem.student.entity.Student;
import com.ai.englishsystem.student.repository.StudentRepository;
import com.ai.englishsystem.submission.dto.StudentSubmitExamResponse;
import com.ai.englishsystem.submission.dto.SubmitExamRequest;
import com.ai.englishsystem.submission.dto.SubmissionResponse;
import com.ai.englishsystem.submission.entity.Answer;
import com.ai.englishsystem.submission.entity.Submission;
import com.ai.englishsystem.submission.entity.SubmissionSuspiciousEvent;
import com.ai.englishsystem.submission.entity.SubmissionStatus;
import com.ai.englishsystem.submission.entity.SuspiciousEventType;
import com.ai.englishsystem.submission.repository.AnswerRepository;
import com.ai.englishsystem.submission.repository.SubmissionRepository;
import com.ai.englishsystem.submission.repository.SubmissionSuspiciousEventRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Objects;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class StudentExamService {

    private final ExamRepository examRepository;
    private final ExamAttemptRepository examAttemptRepository;
    private final SubmissionRepository submissionRepository;
    private final AnswerRepository answerRepository;
    private final StudentRepository studentRepository;
    private final ScoreRepository scoreRepository;
    private final AiScoringService aiScoringService;
    private final SubmissionSuspiciousEventRepository submissionSuspiciousEventRepository;

    /**
     * Returns only ACTIVE exams for students - never exposes DRAFT/CLOSED.
     */
    @Transactional(readOnly = true)
    public List<ExamResponse> getActiveExams() {
        return examRepository.findByStatusWithTeacher("ACTIVE").stream()
                .map(exam -> ExamResponse.builder()
                        .id(exam.getId())
                        .title(exam.getTitle())
                        .description(exam.getDescription())
                        .teacherId(exam.getTeacher().getId())
                        .teacherName(exam.getTeacher().getUser().getFullName())
                        .durationMinutes(exam.getDurationMinutes())
                        .status(exam.getStatus())
                        .createdAt(exam.getCreatedAt())
                        .build())
                .collect(Collectors.toList());
    }

    @Transactional
    public SubmissionResponse startExam(Integer examId) {
        Student student = resolveCurrentStudent();
        Exam exam = examRepository.findById(examId)
                .orElseThrow(() -> new NotFoundException("Exam", examId));

        assertExamAvailable(exam);

        var existing = submissionRepository.findByExamAndStudentAndStatus(exam, student, SubmissionStatus.IN_PROGRESS);
        if (existing.isPresent()) {
            log.debug("Resuming in-progress submission {} for student {}", existing.get().getId(), student.getId());
            return toStartResponse(existing.get());
        }

        int attemptNo = examAttemptRepository.countByExam_IdAndStudent_Id(exam.getId(), student.getId()) + 1;
        LocalDateTime now = LocalDateTime.now();

        ExamAttempt attempt = ExamAttempt.builder()
                .student(student)
                .exam(exam)
                .attemptNumber(attemptNo)
                .startTime(now)
                .build();
        attempt = examAttemptRepository.save(attempt);

        Submission submission = Submission.builder()
                .exam(exam)
                .student(student)
                .examAttempt(attempt)
                .startTime(now)
                .status(SubmissionStatus.IN_PROGRESS)
                .build();
        submission = submissionRepository.save(submission);

        log.info("Started exam {} for student {}, submission {}, attempt {}", examId, student.getId(), submission.getId(), attempt.getId());
        return toStartResponse(submission);
    }

    @Transactional(readOnly = true)
    public StudentExamDetailResponse getExamForStudent(Integer examId) {
        resolveCurrentStudent();
        Exam exam = examRepository.findById(examId)
                .orElseThrow(() -> new NotFoundException("Exam", examId));
        assertExamAvailable(exam);
        return mapExamForStudent(exam);
    }

    private static final int MAX_CLIENT_OVER_SERVER_SEC = 60;
    private static final int MAX_SERVER_OVER_CLIENT_SEC = 300;
    private static final double MIN_REQUIRED_COMPLETION_RATIO = 0.5d;

    @Transactional
    public StudentSubmitExamResponse submitExam(Integer submissionId) {
        return submitExam(submissionId, (SubmitExamRequest) null);
    }

    @Transactional
    public StudentSubmitExamResponse submitExam(Integer submissionId, Integer clientTimeSpentSeconds) {
        return submitExam(submissionId, SubmitExamRequest.builder()
                .clientTimeSpentSeconds(clientTimeSpentSeconds)
                .build());
    }

    @Transactional
    public StudentSubmitExamResponse submitExam(Integer submissionId, SubmitExamRequest submitRequest) {
        Student student = resolveCurrentStudent();
        Submission submission = submissionRepository.findWithAssociationsById(submissionId)
                .orElseThrow(() -> new NotFoundException("Submission", submissionId));

        if (!submission.getStudent().getId().equals(student.getId())) {
            throw new ForbiddenException("Cannot submit another student's exam");
        }
        if (submission.getStatus() != SubmissionStatus.IN_PROGRESS) {
            throw new BadRequestException("Submission is not in progress");
        }

        LocalDateTime now = LocalDateTime.now();
        LocalDateTime deadline = resolveDeadline(submission);
        boolean pastDeadline = now.isAfter(deadline);
        Integer clientTimeSpentSeconds = submitRequest != null ? submitRequest.getClientTimeSpentSeconds() : null;

        Submission finalSubmission = submission;
        Exam exam = examRepository.findById(submission.getExam().getId())
                .orElseThrow(() -> new NotFoundException("Exam", finalSubmission.getExam().getId()));
        List<Answer> answers = answerRepository.findBySubmissionFetchQuestion(submission);
        CompletionStats completion = calculateCompletion(exam, answers);

        if (!pastDeadline && completion.totalQuestions() > 0
                && completion.completionRatio() < MIN_REQUIRED_COMPLETION_RATIO) {
            int required = (int) Math.ceil(completion.totalQuestions() * MIN_REQUIRED_COMPLETION_RATIO);
            String minimumCompletionMessage = "You must answer at least 50% of the questions before submitting ("
                    + completion.answeredQuestions() + "/" + completion.totalQuestions()
                    + "). Minimum required: " + required + " questions.";
            throw new BadRequestException(minimumCompletionMessage);








        }

        SubmissionStatus finalStatus = pastDeadline ? SubmissionStatus.AUTO_SUBMITTED : SubmissionStatus.SUBMITTED;
        submission.setSubmitTime(now);
        submission.setEndTime(now);
        submission.setAnsweredQuestions(completion.answeredQuestions());
        submission.setTotalQuestions(completion.totalQuestions());
        submission.setCompletionPercent(completion.completionPercent());

        long serverSecs = 0;
        if (submission.getStartTime() != null) {
            serverSecs = Duration.between(submission.getStartTime(), now).getSeconds();
        }
        submission.setDuration((int) Math.min(serverSecs, Integer.MAX_VALUE));
        submission.setClientReportedDuration(clientTimeSpentSeconds);
        if (clientTimeSpentSeconds != null) {
            if (clientTimeSpentSeconds < 0) {
                throw new BadRequestException("Invalid reported exam time");
            }
            if (clientTimeSpentSeconds > serverSecs + MAX_CLIENT_OVER_SERVER_SEC) {
                throw new BadRequestException("Reported time exceeds server session (possible tampering)");
            }
            if (serverSecs - clientTimeSpentSeconds > MAX_SERVER_OVER_CLIENT_SEC) {
                throw new BadRequestException("Reported time is far below server session (possible tampering)");
            }
        }
        applyClientAnalytics(submission, submitRequest);

        submission.setStatus(finalStatus);
        submission = submissionRepository.save(submission);
        persistSuspiciousEventSnapshot(submission);

        if (submission.getExamAttempt() != null) {
            ExamAttempt attempt = submission.getExamAttempt();
            attempt.setEndTime(now);
            examAttemptRepository.save(attempt);
        }

        float[] mc = scoreMcqAndListening(exam, answers);
        Float mcScore = mc[1] > 0 ? (mc[0] / mc[1]) * 100f : null;

        Float writingScore = scoreWritingSection(exam, answers);
        Float speakingScore = scoreSpeakingSection(exam, answers);

        float totalScore = combineScores(mcScore, writingScore, speakingScore);

        Submission finalSubmission1 = submission;
        Score score = scoreRepository.findFirstBySubmissionOrderByIdAsc(submission)
                .orElseGet(() -> Score.builder().submission(finalSubmission1).build());
        score.setMcScore(mcScore);
        score.setWritingScore(writingScore);
        score.setSpeakingScore(speakingScore);
        score.setTotalScore(totalScore);
        score.setGradedAt(now);
        scoreRepository.save(score);

        log.info("Graded submission {} status {} totalScore {} completion {}% suspicious {}",
                submissionId,
                finalStatus,
                totalScore,
                completion.completionPercent(),
                submission.getSuspiciousEventCount());

        return StudentSubmitExamResponse.builder()
                .submissionId(submission.getId())
                .examId(exam.getId())
                .studentId(student.getId())
                .status(finalStatus.name())
                .submitTime(submission.getSubmitTime())
                .mcScore(mcScore)
                .writingScore(writingScore)
                .speakingScore(speakingScore)
                .totalScore(totalScore)
                .build();
    }

    public LocalDateTime resolveDeadline(Submission submission) {
        if (submission.getExam() == null) {
            throw new NotFoundException("Exam not loaded for submission");
        }
        int durationMinutes = submission.getExam().getDurationMinutes() != null
                ? submission.getExam().getDurationMinutes()
                : 60;
        LocalDateTime start = submission.getStartTime();
        if (start == null) {
            return LocalDateTime.now().plusMinutes(durationMinutes);
        }
        return start.plusMinutes(durationMinutes);
    }

    public void assertWithinDeadline(Submission submission) {
        if (LocalDateTime.now().isAfter(resolveDeadline(submission))) {
            throw new BadRequestException("Exam time has expired");
        }
    }

    private Student resolveCurrentStudent() {
        Integer userId = SecurityUtils.getCurrentUserId();
        return studentRepository.findByUser_Id(userId)
                .orElseThrow(() -> new ForbiddenException("Student profile not found for current user"));
    }

    private void assertExamAvailable(Exam exam) {
        if (!"ACTIVE".equals(exam.getStatus())) {
            throw new BadRequestException("Exam is not available for taking");
        }
    }

    private SubmissionResponse toStartResponse(Submission s) {
        if (s.getExam() == null) {
            throw new NotFoundException("Exam not loaded for submission");
        }
        int dur = s.getExam().getDurationMinutes() != null ? s.getExam().getDurationMinutes() : 60;
        LocalDateTime effectiveStart = s.getStartTime() != null ? s.getStartTime() : LocalDateTime.now();
        LocalDateTime deadline = effectiveStart.plusMinutes(dur);
        long deadlineEpochMs = deadline.atZone(ZoneId.systemDefault()).toInstant().toEpochMilli();
        return SubmissionResponse.builder()
                .id(s.getId())
                .examId(s.getExam().getId())
                .studentId(s.getStudent().getId())
                .attemptId(s.getExamAttempt() != null ? s.getExamAttempt().getId() : null)
                .durationMinutes(dur)
                .deadlineAt(deadline)
                .deadlineEpochMs(deadlineEpochMs)
                .startTime(s.getStartTime())
                .submitTime(s.getSubmitTime())
                .status(s.getStatus().name())
                .build();
    }

    private StudentExamDetailResponse mapExamForStudent(Exam exam) {
        List<StudentExamSectionResponse> sections = sectionsOf(exam).stream()
                .sorted((a, b) -> Integer.compare(
                        a.getOrderIndex() != null ? a.getOrderIndex() : 0,
                        b.getOrderIndex() != null ? b.getOrderIndex() : 0))
                .map(this::mapSection)
                .collect(Collectors.toList());

        return StudentExamDetailResponse.builder()
                .id(exam.getId())
                .title(exam.getTitle())
                .description(exam.getDescription())
                .durationMinutes(exam.getDurationMinutes())
                .status(exam.getStatus())
                .createdAt(exam.getCreatedAt())
                .sections(sections)
                .build();
    }

    private StudentExamSectionResponse mapSection(ExamSection s) {
        List<StudentExamQuestionResponse> questions = s.getQuestions() == null ? List.of()
                : s.getQuestions().stream().map(this::mapQuestion).collect(Collectors.toList());
        return StudentExamSectionResponse.builder()
                .id(s.getId())
                .name(s.getName())
                .sectionType(s.getSectionType() != null ? s.getSectionType().name() : "READING")
                .orderIndex(s.getOrderIndex())
                .questions(questions)
                .build();
    }

    private StudentExamQuestionResponse mapQuestion(Question q) {
        List<StudentExamOptionResponse> options = q.getOptions() == null ? List.of()
                : q.getOptions().stream()
                .map(o -> StudentExamOptionResponse.builder()
                        .id(o.getId())
                        .optionText(o.getOptionText())
                        .build())
                .collect(Collectors.toList());

        if (q.getSection() == null) {
            throw new BadRequestException("Question " + q.getId() + " has no section");
        }
        return StudentExamQuestionResponse.builder()
                .id(q.getId())
                .sectionId(q.getSection().getId())
                .questionText(q.getQuestionText())
                .questionType(q.getQuestionType())
                .points(q.getPoints())
                .listeningAudioUrl(q.getListeningAudioUrl())
                .minWords(q.getMinWords())
                .maxWords(q.getMaxWords())
                .transcript(q.getTranscript())
                .createdAt(q.getCreatedAt())
                .options(options)
                .build();
    }

    /**
     * @return [earnedPoints, maxPoints] for MCQ + LISTENING
     */
    private static List<ExamSection> sectionsOf(Exam exam) {
        List<ExamSection> s = exam.getSections();
        return s != null ? s : List.of();
    }

    private static List<Question> questionsOf(ExamSection sec) {
        List<Question> q = sec.getQuestions();
        return q != null ? q : List.of();
    }

    private CompletionStats calculateCompletion(Exam exam, List<Answer> answers) {
        int total = 0;
        int answered = 0;
        for (ExamSection section : sectionsOf(exam)) {
            for (Question question : questionsOf(section)) {
                total++;
                if (isAnswered(question, findAnswer(answers, question.getId()))) {
                    answered++;
                }
            }
        }
        int percent = total <= 0 ? 0 : (int) Math.round((answered * 100d) / total);
        double ratio = total <= 0 ? 1d : answered / (double) total;
        return new CompletionStats(answered, total, percent, ratio);
    }

    private static boolean isAnswered(Question question, Answer answer) {
        if (question == null || answer == null) {
            return false;
        }
        String type = normalizeType(question.getQuestionType());
        return switch (type) {
            case "MULTIPLE_CHOICE", "LISTENING" -> answer.getSelectedOptionId() != null;
            case "WRITING" -> hasText(answer.getAnswerText());
            case "SPEAKING" -> hasText(answer.getSpeakingAudioUrl());
            default -> answer.getSelectedOptionId() != null
                    || hasText(answer.getAnswerText())
                    || hasText(answer.getSpeakingAudioUrl());
        };
    }

    private static boolean hasText(String value) {
        return value != null && !value.isBlank();
    }

    private void applyClientAnalytics(Submission submission, SubmitExamRequest submitRequest) {
        int tabSwitchCount = nonNegative(submitRequest != null ? submitRequest.getTabSwitchCount() : null);
        int focusLossCount = nonNegative(submitRequest != null ? submitRequest.getFocusLossCount() : null);
        int copyPasteCount = nonNegative(submitRequest != null ? submitRequest.getCopyPasteCount() : null);
        int suspiciousFromClient = nonNegative(submitRequest != null ? submitRequest.getSuspiciousEventCount() : null);
        int suspiciousBySum = tabSwitchCount + focusLossCount + copyPasteCount;
        int suspiciousEventCount = Math.max(suspiciousFromClient, suspiciousBySum);

        submission.setTabSwitchCount(tabSwitchCount);
        submission.setFocusLossCount(focusLossCount);
        submission.setCopyPasteCount(copyPasteCount);
        submission.setSuspiciousEventCount(suspiciousEventCount);
        submission.setDeviceType(normalizeDeviceType(submitRequest != null ? submitRequest.getDeviceType() : null));
        submission.setDeviceLabel(trimToLength(submitRequest != null ? submitRequest.getDeviceLabel() : null, 255));
    }

    private static int nonNegative(Integer value) {
        return value == null ? 0 : Math.max(0, value);
    }

    private static String normalizeDeviceType(String deviceType) {
        if (deviceType == null || deviceType.isBlank()) {
            return "UNKNOWN";
        }
        String normalized = deviceType.trim().toUpperCase(Locale.ROOT);
        return switch (normalized) {
            case "DESKTOP", "MOBILE", "TABLET" -> normalized;
            default -> "UNKNOWN";
        };
    }

    private static String trimToLength(String value, int maxLength) {
        if (value == null) {
            return null;
        }
        String trimmed = value.trim();
        if (trimmed.isEmpty()) {
            return null;
        }
        return trimmed.length() <= maxLength ? trimmed : trimmed.substring(0, maxLength);
    }

    private void persistSuspiciousEventSnapshot(Submission submission) {
        submissionSuspiciousEventRepository.deleteBySubmission(submission);
        saveSuspiciousEvent(submission, SuspiciousEventType.TAB_SWITCH, submission.getTabSwitchCount());
        saveSuspiciousEvent(submission, SuspiciousEventType.FOCUS_LOSS, submission.getFocusLossCount());
        saveSuspiciousEvent(submission, SuspiciousEventType.COPY_PASTE, submission.getCopyPasteCount());
    }

    private void saveSuspiciousEvent(Submission submission, SuspiciousEventType eventType, Integer count) {
        int normalized = nonNegative(count);
        if (normalized <= 0) {
            return;
        }
        submissionSuspiciousEventRepository.save(SubmissionSuspiciousEvent.builder()
                .submission(submission)
                .student(submission.getStudent())
                .eventType(eventType)
                .eventCount(normalized)
                .build());
    }

    private float[] scoreMcqAndListening(Exam exam, List<Answer> answers) {
        float earned = 0f;
        float max = 0f;
        for (ExamSection sec : sectionsOf(exam)) {
            for (Question q : questionsOf(sec)) {
                String type = normalizeType(q.getQuestionType());
                if (!isMcqOrListening(type)) {
                    continue;
                }
                int pts = q.getPoints() != null && q.getPoints() > 0 ? q.getPoints() : 1;
                max += pts;
                Answer a = findAnswer(answers, q.getId());
                if (a != null && a.getSelectedOptionId() != null && isCorrectOption(q, a.getSelectedOptionId())) {
                    earned += pts;
                }
            }
        }
        return new float[]{earned, max};
    }

    private Float scoreWritingSection(Exam exam, List<Answer> answers) {
        List<Float> parts = new ArrayList<>();
        for (ExamSection sec : sectionsOf(exam)) {
            for (Question q : questionsOf(sec)) {
                if (!"WRITING".equals(normalizeType(q.getQuestionType()))) {
                    continue;
                }
                Answer a = findAnswer(answers, q.getId());
                if (a == null || a.getAnswerText() == null || a.getAnswerText().isBlank()) {
                    parts.add(0f);
                    continue;
                }
                try {
                    var ai = aiScoringService.scoreWriting(WritingScoreRequest.builder()
                            .answerId(a.getId())
                            .essayText(a.getAnswerText())
                            .build());
                    parts.add(ai.getOverallScore() != null ? ai.getOverallScore() * 10f : 0f);
                } catch (Exception e) {
                    log.warn("Writing AI score failed for answer {}: {}", a.getId(), e.getMessage());
                    parts.add(0f);
                }
            }
        }
        return parts.isEmpty() ? null : average(parts);
    }

    private Float scoreSpeakingSection(Exam exam, List<Answer> answers) {
        List<Float> parts = new ArrayList<>();
        for (ExamSection sec : sectionsOf(exam)) {
            for (Question q : questionsOf(sec)) {
                if (!"SPEAKING".equals(normalizeType(q.getQuestionType()))) {
                    continue;
                }
                Answer a = findAnswer(answers, q.getId());
                String speakingRef = a != null ? a.getSpeakingAudioUrl() : null;
                if (a == null || speakingRef == null || speakingRef.isBlank()) {
                    parts.add(0f);
                    continue;
                }
                try {
                    var ai = aiScoringService.scoreSpeaking(SpeakingScoreRequest.builder()
                            .answerId(a.getId())
                            .audioUrl(speakingRef)
                            .build());
                    parts.add(ai.getOverallScore() != null ? ai.getOverallScore() * 10f : 0f);
                } catch (Exception e) {
                    log.warn("Speaking AI score failed for answer {}: {}", a.getId(), e.getMessage());
                    parts.add(0f);
                }
            }
        }
        return parts.isEmpty() ? null : average(parts);
    }

    private static float combineScores(Float mc, Float writing, Float speaking) {
        List<Float> parts = new ArrayList<>();
        if (mc != null) parts.add(mc);
        if (writing != null) parts.add(writing);
        if (speaking != null) parts.add(speaking);
        if (parts.isEmpty()) {
            return 0f;
        }
        double sum = parts.stream().mapToDouble(Float::doubleValue).sum();
        return (float) (sum / parts.size());
    }

    private static float average(List<Float> values) {
        double sum = values.stream().mapToDouble(Float::doubleValue).sum();
        return (float) (sum / values.size());
    }

    private static Answer findAnswer(List<Answer> answers, Integer questionId) {
        return answers.stream()
                .filter(a -> a.getQuestion() != null && questionId.equals(a.getQuestion().getId()))
                .findFirst()
                .orElse(null);
    }

    private static boolean isCorrectOption(Question q, Integer optionId) {
        if (q.getOptions() == null) {
            return false;
        }
        return q.getOptions().stream()
                .filter(o -> Objects.equals(o.getId(), optionId))
                .anyMatch(o -> Boolean.TRUE.equals(o.getIsCorrect()));
    }

    private static String normalizeType(String questionType) {
        return questionType == null ? "" : questionType.trim().toUpperCase();
    }

    private static boolean isMcqOrListening(String type) {
        return "MULTIPLE_CHOICE".equals(type) || "LISTENING".equals(type);
    }

    private static final class CompletionStats {
        private final int answeredQuestions;
        private final int totalQuestions;
        private final int completionPercent;
        private final double completionRatio;

        private CompletionStats(int answeredQuestions, int totalQuestions, int completionPercent, double completionRatio) {
            this.answeredQuestions = answeredQuestions;
            this.totalQuestions = totalQuestions;
            this.completionPercent = completionPercent;
            this.completionRatio = completionRatio;
        }

        private int answeredQuestions() {
            return answeredQuestions;
        }

        private int totalQuestions() {
            return totalQuestions;
        }

        private int completionPercent() {
            return completionPercent;
        }

        private double completionRatio() {
            return completionRatio;
        }
    }
}

