# AI English Exam System – Full System Audit Report

**Project:** AI English Exam System (Fullstack)  
**Tech Stack:** Spring Boot 3.3 (Java 21, JPA, MySQL), React 19 (Student + Teacher UI)  
**Date:** March 14, 2025  
**Auditor:** Senior Software Architect & Security Engineer

---

## Executive Summary

This audit identifies **critical functional and security issues** that must be resolved before production deployment. The most severe findings are: **answers are never persisted to the backend** (students submit exams with no saved answers), **Insecure Direct Object References (IDOR)** allowing users to act on behalf of other students, **missing RBAC** on API endpoints, and **submission submit logic** that does not validate state or ownership. The architecture largely follows Controller→Service→Repository, but several backend and frontend gaps exist.

---

## 1. Backend Architecture

### 1.1 Controller → Service → Repository Pattern

| Area | Status | Notes |
|------|--------|------|
| Layering | ✅ | Controllers delegate to services; services use repositories |
| Entity exposure | ⚠️ | AnswerController returns entity-derived `Map` instead of DTO |
| Business logic in controllers | ✅ | Controllers are thin |
| Request/Response DTOs | ✅ | Most endpoints use DTOs (AuthResponse, ExamResponse, QuestionResponse, etc.) |

**Issue 1.1.1 – AnswerController returns entity-derived response**

| Field | Value |
|-------|-------|
| **File** | `backend/src/main/java/com/ai/englishsystem/submission/controller/AnswerController.java` |
| **Line** | 23-29 |
| **Severity** | Medium |
| **Description** | Controller receives `Answer` entity from service and builds a `Map` from entity fields instead of using an `AnswerResponse` DTO. Leaks entity structure and couples API to persistence. |
| **Fix** | Add `AnswerResponse` DTO and map entity in service; controller returns only DTO. |

```java
// Current (AnswerController.java:23-29)
Answer answer = answerService.create(request);
Map<String, Object> data = new HashMap<>();
data.put("id", answer.getId());
// ...

// Recommended
AnswerResponse response = answerService.create(request);
return ResponseEntity.ok(ApiResponse.success("Answer saved", response));
```

### 1.2 Dependency Injection

| Area | Status | Notes |
|------|--------|------|
| Constructor injection | ✅ | Controllers and services use `@RequiredArgsConstructor` + constructor DI |
| @Service, @Repository | ✅ | Correctly used |
| Manual instantiation | ✅ | Not observed |

### 1.3 DTO Separation and Validation

| Area | Status | Notes |
|------|--------|------|
| Response DTOs | ✅ | AuthResponse, ExamResponse, QuestionResponse, SubmissionResponse, AiScoreResponse, etc. |
| Request validation | ✅ | `@Valid` on POST/PUT bodies |
| LoginRequest | ✅ | `@NotBlank` on email, password |
| RegisterRequest | ⚠️ | Has `@Email`, `@Size(min=6)` but no `@Pattern` for password complexity |
| AnswerRequest | ⚠️ | No `@Size`/`@NotBlank` on answerText; no validation for URLs (audioUrl, imageUrl) |

**Recommendation:** Add `@Pattern` for password (uppercase, lowercase, digit, special char) and validate answer text length and URL format where applicable.

### 1.4 Transaction Management

| Area | Status | Notes |
|------|--------|------|
| Write operations | ✅ | `@Transactional` on create/update/delete methods |
| Read operations | ❌ | No `@Transactional(readOnly = true)` on `findAll()`, `findById()`, etc. |

**Files affected:**  
- `ExamService.findAll()`, `ExamService.findById()`  
- `UserService.findAll()`, `UserService.findById()`  
- `SubmissionService`, `ScoreService`, `QuestionService`, etc.

```java
// Add to read-only methods
@Transactional(readOnly = true)
public List<ExamResponse> findAll() { ... }
```

### 1.5 N+1 Query Risk

