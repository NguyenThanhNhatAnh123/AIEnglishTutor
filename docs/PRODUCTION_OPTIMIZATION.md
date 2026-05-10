# Production Optimization Plan

## 1) DB bottlenecks observed and fixes

- **Pool oversizing risk**:
  - Previous sample used `APP_DB_POOL_MAX=80` while default MySQL often has `max_connections=151`.
  - This can starve admin/monitoring connections and increase lock wait pressure.
  - Updated baseline:
    - `APP_DB_POOL_MAX=30`
    - `APP_DB_POOL_MIN_IDLE=10`
    - `APP_DB_POOL_TIMEOUT=5000`
    - `APP_DB_POOL_KEEPALIVE=180000`
    - `APP_DB_VALIDATION_TIMEOUT=2000`

- **Transaction runaway risk**:
  - Added global timeout baseline with `APP_TX_TIMEOUT_SECONDS=30`.
  - Keep write transactions short and avoid doing remote AI calls in the same DB transaction.

- **Constraint collision under concurrency**:
  - Unique constraints exist (`users.email`, `users.username`, `students.student_code`, `teachers.teacher_code`).
  - Pre-checks (`existsBy...`) alone are not enough under race conditions.
  - Keep DB unique constraints as source of truth and monitor `CONFLICT` response rates.

## 2) Recommended production sizing

- Start with:
  - `APP_DB_POOL_MAX = min(30, floor(DB_MAX_CONNECTIONS * 0.6 / instance_count))`
  - `APP_TOMCAT_THREADS=100`
  - `APP_TOMCAT_ACCEPT=200`
  - `APP_TOMCAT_MAX_CONN=500`
- Increase only after load tests confirm DB CPU, lock waits, and pool wait time remain healthy.

## 3) JPA/hibernate tuning enabled

- Enabled defaults:
  - `APP_JPA_BATCH_SIZE=50` (prod sample uses `100`)
  - `hibernate.order_inserts=true`
  - `hibernate.order_updates=true`
  - `hibernate.jdbc.time_zone=UTC`
- Keep `ddl-auto=validate` in production.

## 4) Observability signals to watch

- HTTP latency: `http_server_requests_seconds` P95/P99.
- DB pressure:
  - `hikaricp_connections_active`
  - `hikaricp_connections_pending`
  - `hikaricp_connections_timeout_total`
- Error budget:
  - 5xx rate
  - 409 conflict rate (constraint contention)

## 5) Next hardening steps

- Move in-memory rate limiter to Redis for multi-instance deployments.
- Add explicit retries/circuit breaker around OCR/TTS upstreams.
- Add load test gates in CI:
  - 200 concurrent burst test
  - 15-30 minute soak test
