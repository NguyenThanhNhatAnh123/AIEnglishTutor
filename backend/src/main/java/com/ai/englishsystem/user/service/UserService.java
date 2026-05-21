package com.ai.englishsystem.user.service;

import com.ai.englishsystem.auth.entity.Role;
import com.ai.englishsystem.auth.repository.RoleRepository;
import com.ai.englishsystem.common.exception.BadRequestException;
import com.ai.englishsystem.common.exception.ForbiddenException;
import com.ai.englishsystem.common.exception.NotFoundException;
import com.ai.englishsystem.common.util.SecurityUtils;
import com.ai.englishsystem.config.CacheNames;
import com.ai.englishsystem.user.dto.UserRequest;
import com.ai.englishsystem.user.dto.UserResponse;
import com.ai.englishsystem.user.entity.User;
import com.ai.englishsystem.user.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.cache.annotation.CacheEvict;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class UserService {

    private final UserRepository userRepository;
    private final RoleRepository roleRepository;
    private final PasswordEncoder passwordEncoder;

    @Transactional(readOnly = true)
    public List<UserResponse> findAll() {
        return userRepository.findAll().stream()
                .map(this::toResponse)
                .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public Page<UserResponse> findAll(Pageable pageable) {
        return userRepository.findAllWithRole(pageable)
                .map(this::toResponse);
    }

    @Transactional(readOnly = true)
    public UserResponse findById(Integer id) {
        User user = userRepository.findById(id)
                .orElseThrow(() -> new NotFoundException("User", id));
        return toResponse(user);
    }

    @Transactional
    @CacheEvict(value = CacheNames.TEACHERS, allEntries = true)
    public UserResponse create(UserRequest request) {
        if (userRepository.existsByEmail(request.getEmail())) {
            throw new BadRequestException("Email already exists");
        }
        if (userRepository.existsByUsername(request.getUsername())) {
            throw new BadRequestException("Username already exists");
        }

        Role role = roleRepository.findById(request.getRoleId())
                .orElseThrow(() -> new NotFoundException("Role", request.getRoleId()));

        if (SecurityUtils.hasRole("TEACHER") && !SecurityUtils.hasRole("ADMIN")) {
            if (!"STUDENT".equalsIgnoreCase(role.getName())) {
                throw new ForbiddenException("Teachers may only create accounts with the STUDENT role");
            }
        }

        if (request.getPassword() == null || request.getPassword().isBlank()) {
            throw new BadRequestException("Password is required");
        }

        User user = User.builder()
                .username(request.getUsername())
                .email(request.getEmail())
                .password(passwordEncoder.encode(request.getPassword()))
                .fullName(request.getFullName())
                .role(role)
                .status(request.getStatus() != null ? request.getStatus() : "ACTIVE")
                .build();

        try {
            user = userRepository.save(user);
        } catch (DataIntegrityViolationException ex) {
            throw new BadRequestException("Email or username already exists");
        }
        return toResponse(user);
    }

    @Transactional
    @CacheEvict(value = CacheNames.TEACHERS, allEntries = true)
    public UserResponse update(Integer id, UserRequest request) {
        User user = userRepository.findById(id)
                .orElseThrow(() -> new NotFoundException("User", id));

        if (request.getPassword() != null && !request.getPassword().isEmpty()) {
            user.setPassword(passwordEncoder.encode(request.getPassword()));
        }
        if (request.getFullName() != null) user.setFullName(request.getFullName());
        if (request.getStatus() != null) user.setStatus(request.getStatus());
        if (request.getRoleId() != null) {
            Role role = roleRepository.findById(request.getRoleId())
                    .orElseThrow(() -> new NotFoundException("Role", request.getRoleId()));
            user.setRole(role);
        }

        user = userRepository.save(user);
        return toResponse(user);
    }

    @Transactional
    @CacheEvict(value = CacheNames.TEACHERS, allEntries = true)
    public void delete(Integer id) {
        if (!userRepository.existsById(id)) {
            throw new NotFoundException("User", id);
        }
        userRepository.deleteById(id);
    }

    private UserResponse toResponse(User user) {
        return UserResponse.builder()
                .id(user.getId())
                .username(user.getUsername())
                .email(user.getEmail())
                .fullName(user.getFullName())
                .roleId(user.getRole().getId())
                .roleName(user.getRole().getName())
                .status(user.getStatus())
                .createdAt(user.getCreatedAt())
                .build();
    }
}