| Area | Status | Notes |
|------|--------|------|
| ExamService.findAll() | ❌ | Fetches all exams; each `toResponse(exam)` accesses `exam.getTeacher().getUser()` → N+1 |
| ExamService.findById() | ❌ | `toResponseWithSections()` accesses `exam.getSections()` → `section.getQuestions()` → `question.getOptions()` → multiple lazy loads |
| Projections | ❌ | No `findAllProjectedBy()` or similar optimizations |

**Fix:** Use `@EntityGraph` or fetch joins:

```java
// ExamRepository
@EntityGraph(attributePaths = {"teacher", "teacher.user"})
List<Exam> findAll();
// For findById with sections, use separate @Query with fetch join
```

### 1.6 Logging (slf4j + MDC)

| Area | Status | Notes |
|------|--------|------|
| slf4j | ✅ | Used in JwtService, GlobalExceptionHandler, DataInitializer |
| MDC (requestId, userId, traceId) | ❌ | Not used |
| Sensitive data | ✅ | No passwords/tokens in logs observed |

**Recommendation:** Add a filter to set `requestId`, `userId` in MDC and ensure sensitive fields are never logged.

### 1.7 Validation (Backend)

| Area | Status | Notes |
|------|--------|------|
| @Valid in controllers | ✅ | Used on request DTOs |
| Custom validation | ⚠️ | Limited; consider `@Pattern` for password, URL validation where needed |
| Enums | ⚠️ | Status/role stored as strings ("ACTIVE", "STUDENT"); no centralized enum validation |

---

## 2. Exception Handling

### 2.1 Global Handler

| Area | Status | Notes |
|------|--------|------|
| GlobalExceptionHandler | ✅ | Present in `com.ai.englishsystem.common.exception` |
| MethodArgumentNotValidException | ✅ | Handled |
| RuntimeException | ✅ | Handled (maps to BAD_REQUEST) |
| AccessDeniedException | ❌ | Not handled |
| HttpRequestMethodNotSupportedException | ❌ | Not handled |
| Fallback Exception | ❌ | No generic `Exception` handler |

### 2.2 Custom Exceptions

| Exception | Status |
|-----------|--------|
| NotFoundException | ❌ |
| BadRequestException | ❌ |
| UnauthorizedException | ❌ |
| ForbiddenException | ❌ |

All errors use `RuntimeException`, which reduces clarity and control over HTTP status codes.

### 2.3 Error Response Format

| Area | Status | Notes |
|------|--------|------|
| ApiResponse.error(message) | ✅ | Exists |
| Error code | ❌ | `ApiResponse` has no `code` field |
| Timestamp | ❌ | Not included |

```java
// ApiResponse.java – extend error format
public static <T> ApiResponse<T> error(String message, String code) {
    return ApiResponse.<T>builder()
        .success(false)
        .message(message)
        .code(code)
        .timestamp(Instant.now())
        .build();
}
```

---

## 3. Authentication & Authorization (RBAC)

### 3.1 Login Flow

| Area | Status | Notes |
|------|--------|------|
| Endpoint | ✅ | `POST /api/auth/login` |
| Input | ✅ | email + password via LoginRequest |
| Response | ⚠️ | `AuthResponse` has single `token`; no `accessToken` / `refreshToken` split |
| BCrypt | ⚠️ | `BCryptPasswordEncoder()` used without strength; config has `bcrypt-strength: 12` but not applied |
| Invalid credentials | ✅ | Throws RuntimeException → 400 |
| Inactive user | ✅ | Throws RuntimeException for non-ACTIVE status |

**BCrypt fix (SecurityConfig.java):**

```java
@Value("${app.security.bcrypt-strength:12}")
private int bcryptStrength;

@Bean
public PasswordEncoder passwordEncoder() {
    return new BCryptPasswordEncoder(bcryptStrength);
}
```

### 3.2 Registration

| Area | Status | Notes |
|------|--------|------|
| Endpoint | ✅ | `POST /api/auth/register` |
| Email unique | ✅ | Checked via `userRepository.existsByEmail()` |
| Username unique | ✅ | Checked via `userRepository.existsByUsername()` |
| Password policy | ⚠️ | `@Size(min=6)` only; no complexity rules |
| Default role | ✅ | STUDENT (roleId 2) |
| Email verification | ❌ | Not implemented |
| Account lockout | ❌ | Config has `max-failed-attempts` and `lock-duration-minutes` but no implementation |

