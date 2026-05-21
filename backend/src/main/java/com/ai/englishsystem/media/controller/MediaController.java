package com.ai.englishsystem.media.controller;

import com.ai.englishsystem.common.dto.ApiResponse;
import com.ai.englishsystem.media.service.MediaService;
import lombok.RequiredArgsConstructor;
import org.springframework.core.io.Resource;
import org.springframework.core.io.UrlResource;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.net.MalformedURLException;
import java.nio.file.Path;
import java.util.Map;

@RestController
@RequestMapping("/api/media")
@RequiredArgsConstructor
public class MediaController {

    private final MediaService mediaService;

    /**
     * Upload an audio file. Returns { url: "/uploads/audio/listening/xxx.webm" }.
     */
    @PostMapping("/upload")
    @PreAuthorize("hasAnyRole('TEACHER','ADMIN')")
    public ResponseEntity<ApiResponse<Map<String, String>>> upload(@RequestParam("file") MultipartFile file) {
        String url = mediaService.uploadAudio(file);
        return ResponseEntity.ok(ApiResponse.success("File uploaded", Map.of("url", url)));
    }

    /**
     * Serve legacy files uploaded before listening-path migration (requires JWT).
     */
    @GetMapping("/files/{filename:.+}")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<Resource> serveFile(@PathVariable String filename) throws MalformedURLException {
        Path filePath = mediaService.resolveFile(filename);
        Resource resource = new UrlResource(filePath.toUri());

        String contentType = "application/octet-stream";
        String fn = filename.toLowerCase();
        if (fn.endsWith(".webm")) contentType = "audio/webm";
        else if (fn.endsWith(".mp3")) contentType = "audio/mpeg";
        else if (fn.endsWith(".ogg")) contentType = "audio/ogg";
        else if (fn.endsWith(".wav")) contentType = "audio/wav";
        else if (fn.endsWith(".m4a")) contentType = "audio/mp4";

        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType(contentType))
                .header(HttpHeaders.CONTENT_DISPOSITION, "inline; filename=\"" + filename + "\"")
                .body(resource);
    }
}
