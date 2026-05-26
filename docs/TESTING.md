# Testing

This project uses a pragmatic test strategy for graduation-project defense:
backend business rules and security are tested first, while frontend and Python
service tests cover the most important smoke paths.

## Backend

Run:

```powershell
cd backend
.\mvnw -q test
```

Current backend tests cover:

- Authentication and public registration rules
- Role-based controller security
- Student/teacher access checks
- Exam and submission flows
- Official exam attempt rules
- AI endpoint overload handling
- AI scoring access control
- Media upload validation and security
- Rate limiting behavior
- Flyway runtime-path guard
- Cache integration
- Concurrency hardening

## Learning Service

Run:

```powershell
cd learningservice
.\mvnw -q test
```

Current learning service tests cover:

- Application context startup
- Spaced repetition policy behavior
- Enrollment and review flow

## Frontend

Run:

```powershell
cd frontend\student
npm run test

cd frontend\teacher
npm run test
```

The frontend tests are intentionally small and focus on:

- Protected route behavior
- Login page rendering
- Basic app smoke rendering

These tests complement manual browser smoke tests and production builds.

## AI Service

Run:

```powershell
cd aiservice
pip install -r requirements.txt -r requirements-dev.txt
pytest
```

The AI service tests cover:

- Health endpoint response
- Missing upload validation
- Empty TTS validation
- Oversized upload rejection

## Manual Smoke Test

```powershell
.\scripts\smoke-browser-local.ps1
```

Use this after starting backend, student frontend, and teacher frontend.

## Gaps

The following are intentionally out of scope for the first graduation-project
hardening pass:

- Full frontend e2e regression suite
- Load testing gates
- MySQL EXPLAIN regression tests
- Real OCR/STT/TTS model quality tests
- JaCoCo coverage threshold enforcement