### 3.3 Role-Based Access Control

| Area | Status | Notes |
|------|--------|------|
| @PreAuthorize | ❌ | Not used on any controller |
| Teacher-only | ❌ | No protection on `/api/exams`, `/api/questions`, `/api/classes` |
| Student-only | ❌ | No protection on `/api/submissions`, `/api/answers` |
| Admin-only | ❌ | No protection on `/api/users` |
| userId from SecurityContext | ⚠️ | JwtAuthFilter sets principal; services do not consistently derive userId from context |

**Fix:** Add method-level security:

```java
@PreAuthorize("hasRole('TEACHER')")
@PostMapping
public ResponseEntity<ApiResponse<ExamResponse>> create(...) { ... }

@PreAuthorize("hasRole('STUDENT')")
@PostMapping("/start")
public ResponseEntity<ApiResponse<SubmissionResponse>> start(...) { ... }
```

---

## 4. Token Management

### 4.1 JWT Structure

| Claim | Status |
|-------|--------|
| sub (userId) | ✅ |
| role | ✅ |
| iat | ✅ |
| exp | ✅ |
| iss | ❌ |
| aud | ❌ |
| jti | ✅ (via .id()) |

**Recommendation:** Add `iss` and `aud` for strict token validation.

### 4.2 Refresh Token Flow

| Area | Status |
|------|--------|
| Refresh endpoint | ❌ |
| Refresh token storage | ❌ |
| Token rotation | ❌ |
| Blacklist | ❌ |

**Note:** Config has `refresh-expiration` but no refresh flow. Users are logged out when access token expires (15 min) with no refresh option.

---

## 5. Security Vulnerabilities

### 5.1 IDOR (Insecure Direct Object Reference)

| Issue | File | Line | Severity |
|-------|------|------|----------|
| **StartSubmissionRequest accepts studentId** | `StartSubmissionRequest.java` | 17-18 | Critical |
| **Frontend hardcodes studentId: 1** | `frontend/student/src/pages/ExamRoom.jsx` | 27 | Critical |
| **Score by submissionId without ownership check** | `ScoreService.java`, `ScoreController.java` | 19-21 | High |
| **Answer creation: no check that submission belongs to authenticated student** | `AnswerService.java` | 23-37 | High |
| **Submission submit: no ownership check** | `SubmissionService.java` | 44-53 | High |

**Fix (StartSubmission):** Do not accept `studentId` from client. Resolve student from `SecurityContextHolder.getContext().getAuthentication().getPrincipal()` (userId) via StudentRepository.

```java
// StartSubmissionRequest – remove studentId
// Service: get student by current user id
String userId = SecurityContextHolder.getContext().getAuthentication().getPrincipal().toString();
Student student = studentRepository.findByUserId(Integer.parseInt(userId))
    .orElseThrow(() -> new ForbiddenException("Student profile not found"));
```

### 5.2 SQL Injection

| Area | Status | Notes |
|------|--------|------|
| JPA / repository usage | ✅ | Parameter binding used; no concatenation in queries observed |
| Native queries | ⚠️ | None found; if added, must use parameter binding |

### 5.3 XSS

| Area | Status | Notes |
|------|--------|------|
| Frontend rendering | ✅ | React escapes by default; no `dangerouslySetInnerHTML` in app code |
| Backend sanitization | ⚠️ | questionText, answerText, feedback not sanitized before storage; low risk if only React renders, but sanitization on backend recommended for defense in depth |

### 5.4 CSRF

| Area | Status | Notes |
|------|--------|------|
| Stateless JWT API | ✅ | `csrf.disable()` appropriate for token-based API |

### 5.5 Sensitive Data Exposure

| Area | Status | Notes |
|------|--------|------|
| application.yml | ❌ | `password: root`, JWT secret in plain text |
| application.properties | ❌ | Same issues; credentials in source |
| AuthResponse | ⚠️ | Returns token; ensure HTTPS in production |

**Fix:** Move secrets to environment variables:

