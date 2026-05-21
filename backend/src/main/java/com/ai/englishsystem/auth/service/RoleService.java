package com.ai.englishsystem.auth.service;

import com.ai.englishsystem.auth.dto.RoleResponse;
import com.ai.englishsystem.auth.repository.RoleRepository;
import com.ai.englishsystem.config.CacheNames;
import lombok.RequiredArgsConstructor;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class RoleService {

    private final RoleRepository roleRepository;

    @Cacheable(CacheNames.ROLES)
    @Transactional(readOnly = true)
    public List<RoleResponse> findAll() {
        return roleRepository.findAll().stream()
                .map(r -> RoleResponse.builder()
                        .id(r.getId())
                        .name(r.getName())
                        .description(r.getDescription())
                        .build())
                .collect(Collectors.toList());
    }
}
