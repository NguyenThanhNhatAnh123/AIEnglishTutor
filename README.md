# AI English Tutor

AI English Tutor is a graduation-project web system for English exam management,
student exam taking, AI-assisted grading, and vocabulary learning.

## Stack

- Frontend: React 19, Vite, Tailwind CSS
- Backend API: Java 21, Spring Boot 3.3, Spring Security, Spring Data JPA
- Learning service: Java 21, Spring Boot 3.3
- AI/data service: Python 3.11, FastAPI, Whisper/OCR/TTS integrations
- Database: MySQL 8 with Flyway migrations
- Cache/rate limiting: Redis
- Local gateway/monitoring: Nginx, Prometheus

## Repository Layout

```text
backend/          Main exam, auth, grading, media, analytics API
learningservice/  Vocabulary decks and spaced repetition API
aiservice/        OCR, TTS, and speech-to-text service
frontend/student/ Student-facing React app
frontend/teacher/ Teacher/admin React app
frontend/packages Shared frontend utilities and UI components
database/         Database-related assets
docs/             Architecture, deployment, and testing notes
nginx/            Local gateway and static frontend hosting
prometheus/       Prometheus scrape configuration
scripts/          Smoke-test scripts
```

## Prerequisites

- Java 21
- Maven 3.9+ or the included Maven wrappers
- Node.js 22+
- Python 3.11+
- MySQL 8
- Redis 7, optional for local development but recommended for the Docker stack
- FFmpeg and Tesseract for local AI/media processing

## Environment

Copy the sample environment file and fill in local values:

```powershell
Copy-Item backend\.env.example backend\.env
```

Minimum useful values:

```env
APP_DB_URL=jdbc:mysql://localhost:3306/ai_english_exam?useSSL=false&serverTimezone=UTC&allowPublicKeyRetrieval=true
APP_DB_USERNAME=root
APP_DB_PASSWORD=change_me
APP_JWT_SECRET=replace_with_a_long_random_secret_at_least_64_bytes
APP_REDIS_PASSWORD=replace_with_redis_password
APP_DEEPSEEK_API_KEY=
APP_AI_LOCAL_URL=http://127.0.0.1:8002
```

The learning service uses the same JWT secret because students authenticate in
the main backend and then call learning APIs with the same token.

## Run Locally

Start MySQL and create the databases:

```sql
CREATE DATABASE IF NOT EXISTS ai_english_exam CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE DATABASE IF NOT EXISTS ai_english_learning CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

Start the AI service:

```powershell
cd aiservice
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn app:app --host 127.0.0.1 --port 8002
```

Start the main backend:

```powershell
cd backend
.\mvnw spring-boot:run
```

Start the learning service:

```powershell
cd learningservice
.\mvnw spring-boot:run
```

Start the student app:

```powershell
cd frontend\student
npm install
npm run dev
```

Start the teacher app:

```powershell
cd frontend\teacher
npm install
npm run dev
```

Default local URLs:

- Student app: http://localhost:5173
- Teacher app: http://localhost:5174
- Backend health: http://localhost:8080/actuator/health
- Learning health: http://localhost:8081/actuator/health
- Backend Swagger UI: http://localhost:8080/swagger-ui/index.html
- Learning Swagger UI: http://localhost:8081/swagger-ui/index.html
- AI service health: http://localhost:8002/health

## Run With Docker Compose

```powershell
Copy-Item backend\.env.example backend\.env
docker compose up -d --build
```

The Nginx gateway is exposed at:

- http://localhost:8088/student/
- http://localhost:8088/teacher/
- http://localhost:8088/api/
- http://localhost:8088/api/learning/

See [docs/DOCKER_DEPLOYMENT.md](docs/DOCKER_DEPLOYMENT.md) for details.

## Tests And Builds

Backend tests:

```powershell
cd backend
.\mvnw -q test
```

Learning service tests:

```powershell
cd learningservice
.\mvnw -q test
```

Student app:

```powershell
cd frontend\student
npm run build
npm run test
```

Teacher app:

```powershell
cd frontend\teacher
npm run build
npm run test
```

AI service tests:

```powershell
cd aiservice
pip install -r requirements.txt -r requirements-dev.txt
pytest
```

## Demo Notes

For graduation defense, the recommended demo path is:

1. Show Swagger UI and explain REST APIs.
2. Log in as teacher and create/manage an exam.
3. Log in as student and take the exam.
4. Submit writing or speaking answers.
5. Show AI-assisted review and teacher approval flow.
6. Open the learning module and demonstrate spaced repetition review.
7. Show Flyway migrations, automated tests, and Docker Compose stack.

## Documentation

- [Architecture](docs/ARCHITECTURE.md)
- [Testing](docs/TESTING.md)
- [Security](docs/SECURITY.md)
- [Database design](docs/DATABASE.md)
- [Docker deployment](docs/DOCKER_DEPLOYMENT.md)
- [Production optimization notes](docs/PRODUCTION_OPTIMIZATION.md)