```yaml
spring:
  datasource:
    password: ${DB_PASSWORD:root}
app:
  jwt:
    secret: ${JWT_SECRET}
```

### 5.6 CORS

| Area | Status | Notes |
|------|--------|------|
| Whitelist | ✅ | `localhost:5173`, `localhost:5174`, `127.0.0.1` |
| Wildcard | ✅ | Not used |

---

## 6. File Upload Security

| Area | Status | Notes |
|------|--------|------|
| Media controller | ❌ | No upload controller found; `/api/media/**` is public |
| File size limit | ✅ | `spring.servlet.multipart.max-file-size=50MB` |
| File type validation | N/A | No upload implementation |
| Random filenames | N/A | - |
| Virus scanning | ❌ | Not implemented |

---

## 7. Database Design Review

### 7.1 Schema Summary

Entities: users, roles, students, teachers, exams, exam_sections, questions, question_options, submissions, answers, scores, feedbacks, ai_results, media_files, classes, class_students, student_progress, system_settings, etc.

### 7.2 Issues

| Issue | Severity | Description |
|-------|----------|-------------|
| Unique constraint (submission_id, question_id) | High | `Answer` allows duplicates; no `findBySubmissionAndQuestion` for upsert |
| `updated_at` | Medium | `User`, `Exam`, `Submission`, etc. have `created_at` but no `updated_at` |
| `ddl-auto: update` | High | Schema changes applied at runtime; use Flyway/Liquibase for production |
| Indexes | Medium | No explicit indexes for `submission(student_id, exam_id)`, `answers(submission_id, question_id)`, etc. |

### 7.3 Recommended Indexes

```sql
CREATE UNIQUE INDEX uk_submission_student_exam ON submissions(student_id, exam_id);
CREATE UNIQUE INDEX uk_answer_submission_question ON answers(submission_id, question_id);
CREATE INDEX idx_exam_sections_exam_id ON exam_sections(exam_id);
CREATE INDEX idx_question_options_question_id ON question_options(question_id);
-- users.email is already unique in entity
```

---

## 8. Performance

### 8.1 N+1 Queries

| Location | Description |
|----------|-------------|
| ExamService.findAll() | Loads teacher + user per exam |
| ExamService.findById() + toResponseWithSections() | Loads sections → questions → options |
| QuestionService | Potential N+1 on options |

**Mitigation:** `@EntityGraph`, fetch joins, or DTO projections.

### 8.2 Caching

| Area | Status |
|------|--------|
| Redis | ❌ |
| Exam list cache | ❌ |
| Question bank cache | ❌ |
| Caffeine/in-memory | ❌ |

---

## 9. Business Logic Validation

### 9.1 Submission.submit

| Check | Status |
|-------|--------|
| status == IN_PROGRESS | ❌ |
| Not timed out | ❌ |
| Submission belongs to current user | ❌ |

**Current code (SubmissionService.java:44-53):** Accepts any `submissionId`, sets status and submit time without validation.

```java
// Recommended
if (!"IN_PROGRESS".equals(submission.getStatus())) {
    throw new BadRequestException("Submission is not in progress");
}
if (submission.getStartTime().plusMinutes(exam.getDurationMinutes()).isBefore(LocalDateTime.now())) {
    throw new BadRequestException("Exam time has expired");
}
// Verify ownership via SecurityContext
```

### 9.2 saveAnswer (AnswerService.create)

| Check | Status |
|-------|--------|
| If answer exists → update | ❌ |
| No duplicates | ❌ |
| Submission IN_PROGRESS | ❌ |
| Question belongs to submission exam | ❌ |

**Fix:** Use upsert pattern:

```java
Optional<Answer> existing = answerRepository.findBySubmissionAndQuestion(submission, question);
if (existing.isPresent()) {
    Answer a = existing.get();
    a.setAnswerText(...);
    return answerRepository.save(a);
}
// else create new
```

### 9.3 Race Conditions

| Area | Status |
|------|--------|
| @Version (optimistic locking) | ❌ |
| Submit vs answer concurrency | ❌ |

**Recommendation:** Add `@Version` on `Submission` and handle `OptimisticLockException`.

---

