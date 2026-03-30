package com.ai.englishsystem.media.repository;

import com.ai.englishsystem.media.entity.MediaFile;
import org.springframework.data.jpa.repository.JpaRepository;

public interface MediaFileRepository extends JpaRepository<MediaFile, Integer> {
}
