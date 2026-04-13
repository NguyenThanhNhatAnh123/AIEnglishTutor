package com.ai.englishsystem.exam.service;

import com.ai.englishsystem.ai.dto.SpeakingScoreRequest;
import com.ai.englishsystem.ai.dto.WritingScoreRequest;
import com.ai.englishsystem.ai.service.AiScoringService;
import com.ai.englishsystem.common.exception.BadRequestException;
import com.ai.englishsystem.common.exception.ForbiddenException;
import com.ai.englishsystem.common.exception.NotFoundException;
import com.ai.englishsystem.common.util.SecurityUtils;
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
import com.ai.englishsystem.submission.dto.SubmissionResponse;
import com.ai.englishsystem.submission.entity.Answer;
import com.ai.englishsystem.submission.entity.Submission;
import com.ai.englishsystem.submission.entity.SubmissionStatus;
import com.ai.englishsystem.submission.repository.AnswerRepository;
import com.ai.englishsystem.submission.repository.SubmissionRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.List;
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

    @Transactional
    public StudentSubmitExamResponse submitExam(Integer submissionId) {
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

        SubmissionStatus finalStatus = pastDeadline ? SubmissionStatus.AUTO_SUBMITTED : SubmissionStatus.SUBMITTED;
        submission.setSubmitTime(now);
        submission.setStatus(finalStatus);
        submission = submissionRepository.save(submission);

        if (submission.getExamAttempt() != null) {
            ExamAttempt attempt = submission.getExamAttempt();
            attempt.setEndTime(now);
            examAttemptRepository.save(attempt);
        }

        Submission finalSubmission = submission;
        Exam exam = examRepository.findById(submission.getExam().getId())
                .orElseThrow(() -> new NotFoundException("Exam", finalSubmission.getExam().getId()));
        List<Answer> answers = answerRepository.findBySubmissionFetchQuestion(submission);

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

        log.info("Graded submission {} status {} totalScore {}", submissionId, finalStatus, totalScore);

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
        if (!"ACTIVE".equals(exam.getStatus()) && !"IN_PROGRESS".equals(exam.getStatus())) {
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
                .audioUrl(q.getAudioUrl())
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
                if (a == null || a.getAudioUrl() == null || a.getAudioUrl().isBlank()) {
                    parts.add(0f);
                    continue;
                }
                try {
                    var ai = aiScoringService.scoreSpeaking(SpeakingScoreRequest.builder()
                            .answerId(a.getId())
                            .audioUrl(a.getAudioUrl())
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
}
