package com.ai.englishsystem.auth.service;

import com.ai.englishsystem.auth.dto.AuthResponse;
import com.ai.englishsystem.auth.dto.LoginRequest;
import com.ai.englishsystem.auth.dto.RegisterRequest;
import com.ai.englishsystem.auth.entity.Role;
import com.ai.englishsystem.auth.repository.RoleRepository;
import com.ai.englishsystem.common.exception.BadRequestException;
import com.ai.englishsystem.common.exception.ForbiddenException;
import com.ai.englishsystem.common.exception.UnauthorizedException;
import com.ai.englishsystem.config.JwtService;
import com.ai.englishsystem.student.entity.Student;
import com.ai.englishsystem.student.repository.StudentRepository;
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
    private final RoleRepository roleRepository;
    private final StudentRepository studentRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtService jwtService;

    @Transactional
    public AuthResponse login(LoginRequest request) {
        User user = userRepository.findByEmail(request.getEmail())
                .orElseThrow(() -> new UnauthorizedException("Invalid email or password"));

        if (!passwordEncoder.matches(request.getPassword(), user.getPassword())) {
            throw new UnauthorizedException("Invalid email or password");
        }

        if (!"ACTIVE".equals(user.getStatus())) {
            throw new ForbiddenException("Account is not active");
        }

        String token = jwtService.generateToken(user);

        // FIX: use .accessToken() instead of .token()
        return AuthResponse.builder()
                .accessToken(token)
                .userId(user.getId())
                .username(user.getUsername())
                .email(user.getEmail())
                .role(user.getRole().getName())
                .build();
    }

    @Transactional
    public AuthResponse register(RegisterRequest request) {
        if (userRepository.existsByEmail(request.getEmail())) {
            throw new BadRequestException("Email already registered");
        }
        if (userRepository.existsByUsername(request.getUsername())) {
            throw new BadRequestException("Username already taken");
        }

        Role role = roleRepository.findById(request.getRoleId() != null ? request.getRoleId() : 2)
                .orElse(roleRepository.findByName("STUDENT")
                        .orElseThrow(() -> new BadRequestException("Default role not found")));

        User user = User.builder()
                .username(request.getUsername())
                .email(request.getEmail())
                .password(passwordEncoder.encode(request.getPassword()))
                .fullName(request.getFullName())
                .role(role)
                .status("ACTIVE")
                .build();

        user = userRepository.save(user);

        if ("STUDENT".equals(role.getName())) {
            String studentCode = "STU-" + user.getId() + "-" + System.currentTimeMillis();
            studentRepository.save(Student.builder()
                    .user(user)
                    .studentCode(studentCode)
                    .build());
        }

        String token = jwtService.generateToken(user);

        // FIX: use .accessToken() instead of .token()
        return AuthResponse.builder()
                .accessToken(token)
                .userId(user.getId())
                .username(user.getUsername())
                .email(user.getEmail())
                .role(user.getRole().getName())
                .build();
    }
}
