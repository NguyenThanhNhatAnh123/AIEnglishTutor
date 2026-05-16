package com.ai.englishsystem.ai.service;

import com.ai.englishsystem.ai.dto.PaperOcrQuestionDraft;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.List;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

@Component
public class PaperOcrParser {

    private static final Pattern QUESTION_START = Pattern.compile(
            "^(?:(?:question|q)\\s*)?(\\d{1,3})[\\).:-]\\s*(.*)$",
            Pattern.CASE_INSENSITIVE
    );
    private static final Pattern OPTION_MARKER = Pattern.compile("(?i)(^|\\s)([A-D])\\s*[\\).:]\\s+");

    public List<PaperOcrQuestionDraft> parse(String extractedText) {
        List<String> lines = normalizeLines(extractedText);
        List<PaperOcrQuestionDraft> drafts = new ArrayList<>();
        Draft current = null;

        for (String line : lines) {
            Matcher questionMatcher = QUESTION_START.matcher(line);
            if (questionMatcher.matches()) {
                Draft next = new Draft(parseInt(questionMatcher.group(1)));
                String rest = questionMatcher.group(2) == null ? "" : questionMatcher.group(2).trim();
                if (hasOptionMarker(rest)) {
                    applyOptionLine(next, rest);
                } else if (!rest.isBlank()) {
                    next.questionLines.add(rest);
                }
                if (current != null) {
                    addIfUseful(drafts, current);
                }
                current = next;
                continue;
            }

            if (current == null) {
                current = new Draft(null);
            }

            if (hasOptionMarker(line)) {
                applyOptionLine(current, line);
            } else if (!current.choices.isEmpty()) {
                int last = current.choices.size() - 1;
                current.choices.set(last, (current.choices.get(last) + " " + line).trim());
            } else {
                current.questionLines.add(line);
            }
        }

        if (current != null) {
            addIfUseful(drafts, current);
        }
        return drafts;
    }

    private static List<String> normalizeLines(String raw) {
        if (raw == null) {
            return List.of();
        }
        return raw.replace("\r", "")
                .lines()
                .map(String::trim)
                .map(PaperOcrParser::stripNoise)
                .filter(s -> !s.isBlank())
                .collect(Collectors.toList());
    }

    private static String stripNoise(String line) {
        return line.replaceAll("\\s+", " ")
                .replace('\u2022', '-')
                .trim();
    }

    private static boolean hasOptionMarker(String line) {
        return line != null && OPTION_MARKER.matcher(line).find();
    }

    private static void applyOptionLine(Draft draft, String line) {
        Matcher matcher = OPTION_MARKER.matcher(line);
        List<Marker> markers = new ArrayList<>();
        while (matcher.find()) {
            markers.add(new Marker(matcher.start(), matcher.end(), matcher.group(2).toUpperCase()));
        }
        if (markers.isEmpty()) {
            draft.questionLines.add(line);
            return;
        }

        String prefix = line.substring(0, markers.get(0).start()).trim();
        if (!prefix.isBlank()) {
            draft.questionLines.add(prefix);
        }

        for (int i = 0; i < markers.size(); i++) {
            Marker marker = markers.get(i);
            int end = i + 1 < markers.size() ? markers.get(i + 1).start() : line.length();
            String option = line.substring(marker.end(), end).trim();
            if (!option.isBlank()) {
                draft.choices.add(option);
            }
        }
    }

    private static void addIfUseful(List<PaperOcrQuestionDraft> drafts, Draft draft) {
        String question = String.join(" ", draft.questionLines).trim();
        List<String> choices = draft.choices.stream()
                .map(String::trim)
                .filter(s -> !s.isBlank())
                .collect(Collectors.toList());
        if (question.isBlank() && choices.isEmpty()) {
            return;
        }
        String raw = question;
        if (!choices.isEmpty()) {
            raw = raw + "\n" + choices.stream()
                    .map(c -> "- " + c)
                    .collect(Collectors.joining("\n"));
        }
        drafts.add(PaperOcrQuestionDraft.builder()
                .questionNumber(draft.questionNumber)
                .questionText(question)
                .choices(choices)
                .correctChoiceIndex(0)
                .rawText(raw.trim())
                .build());
    }

    private static Integer parseInt(String value) {
        try {
            return value == null ? null : Integer.parseInt(value);
        } catch (NumberFormatException ignored) {
            return null;
        }
    }

    private static final class Draft {
        private final Integer questionNumber;
        private final List<String> questionLines = new ArrayList<>();
        private final List<String> choices = new ArrayList<>();

        private Draft(Integer questionNumber) {
            this.questionNumber = questionNumber;
        }
    }

    private record Marker(int start, int end, String label) {}
}
