package com.ai.englishsystem.media.audio;

import com.ai.englishsystem.common.exception.BadRequestException;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.TimeUnit;

/**
 * Normalizes all accepted uploads to MP3 via FFmpeg; reads duration via ffprobe.
 */
@Service
@Slf4j
public class FfmpegAudioService {

    @Value("${app.ffmpeg.binary:ffmpeg}")
    private String ffmpegBinary;

    @Value("${app.ffprobe.binary:ffprobe}")
    private String ffprobeBinary;

    /**
     * Encodes input to MP3 (libmp3lame). Overwrites {@code outputMp3} if present.
     *
     * @throws BadRequestException if transcoding fails or output file is empty/unreadable
     */
    public void transcodeToMp3(Path input, Path outputMp3) {
        List<String> cmd = new ArrayList<>();
        cmd.add(ffmpegBinary);
        cmd.add("-y");
        cmd.add("-i");
        cmd.add(input.toAbsolutePath().toString());
        cmd.add("-vn");
        cmd.add("-codec:a");
        cmd.add("libmp3lame");
        cmd.add("-q:a");
        cmd.add("4");
        cmd.add(outputMp3.toAbsolutePath().toString());
        runProcess(cmd, "ffmpeg transcode");

        // Files.size() throws IOException — must be caught
        try {
            if (!Files.exists(outputMp3) || Files.size(outputMp3) == 0) {
                throw new BadRequestException("FFmpeg produced no output; check server FFmpeg installation");
            }
        } catch (BadRequestException e) {
            throw e;
        } catch (IOException e) {
            throw new BadRequestException("Failed to verify FFmpeg output file: " + e.getMessage());
        }
    }

    /**
     * @return duration in whole seconds (rounded)
     */
    public int probeDurationSeconds(Path audioFile) {
        List<String> cmd = List.of(
                ffprobeBinary,
                "-v", "error",
                "-show_entries", "format=duration",
                "-of", "default=noprint_wrappers=1:nokey=1",
                audioFile.toAbsolutePath().toString()
        );
        String out = runProcessCapture(cmd, "ffprobe");
        try {
            double sec = Double.parseDouble(out.trim());
            return (int) Math.round(Math.max(0, sec));
        } catch (NumberFormatException e) {
            log.warn("ffprobe unparsable output: {}", out);
            return 0;
        }
    }

    private void runProcess(List<String> command, String label) {
        String err = runProcessCaptureStreams(command, label, false);
        if (err != null && !err.isBlank()) {
            log.debug("{} stderr: {}", label, err);
        }
    }

    private String runProcessCapture(List<String> command, String label) {
        return runProcessCaptureStreams(command, label, true);
    }

    private String runProcessCaptureStreams(List<String> command, String label, boolean captureStdout) {
        ProcessBuilder pb = new ProcessBuilder(command);
        pb.redirectErrorStream(false);
        try {
            Process p = pb.start();
            String stdout = "";
            if (captureStdout) {
                try (BufferedReader r = new BufferedReader(new InputStreamReader(p.getInputStream(), StandardCharsets.UTF_8))) {
                    StringBuilder sb = new StringBuilder();
                    String line;
                    while ((line = r.readLine()) != null) {
                        sb.append(line);
                    }
                    stdout = sb.toString();
                }
            } else {
                p.getInputStream().transferTo(OutputStream.nullOutputStream());
            }
            String stderr;
            try (BufferedReader r = new BufferedReader(new InputStreamReader(p.getErrorStream(), StandardCharsets.UTF_8))) {
                StringBuilder sb = new StringBuilder();
                String line;
                while ((line = r.readLine()) != null) {
                    sb.append(line).append('\n');
                }
                stderr = sb.toString();
            }
            boolean finished = p.waitFor(120, TimeUnit.SECONDS);
            if (!finished) {
                p.destroyForcibly();
                throw new BadRequestException(label + " timed out — is FFmpeg installed?");
            }
            int code = p.exitValue();
            if (code != 0) {
                log.warn("{} failed exit={} stderr={}", label, code, stderr);
                throw new BadRequestException(label + " failed (exit " + code + "). Ensure FFmpeg is on PATH.");
            }
            return stdout;
        } catch (BadRequestException e) {
            throw e;
        } catch (Exception e) {
            log.error(label + " error", e);
            throw new BadRequestException(label + " failed: " + e.getMessage());
        }
    }
}