package com.ai.englishsystem.media.audio;

/**
 * Container format detected from file magic (first bytes), not from HTTP Content-Type.
 */
public enum DetectedAudioFormat {
    MP3,
    WAV,
    WEBM,
    OGG,
    UNKNOWN
}
