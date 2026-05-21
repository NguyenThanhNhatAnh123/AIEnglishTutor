package com.ai.englishsystem.config;

import org.junit.jupiter.api.Test;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import java.util.stream.Collectors;

import static org.assertj.core.api.Assertions.assertThat;

class FlywayRuntimePathGuardTest {

    @Test
    void backendRuntimeConfigPointsToSingleFlywayMigrationPath() throws IOException {
        Path applicationProperties = Path.of("src", "main", "resources", "application.properties");
        String content = Files.readString(applicationProperties, StandardCharsets.UTF_8);

        assertThat(content).contains("spring.flyway.locations=classpath:db/migration");
        assertThat(content).contains("spring.flyway.enabled=${APP_FLYWAY_ENABLED:true}");
        assertThat(content).contains("spring.flyway.repair=${APP_FLYWAY_REPAIR:false}");
        assertThat(content).contains("spring.jpa.hibernate.ddl-auto=${APP_JPA_DDL_AUTO:validate}");
    }

    @Test
    void documentedRuntimeEnvironmentVariablesAreWiredIntoSpringConfig() throws IOException {
        String app = Files.readString(Path.of("src", "main", "resources", "application.properties"), StandardCharsets.UTF_8);
        String prod = Files.readString(Path.of("src", "main", "resources", "application-prod.properties"), StandardCharsets.UTF_8);

        assertThat(app).contains("server.port=${APP_SERVER_PORT:8080}");
        assertThat(app).contains("app.ai.async.core-pool-size=${APP_AI_ASYNC_CORE:5}");
        assertThat(app).contains("app.ai.async.max-pool-size=${APP_AI_ASYNC_MAX:20}");
        assertThat(app).contains("app.ai.async.queue-capacity=${APP_AI_ASYNC_QUEUE:100}");

        assertThat(prod).contains("server.port=${APP_SERVER_PORT:8080}");
        assertThat(prod).contains("spring.flyway.enabled=${APP_FLYWAY_ENABLED:true}");
        assertThat(prod).contains("spring.flyway.repair=${APP_FLYWAY_REPAIR:false}");
    }

    @Test
    void flywayRuntimeDirectoryIsPresentAndLegacyDatabaseMirrorIsGone() throws IOException {
        Path runtimeMigrationDir = Path.of("src", "main", "resources", "db", "migration");
        assertThat(runtimeMigrationDir).exists().isDirectory();

        List<String> runtimeFiles = Files.list(runtimeMigrationDir)
                .filter(Files::isRegularFile)
                .map(path -> path.getFileName().toString())
                .sorted()
                .collect(Collectors.toList());

        assertThat(runtimeFiles).containsExactly(
                "V1__baseline_schema.sql",
                "V2__enforce_one_to_one_constraints.sql",
                "V3__writing_review_publish_flow.sql",
                "V4__speaking_review_transcript_fields.sql",
                "V5__exam_type.sql",
                "V6__exam_access_control_and_attempt_limit.sql",
                "V7__remove_loadtest_users.sql",
                "V8__production_performance_indexes.sql",
                "V9__unique_answer_per_submission_question.sql"
        );

        Path legacyMigrationDir = Path.of("..", "database", "migrations");
        if (Files.exists(legacyMigrationDir)) {
            try (var legacyFiles = Files.list(legacyMigrationDir)) {
                assertThat(legacyFiles.toList()).isEmpty();
            }
        }
        assertThat(Path.of("..", "database", "DataDBver2.0.sql")).doesNotExist();
    }
}
