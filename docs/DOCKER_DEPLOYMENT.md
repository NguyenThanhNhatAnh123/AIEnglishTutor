# Docker Deployment Guide

## 1) Included sample stack

`docker-compose.yml` now provides a production-like local stack:

- `mysql` (persistent volume + healthcheck)
- `backend` (Spring Boot + Flyway + healthcheck)
- `nginx` (reverse proxy, `/api`, `/actuator/health`, `/actuator/prometheus`)
- `prometheus` (scrape backend metrics)

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

## 3) Smoke checks

- Backend health: `http://localhost:8080/actuator/health`
- Prometheus scrape: `http://localhost:8080/actuator/prometheus`
- Nginx gateway: `http://localhost/`
- Prometheus UI: `http://localhost:9090`

Browser smoke (teacher/student + backend local):

```powershell
.\scripts\smoke-browser-local.ps1
```

## 4) Environment variables to override

At minimum:

```bash
APP_JWT_SECRET=replace_with_64_byte_secret
APP_CORS_ORIGINS=https://student.example.com,https://teacher.example.com
APP_DEEPSEEK_API_KEY=replace_if_enabled
APP_WHISPER_API_KEY=
APP_OCR_SPACE_API_KEY=
```

Pool + transaction defaults are tuned to safer baselines:

- `APP_DB_POOL_MAX=30`
- `APP_DB_POOL_MIN_IDLE=10`
- `APP_TX_TIMEOUT_SECONDS=30`
- `APP_JPA_BATCH_SIZE=100`

## 5) Rollback strategy

- Keep previous backend image tags.
- Flyway migrations are forward-only; roll back app image first.
- Use DB rollback scripts only with explicit migration plans.
