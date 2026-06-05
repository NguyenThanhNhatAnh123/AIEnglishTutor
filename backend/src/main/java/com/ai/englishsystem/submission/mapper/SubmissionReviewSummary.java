package com.ai.englishsystem.submission.mapper;

public record SubmissionReviewSummary(
        int writingTotal,
        int writingPublished,
        int speakingTotal,
        int speakingPublished
) {
    public static SubmissionReviewSummary empty() {
        return new SubmissionReviewSummary(0, 0, 0, 0);
    }

    public boolean allSubjectivePublished() {
        return isPublished(writingTotal, writingPublished) && isPublished(speakingTotal, speakingPublished);
    }

    public String writingStatus() {
        return status(writingTotal, writingPublished);
    }

    public String speakingStatus() {
        return status(speakingTotal, speakingPublished);
    }

    public String subjectiveStatus() {
        int total = writingTotal + speakingTotal;
        int published = writingPublished + speakingPublished;
        return status(total, published);
    }

    private static boolean isPublished(int total, int published) {
        return total == 0 || published == total;
    }

    private static String status(int total, int published) {
        if (total == 0) {
            return "NOT_REQUIRED";
        }
        return published == total ? "PUBLISHED" : "PENDING";
    }
}
