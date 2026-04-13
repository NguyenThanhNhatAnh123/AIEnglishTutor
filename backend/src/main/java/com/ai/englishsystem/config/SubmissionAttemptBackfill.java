package com.ai.englishsystem.config;

import com.ai.englishsystem.exam.entity.ExamAttempt;
import com.ai.englishsystem.exam.repository.ExamAttemptRepository;
import com.ai.englishsystem.submission.entity.Submission;
import com.ai.englishsystem.submission.repository.SubmissionRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;

/**
 * Links legacy submissions to {@code exam_attempts} rows (attempt_id) so FK constraints can be enabled.
 */
@Component
@Order(5)
@RequiredArgsConstructor
@Slf4j
public class SubmissionAttemptBackfill implements ApplicationRunner {

    private final SubmissionRepository submissionRepository;
    private final ExamAttemptRepository examAttemptRepository;

    @Value("${app.data.backfill-submission-attempts:true}")
    private boolean enabled;

    @Override
    @Transactional
    public void run(ApplicationArguments args) {
        if (!enabled) {
            return;
        }
        List<Submission> orphans = submissionRepository.findByExamAttemptIsNull();
        if (orphans.isEmpty()) {
            return;
        }
        int n = 0;
        for (Submission s : orphans) {
            int attemptNo = examAttemptRepository.countByExam_IdAndStudent_Id(
                    s.getExam().getId(), s.getStudent().getId()) + 1;
            ExamAttempt attempt = ExamAttempt.builder()
                    .student(s.getStudent())
                    .exam(s.getExam())
                    .attemptNumber(attemptNo)
                    .startTime(s.getStartTime() != null ? s.getStartTime() : LocalDateTime.now())
                    .endTime(s.getSubmitTime())
                    .build();
            examAttemptRepository.save(attempt);
            s.setExamAttempt(attempt);
            submissionRepository.save(s);
            n++;
        }
        log.info("Backfilled exam_attempt link for {} submission(s)", n);
    }
}
