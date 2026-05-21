package com.ai.englishsystem.media;

import com.ai.englishsystem.common.exception.BadRequestException;
import com.ai.englishsystem.media.repository.MediaFileRepository;
import com.ai.englishsystem.media.service.MediaService;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.util.ReflectionTestUtils;

import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;

class MediaServiceValidationTest {

    @TempDir
    Path uploadDir;

    @Test
    void rejectsSpoofedTeacherAudioUploadAndDeletesPartialFile() throws Exception {
        MediaFileRepository repository = mock(MediaFileRepository.class);
        MediaService service = new MediaService(repository);
        ReflectionTestUtils.setField(service, "uploadDir", uploadDir.toString());

        MockMultipartFile spoofed = new MockMultipartFile(
                "file",
                "lesson.mp3",
                "audio/mpeg",
                "this is not an mp3 file at all".getBytes(StandardCharsets.UTF_8)
        );

        assertThatThrownBy(() -> service.uploadAudio(spoofed))
                .isInstanceOf(BadRequestException.class)
                .hasMessageContaining("Unrecognized audio format");

        verify(repository, never()).save(any());
        Path listeningDir = uploadDir.resolve("audio").resolve("listening");
        if (Files.exists(listeningDir)) {
            try (var files = Files.list(listeningDir)) {
                assertThat(files.toList()).isEmpty();
            }
        }
    }

    @Test
    void acceptsMp3MagicEvenWhenOriginalFilenameHasUnsafeExtension() {
        MediaFileRepository repository = mock(MediaFileRepository.class);
        MediaService service = new MediaService(repository);
        ReflectionTestUtils.setField(service, "uploadDir", uploadDir.toString());

        byte[] mp3Like = new byte[] {
                'I', 'D', '3', 4, 0, 0, 0, 0, 0, 10,
                0, 0, 0, 0, 0, 0, 0, 0, 0, 0
        };
        MockMultipartFile file = new MockMultipartFile(
                "file",
                "payload.php",
                "audio/mpeg",
                mp3Like
        );

        String url = service.uploadAudio(file);

        assertThat(url).startsWith("/uploads/audio/listening/");
        assertThat(url).endsWith(".mp3");
        verify(repository).save(any());
    }
}
