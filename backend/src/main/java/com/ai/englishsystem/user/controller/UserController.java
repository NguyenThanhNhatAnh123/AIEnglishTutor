package com.ai.englishsystem.user.controller;

import com.ai.englishsystem.common.dto.ApiResponse;
import com.ai.englishsystem.user.dto.UserRequest;
import com.ai.englishsystem.user.dto.UserResponse;
import com.ai.englishsystem.user.service.UserService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/users")
@RequiredArgsConstructor
public class UserController {

    private final UserService userService;

    @GetMapping
    @org.springframework.security.access.prepost.PreAuthorize("hasAnyRole('TEACHER', 'ADMIN')")
    public ResponseEntity<ApiResponse<List<UserResponse>>> getAll() {
        List<UserResponse> users = userService.findAll();
        return ResponseEntity.ok(ApiResponse.success(users));
    }

    @GetMapping("/{id}")
    @org.springframework.security.access.prepost.PreAuthorize("hasAnyRole('TEACHER', 'ADMIN')")
    public ResponseEntity<ApiResponse<UserResponse>> getById(@PathVariable Integer id) {
        UserResponse user = userService.findById(id);
        return ResponseEntity.ok(ApiResponse.success(user));
    }

    @PostMapping
    @org.springframework.security.access.prepost.PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<ApiResponse<UserResponse>> create(@Valid @RequestBody UserRequest request) {
        UserResponse user = userService.create(request);
        return ResponseEntity.ok(ApiResponse.success("User created", user));
    }

    @PutMapping("/{id}")
    @org.springframework.security.access.prepost.PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<ApiResponse<UserResponse>> update(
            @PathVariable Integer id,
            @Valid @RequestBody UserRequest request
    ) {
        UserResponse user = userService.update(id, request);
        return ResponseEntity.ok(ApiResponse.success("User updated", user));
    }

    @DeleteMapping("/{id}")
    @org.springframework.security.access.prepost.PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<ApiResponse<Void>> delete(@PathVariable Integer id) {
        userService.delete(id);
        return ResponseEntity.ok(ApiResponse.success("User deleted", null));
    }
}
