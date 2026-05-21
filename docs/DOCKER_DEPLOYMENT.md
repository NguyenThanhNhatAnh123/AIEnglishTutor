# Docker Deployment Guide

## 1) Included sample stack

`docker-compose.yml` now provides a production-like local stack:

- `backend` (Spring Boot + Flyway + healthcheck)
- `aiservice` (local OCR/TTS/STT service with Whisper preload)
- `redis` (rate-limit counters with password + healthcheck)
- Spring Cache (roles and teacher list) backed by Redis in `prod`
- `nginx` (student/teacher static bundles, `/api`, `/uploads`, `/actuator/health`, `/actuator/prometheus`)
- `prometheus` (scrape backend metrics)
- Optional `mysql` container behind the `docker-db` profile

Related files:

- `backend/Dockerfile`
- `nginx/Dockerfile`
- `nginx/nginx.conf`
- `prometheus/prometheus.yml`

## 2) Build and run

Build backend jar first:

```bash
cd backend
./mvnw clean package -DskipTests
```

Start stack:

```bash
cd ..
docker compose up -d --build
```

Copy `backend/.env.example` to `backend/.env` and set at least `APP_JWT_SECRET`, `APP_DB_PASSWORD`, and `APP_REDIS_PASSWORD` before `docker compose up`. The backend and Redis services read this file directly.

By default, backend connects to the host MySQL at `host.docker.internal:3306`, database `ai_english_exam`, user `root`. Nginx is published on host port `8088` to avoid Windows/IIS/HTTP.sys bindings on `80`.
The backend service loads `backend/.env` for provider secrets such as `APP_DEEPSEEK_API_KEY`; explicit Docker Compose values still override local-only values like `APP_AI_LOCAL_URL` so container traffic uses `http://aiservice:8002`.
Teacher listening uploads are stored under `/uploads/audio/listening/` (public exam prompts). Legacy `/api/media/files/**` requires JWT.
Uploaded media is bind-mounted from the project `uploads/` directory into `/app/uploads`, which keeps `/uploads/**` writable for the non-root backend container user.

To use the optional Docker MySQL instead, start with the `docker-db` profile and override `APP_DB_URL=jdbc:mysql://mysql:3306/ai_english_exam?...`, `APP_DB_USERNAME`, and `APP_DB_PASSWORD`.

## 3) Smoke checks

- Backend health: `http://localhost:8080/actuator/health`
- Prometheus scrape: `http://localhost:8080/actuator/prometheus`
- Nginx gateway: `http://localhost:8088/`
- Prometheus UI: `http://localhost:9090`

Browser smoke (teacher/student + backend local):

```powershell
.\scripts\smoke-browser-local.ps1
```

## 4) Environment variables to override

At minimum:

```bash
APP_DB_PASSWORD=change_me
APP_DB_USERNAME=root
APP_DB_PORT=3306
APP_DB_NAME=ai_english_exam
NGINX_HTTP_PORT=8088
APP_JWT_SECRET=generate_with_openssl_rand_base64_64
APP_REDIS_PASSWORD=change_me
APP_CACHE_TYPE=redis
APP_CACHE_ROLES_TTL_SECONDS=3600
APP_CACHE_TEACHERS_TTL_SECONDS=300
APP_CORS_ALLOWED_ORIGINS=https://your-domain.example
APP_DEEPSEEK_API_KEY=replace_if_enabled
APP_WHISPER_API_KEY=
APP_OCR_SPACE_API_KEY=
```

Nginx serves the student app under `/student/`, the teacher app under `/teacher/`, proxies API calls through `/api/`, and proxies uploaded media through `/uploads/`.

Pool + transaction defaults are tuned to safer baselines:

- `APP_DB_POOL_MAX=30`
- `APP_DB_POOL_MIN_IDLE=10`
- `APP_TX_TIMEOUT_SECONDS=30`
- `APP_JPA_BATCH_SIZE=100`

## 5) Rollback strategy

- Keep previous backend image tags.
- Flyway migrations are forward-only; roll back app image first.
- Use DB rollback scripts only with explicit migration plans.