## 10. Frontend (React)

### 10.1 Authentication

| Area | Status | Notes |
|------|--------|------|
| AuthContext | ✅ | login, logout, user state |
| Token storage | ⚠️ | localStorage (prefer httpOnly cookie if possible) |
| Auto refresh token | ❌ | Not implemented |
| Private routes | ✅ | PrivateRoute checks `user` |

### 10.2 Exam Flow (ExamRoom)

| Area | Status | Notes |
|------|--------|------|
| Countdown timer | ❌ | Not implemented |
| Save answers | ❌ | Answers kept only in local state; **never sent to backend** |
| Submit exam | ✅ | Submits submission; answers never persisted |
| answerApi usage | ❌ | `answerApi` imported but `answerApi.create()` never called |

**Critical:** Students' answers are never saved. Only the submission record is created and submitted.

### 10.3 API Layer

| Area | Status | Notes |
|------|--------|------|
| Axios interceptor | ✅ | Adds Bearer token |
| 401 handling | ✅ | Redirects to /login, clears storage |
| Refresh on 401 | ❌ | Not implemented |
| Loading/error state | ⚠️ | Basic; no global toast for API errors |
| Base URL | ⚠️ | Hardcoded `http://localhost:8080/api` |

### 10.4 UX

| Area | Status |
|------|--------|
| Confirm submission modal | ❌ |
| Toast notifications | ❌ |
| Error boundaries | ❌ |

---

## 11. Test Coverage

### 11.1 Backend

| Area | Status |
|------|--------|
| Unit tests (AuthService, ExamService, etc.) | ❌ |
| Integration tests | ❌ |
| MockMvc / endpoint tests | ❌ |
| H2 for tests | ❌ |
| RBAC tests | ❌ |
| Exception handling tests | ❌ |

**Note:** Only `AienglishtutorApplicationTests` exists (context load), and it uses `com.example.aienglishtutor`, while the main app is `com.ai.englishsystem`.

### 11.2 Frontend

| Area | Status |
|------|--------|
| Jest / Vitest | ❌ |
| React Testing Library | ❌ |
| AuthContext tests | ❌ |
| ExamRoom / QuestionCard tests | ❌ |
| E2E (Cypress/Playwright) | ❌ |

---

## 12. DevOps & Deployment

### 12.1 Configuration

| Area | Status |
|------|--------|
| application-dev.yml | ⚠️ | Not found; application.yml and application-englishsystem.yml exist |
| application-test.yml | ❌ |
| application-prod.yml | ❌ |
| Secrets from env | ❌ |

### 12.2 Docker

| Area | Status |
|------|--------|
| Backend Dockerfile | ❌ |
| Frontend Dockerfile | ❌ |
| docker-compose | ❌ |

### 12.3 CI/CD

| Area | Status |
|------|--------|
| GitHub Actions | ❌ |
| Build / test pipeline | ❌ |
| Security scan | ❌ |
| Docker build / deploy | ❌ |

### 12.4 Monitoring

| Area | Status |
|------|--------|
| Spring Boot Actuator | ❌ |
| Prometheus | ❌ |
| ELK / centralized logging | ❌ |

---

## 13. Critical Issues Summary

| # | Severity | Description | Location |
|---|----------|-------------|----------|
| 1 | **Critical** | Student answers never persisted – ExamRoom never calls `answerApi.create()` | `frontend/student/src/pages/ExamRoom.jsx` |
| 2 | **Critical** | IDOR: client provides studentId; any user can start exam as another student | `StartSubmissionRequest`, `ExamRoom.jsx` |
| 3 | **Critical** | Score and submission access without ownership checks | `ScoreService`, `SubmissionService` |
| 4 | **Critical** | Submit accepts any submissionId; no status or timeout check | `SubmissionService.submit()` |
| 5 | **High** | No RBAC; all authenticated users can access all endpoints | All controllers |
| 6 | **High** | AnswerService allows duplicate answers per (submission, question) | `AnswerService`, `Answer` entity |
| 7 | **High** | Secrets in application files | `application.yml`, `application.properties` |
| 8 | **High** | ddl-auto: update in production | `application.yml` |

