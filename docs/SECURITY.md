# Security

This document summarizes the security design used in the graduation-project
version of AI English Tutor.

## Authentication

The system uses stateless JWT authentication:

- Users log in through `POST /api/auth/login`.
- The backend verifies the password with BCrypt.
- The backend returns an access token and user profile.
- React apps send the token through the `Authorization: Bearer <token>` header.
- The learning service accepts the same JWT secret so students can access
  learning APIs after logging in through the main backend.

## Authorization

Authorization is role-based:

- `STUDENT`: can view active exams, start/submit own attempts, view own results,
  upload own speaking answers, and use learning APIs.
- `TEACHER`: can manage owned classes, students, exams, questions, media, and
  review submissions for owned exams.
- `ADMIN`: can access administrative operations.

Spring Security protects all non-public APIs, and many endpoints also use
`@PreAuthorize`. Service methods additionally check ownership so a valid role is
not enough to access another user's data.

## Input Validation

The Java APIs use Bean Validation annotations such as `@Valid`, `@NotBlank`,
`@NotNull`, `@Email`, and `@Size`.

The Python AI service validates:

- Missing files
- Upload size limit
- Blank TTS text
- Basic OCR/TTS request structure

## File Upload Security

The backend validates file size and content type. Image/PDF/audio flows also use
content checks such as magic-byte validation where relevant.

Uploaded files are stored under controlled upload directories and generated file
names are used to avoid trusting client-provided names.

## CORS And CSRF

CORS allowed origins are configured by environment variables. CSRF protection is
disabled because the Java APIs are stateless REST APIs authenticated by bearer
tokens, not cookie sessions.

## Rate Limiting

The backend has a `RateLimitFilter` with two modes:

- In-memory mode for simple local development
- Redis-backed mode for the Docker/prod-like stack

AI-heavy endpoints have stricter limits than general endpoints.

## Gateway Hardening

Nginx now sets basic security headers:

- `X-Content-Type-Options`
- `X-Frame-Options`
- `Referrer-Policy`
- `Permissions-Policy`
- `Content-Security-Policy`

The AI service is bound to localhost by default in Docker Compose so it is not
exposed broadly on the host network.

## Secrets

Sensitive values should be configured through `backend/.env` and environment
variables:

- Database password
- JWT secret
- Redis password
- AI provider API keys

The `.env.example` file contains placeholders only.

## Known Graduation-Scope Limitations

These limitations are acceptable for the current graduation-project scope but
should be mentioned honestly in the report:

- JWT is stored in browser localStorage for implementation simplicity.
- Swagger UI is public in local/demo mode to make API defense easier.
- CSP allows inline styles because the current frontend/Tailwind output and UI
  setup rely on inline style compatibility.
- Dependency audit still reports issues in npm dependency trees.
- AI service requests are synchronous HTTP calls rather than durable queue jobs.

## Recommended Production Improvements

- Move auth storage to HttpOnly Secure SameSite cookies or add refresh-token
  rotation.
- Protect Swagger UI outside local/demo environments.
- Add dependency CVE scanning to CI.
- Add object storage for uploaded media.
- Move AI processing to queue-based background jobs.
- Add centralized logs and alerting.
