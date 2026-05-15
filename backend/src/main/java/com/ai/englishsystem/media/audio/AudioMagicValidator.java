package com.ai.englishsystem.media.audio;

import com.ai.englishsystem.common.exception.BadRequestException;

import java.io.IOException;
import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;

/**
 * Validates declared browser MIME types against actual file signatures (anti-spoofing).
 */
public final class AudioMagicValidator {

    private static final int MIN_HEAD = 16;

    private AudioMagicValidator() {
    }

    public static DetectedAudioFormat detectFormat(byte[] head) {
        if (head == null || head.length < 4) {
            return DetectedAudioFormat.UNKNOWN;
        }
        // WEBM / Matroska EBML
        if (head.length >= 4 && head[0] == 0x1A && head[1] == 0x45 && head[2] == (byte) 0xDF && head[3] == (byte) 0xA3) {
            return DetectedAudioFormat.WEBM;
        }
        // RIFF....WAVE
        if (head.length >= 12
                && head[0] == 'R' && head[1] == 'I' && head[2] == 'F' && head[3] == 'F'
                && head[8] == 'W' && head[9] == 'A' && head[10] == 'V' && head[11] == 'E') {
            return DetectedAudioFormat.WAV;
        }
        // ISO BMFF / MP4 / M4A: size(4) + "ftyp"
        if (head.length >= 12
                && head[4] == 'f' && head[5] == 't' && head[6] == 'y' && head[7] == 'p') {
            return DetectedAudioFormat.MP4;
        }
        // Ogg
        if (head.length >= 4 && head[0] == 'O' && head[1] == 'g' && head[2] == 'g' && head[3] == 'S') {
            return DetectedAudioFormat.OGG;
        }
        // ID3v2 or MPEG frame sync
        if (head.length >= 3 && head[0] == 'I' && head[1] == 'D' && head[2] == '3') {
            return DetectedAudioFormat.MP3;
        }
        if (head.length >= 2 && (head[0] & 0xFF) == 0xFF && (head[1] & 0xE0) == 0xE0) {
            return DetectedAudioFormat.MP3;
        }
        return DetectedAudioFormat.UNKNOWN;
    }

    public static byte[] readHead(Path file, int len) throws IOException {
        byte[] buf = new byte[len];
        try (InputStream in = Files.newInputStream(file)) {
            int read = in.readNBytes(buf, 0, len);
            if (read < MIN_HEAD) {
                throw new BadRequestException("Audio file is too small or empty");
            }
            return buf;
        }
    }

    /**
     * Validates that the file has a recognized audio magic signature.
     * IOException is caught internally and rethrown as BadRequestException
     * so callers do not need to declare or catch checked exceptions.
     *
     * @throws BadRequestException if the format is unrecognized or the file cannot be read
     */
    public static void assertRecognized(Path file) {
        try {
            byte[] head = readHead(file, 32);
            if (detectFormat(head) == DetectedAudioFormat.UNKNOWN) {
                throw new BadRequestException("Unrecognized audio format (expected mp3, wav, webm, m4a/mp4, or ogg)");
            }
        } catch (BadRequestException e) {
            throw e;
        } catch (IOException e) {
            throw new BadRequestException("Cannot read audio file: " + e.getMessage());
        }
    }
}
