package com.ai.englishsystem.auth.service;

import com.ai.englishsystem.auth.dto.AuthResponse;
import com.ai.englishsystem.auth.dto.ChangePasswordRequest;
import com.ai.englishsystem.auth.dto.LoginRequest;
import com.ai.englishsystem.auth.dto.RegisterRequest;
import com.ai.englishsystem.common.exception.BadRequestException;
import com.ai.englishsystem.common.exception.ForbiddenException;
import com.ai.englishsystem.common.exception.UnauthorizedException;
import com.ai.englishsystem.common.util.SecurityUtils;
import com.ai.englishsystem.config.JwtService;
import com.ai.englishsystem.teacher.repository.TeacherRepository;
import com.ai.englishsystem.user.entity.User;
import com.ai.englishsystem.user.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class AuthService {

    private final UserRepository userRepository;
    private final TeacherRepository teacherRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtService jwtService;

    @Transactional
    public AuthResponse login(LoginRequest request) {
        User user = userRepository.findByEmail(request.getEmail())
                .orElseThrow(() -> new UnauthorizedException("Invalid email or password"));

        String storedHash = user.getPassword();
        if (!passwordEncoder.matches(request.getPassword(), storedHash)) {
            // One-time upgrade path for legacy plaintext passwords (not BCrypt-prefixed)
            if (storedHash != null
                    && !storedHash.startsWith("$2a$")
                    && !storedHash.startsWith("$2b$")
                    && !storedHash.startsWith("$2y$")
                    && storedHash.equals(request.getPassword())) {
                user.setPassword(passwordEncoder.encode(request.getPassword()));
                userRepository.save(user);
            } else {
                throw new UnauthorizedException("Invalid email or password");
            }
        }

        if (!"ACTIVE".equalsIgnoreCase(user.getStatus())) {
            throw new ForbiddenException("Account is not active");
        }

        String token = jwtService.generateToken(user);

        // FIX: use .accessToken() instead of .token()
        return AuthResponse.builder()
                .accessToken(token)
                .userId(user.getId())
                .username(user.getUsername())
                .email(user.getEmail())
                .fullName(user.getFullName())
                .role(user.getRole().getName())
                .teacherId(resolveTeacherId(user))
                .build();
    }

    @Transactional
    public AuthResponse register(RegisterRequest request) {
        throw new BadRequestException("Student self-registration is disabled. Please contact your teacher.");
    }

    @Transactional
    public void changePassword(ChangePasswordRequest request) {
        if (!request.getNewPassword().equals(request.getConfirmPassword())) {
            throw new BadRequestException("New password confirmation does not match");
        }
        if (request.getCurrentPassword().equals(request.getNewPassword())) {
            throw new BadRequestException("New password must be different from current password");
        }

        Integer userId = SecurityUtils.getCurrentUserId();
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new UnauthorizedException("User not found"));
        if (!"ACTIVE".equalsIgnoreCase(user.getStatus())) {
            throw new ForbiddenException("Account is not active");
        }
        if (!passwordEncoder.matches(request.getCurrentPassword(), user.getPassword())) {
            throw new UnauthorizedException("Current password is incorrect");
        }
        user.setPassword(passwordEncoder.encode(request.getNewPassword()));
        userRepository.save(user);
    }

    private Integer resolveTeacherId(User user) {
        if (user == null || user.getRole() == null || !"TEACHER".equalsIgnoreCase(user.getRole().getName())) {
            return null;
        }
        return teacherRepository.findIdByUserId(user.getId()).orElse(null);
    }
}
