package com.ai.englishsystem.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.ResourceHandlerRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

import java.nio.file.Path;
import java.nio.file.Paths;

/**
 * Serves uploaded audio under {@code /uploads/audio/**} from {@code {app.upload.dir}/audio/}.
 * Place listening assets in {@code uploads/audio/listening/}; speaking uploads go to {@code uploads/audio/speaking/}.
 */
@Configuration
public class WebMvcConfig implements WebMvcConfigurer {

    @Value("${app.upload.dir:uploads}")
    private String uploadDir;

    @Override
    public void addResourceHandlers(ResourceHandlerRegistry registry) {
        Path audioRoot = Paths.get(uploadDir).toAbsolutePath().normalize().resolve("audio");
        String location = "file:" + audioRoot + "/";
        registry.addResourceHandler("/uploads/audio/**")
                .addResourceLocations(location);
    }
}