---

## 14. Medium Issues Summary

| # | Description |
|---|-------------|
| 1 | AnswerController returns entity-derived Map instead of AnswerResponse DTO |
| 2 | No @Transactional(readOnly=true) on read methods |
| 3 | N+1 queries in ExamService |
| 4 | BCrypt strength not applied (default 10 instead of 12) |
| 5 | No refresh token flow |
| 6 | JWT missing iss, aud |
| 7 | ApiResponse.error lacks code and timestamp |
| 8 | GlobalExceptionHandler missing AccessDeniedException, generic Exception |
| 9 | No custom exceptions (NotFoundException, ForbiddenException, etc.) |
| 10 | No countdown timer in ExamRoom |
| 11 | No confirm modal before exam submit |
| 12 | No MDC for requestId/userId |
| 13 | User/Exam entities missing updated_at |
| 14 | No unique constraint on answers(submission_id, question_id) |
| 15 | No optimistic locking on Submission |

---

## 15. Refactor Recommendations

1. **Fix answer persistence (ExamRoom)**  
   - Call `answerApi.create()` when user answers each question (debounced or on blur).  
   - Persist all answers before submit; optionally bulk save on submit.

2. **Remove client-provided studentId**  
   - Resolve student from JWT via StudentRepository (userId → student).  
   - Update StartSubmissionRequest and backend logic.

3. **Enforce RBAC**  
   - Add `@PreAuthorize("hasRole('TEACHER')")` on teacher endpoints.  
   - Add `@PreAuthorize("hasRole('STUDENT')")` on student endpoints.  
   - Use SecurityContext for user/student resolution.

4. **Ownership checks**  
   - Score, submission, answer flows must verify that the current user owns the submission/student.

5. **Submission validation**  
   - Ensure status is IN_PROGRESS.  
   - Check exam duration; reject late submits.  
   - Add optimistic locking for concurrent submit/answer.

6. **Answer upsert**  
   - Add `findBySubmissionAndQuestion` and upsert logic to avoid duplicate answers.

7. **Add AnswerResponse DTO**  
   - Replace entity-derived Map in AnswerController.

8. **Introduce custom exceptions and global handler**  
   - NotFoundException, ForbiddenException, UnauthorizedException, BadRequestException.  
   - Map to appropriate HTTP status codes.  
   - Handle AccessDeniedException and generic Exception.

9. **Address N+1**  
   - Use `@EntityGraph` or fetch joins in ExamRepository and related repositories.

10. **Move to Flyway**  
    - Replace `ddl-auto: update` with versioned migrations.

11. **Externalize secrets**  
    - Use environment variables for DB password, JWT secret, etc.

---

## 16. Production Readiness Checklist

| Item | Status |
|------|--------|
| Secure authentication | ⚠️ Partial (BCrypt strength, no refresh) |
| RBAC | ❌ |
| Token refresh | ❌ |
| Input validation | ✅ |
| Exception handling | ⚠️ Needs improvement |
| Database indexes | ❌ |
| N+1 prevention | ❌ |
| Test coverage > 80% | ❌ (≈0%) |
| Docker deployment | ❌ |
| Monitoring & alerts | ❌ |
| Secrets from env | ❌ |
| Schema migrations (Flyway) | ❌ |

---

## Appendix: File Reference

| File | Purpose |
|------|---------|
| `backend/.../AnswerController.java` | Entity-derived response |
| `backend/.../AuthService.java` | Login/register, generic exceptions |
| `backend/.../SubmissionService.java` | Submit without validation |
| `backend/.../AnswerService.java` | Always creates; no upsert |
| `backend/.../SecurityConfig.java` | BCrypt strength not used |
| `backend/.../JwtService.java` | JWT generation/validation |
| `backend/.../GlobalExceptionHandler.java` | Limited exception handling |
| `backend/.../CorsConfig.java` | CORS config |
| `frontend/student/.../ExamRoom.jsx` | Answers not persisted, hardcoded studentId |
| `frontend/student/.../api.js` | API client |
| `application.yml`, `application.properties` | Hardcoded secrets |

---

*End of audit report*
