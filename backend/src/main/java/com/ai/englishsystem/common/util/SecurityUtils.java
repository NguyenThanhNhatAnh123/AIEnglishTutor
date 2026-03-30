package com.ai.englishsystem.common.util;

import com.ai.englishsystem.common.exception.ForbiddenException;
import com.ai.englishsystem.common.exception.UnauthorizedException;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;

public final class SecurityUtils {

    private SecurityUtils() {
    }

    public static Integer getCurrentUserId() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || auth.getPrincipal() == null || "anonymousUser".equals(auth.getPrincipal())) {
            throw new UnauthorizedException("Not authenticated");
        }
        try {
            return Integer.parseInt(auth.getPrincipal().toString());
        } catch (NumberFormatException e) {
            throw new UnauthorizedException("Invalid user context");
        }
    }

    public static Integer getCurrentUserIdOrNull() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || auth.getPrincipal() == null || "anonymousUser".equals(auth.getPrincipal())) {
            return null;
        }
        try {
            return Integer.parseInt(auth.getPrincipal().toString());
        } catch (NumberFormatException e) {
            return null;
        }
    }

    public static void requireCurrentUser(Integer userId) {
        Integer current = getCurrentUserId();
        if (!current.equals(userId)) {
            throw new ForbiddenException("Access denied: resource does not belong to current user");
        }
    }

    public static boolean hasRole(String role) {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || auth.getAuthorities() == null) return false;
        return auth.getAuthorities().stream()
                .anyMatch(a -> ("ROLE_" + role).equalsIgnoreCase(a.getAuthority()));
    }

    public static boolean isTeacherOrAdmin() {
        return hasRole("TEACHER") || hasRole("ADMIN");
    }
}
