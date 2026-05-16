package com.ai.englishsystem.ai;

import com.ai.englishsystem.ai.service.PaperOcrParser;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class PaperOcrParserTest {

    private final PaperOcrParser parser = new PaperOcrParser();

    @Test
    void parsesNumberedQuestionsWithInlineChoices() {
        var drafts = parser.parse("""
                1. Choose the correct word. A. go B. goes C. going D. gone
                2) What does the speaker imply?
                A. She is tired
                B. She missed the bus
                C. She finished early
                D. She needs help
                """);

        assertThat(drafts).hasSize(2);
        assertThat(drafts.get(0).getQuestionNumber()).isEqualTo(1);
        assertThat(drafts.get(0).getQuestionText()).isEqualTo("Choose the correct word.");
        assertThat(drafts.get(0).getChoices()).containsExactly("go", "goes", "going", "gone");
        assertThat(drafts.get(1).getQuestionNumber()).isEqualTo(2);
        assertThat(drafts.get(1).getChoices()).containsExactly(
                "She is tired",
                "She missed the bus",
                "She finished early",
                "She needs help"
        );
    }

    @Test
    void keepsContinuationLinesWithPreviousOption() {
        var drafts = parser.parse("""
                Question 3: Which sentence is closest in meaning?
                A. She decided to leave
                after lunch.
                B. She refused the invitation.
                C. She arrived late.
                D. She stayed home.
                """);

        assertThat(drafts).hasSize(1);
        assertThat(drafts.get(0).getQuestionText()).isEqualTo("Which sentence is closest in meaning?");
        assertThat(drafts.get(0).getChoices().get(0)).isEqualTo("She decided to leave after lunch.");
    }
}
