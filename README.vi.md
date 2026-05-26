# AI English Tutor

AI English Tutor là hệ thống web phục vụ khóa luận tốt nghiệp, hỗ trợ quản lý
bài thi tiếng Anh, làm bài trực tuyến, chấm điểm có hỗ trợ AI và học từ vựng
theo phương pháp lặp lại ngắt quãng.

## Công Nghệ Sử Dụng

- Frontend: React 19, Vite, Tailwind CSS
- Backend API: Java 21, Spring Boot 3.3, Spring Security, Spring Data JPA
- Learning service: Java 21, Spring Boot 3.3
- AI/data service: Python 3.11, FastAPI, Whisper/OCR/TTS
- Cơ sở dữ liệu: MySQL 8, quản lý schema bằng Flyway
- Cache/rate limiting: Redis
- Gateway và giám sát local: Nginx, Prometheus

## Cấu Trúc Thư Mục

```text
backend/          API chính: auth, exam, submission, grading, media, analytics
learningservice/  API học từ vựng và spaced repetition
aiservice/        Dịch vụ OCR, TTS, speech-to-text
frontend/student/ Giao diện sinh viên
frontend/teacher/ Giao diện giáo viên/quản trị
frontend/packages Thành phần frontend dùng chung
docs/             Tài liệu kiến trúc, kiểm thử, triển khai
nginx/            Gateway và static hosting
prometheus/       Cấu hình Prometheus
scripts/          Script smoke test
```

## Yêu Cầu Môi Trường

- Java 21
- Maven 3.9+ hoặc Maven wrapper đi kèm
- Node.js 22+
- Python 3.11+
- MySQL 8
- Redis 7, khuyến nghị khi chạy bằng Docker Compose
- FFmpeg và Tesseract cho xử lý media/AI local

## Cấu Hình Môi Trường

Sao chép file cấu hình mẫu:

```powershell
Copy-Item backend\.env.example backend\.env
```

Các biến tối thiểu nên cấu hình:

```env
APP_DB_URL=jdbc:mysql://localhost:3306/ai_english_exam?useSSL=false&serverTimezone=UTC&allowPublicKeyRetrieval=true
APP_DB_USERNAME=root
APP_DB_PASSWORD=change_me
APP_JWT_SECRET=replace_with_a_long_random_secret_at_least_64_bytes
APP_REDIS_PASSWORD=replace_with_redis_password
APP_DEEPSEEK_API_KEY=
APP_AI_LOCAL_URL=http://127.0.0.1:8002
```

Learning service dùng chung JWT secret với backend chính vì sinh viên đăng nhập
qua backend rồi gọi API học từ vựng bằng cùng token.

## Chạy Local

Tạo database MySQL:

```sql
CREATE DATABASE IF NOT EXISTS ai_english_exam CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE DATABASE IF NOT EXISTS ai_english_learning CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

Chạy AI service:

```powershell
cd aiservice
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn app:app --host 127.0.0.1 --port 8002
```

Chạy backend chính:

```powershell
cd backend
.\mvnw spring-boot:run
```

Chạy learning service:

```powershell
cd learningservice
.\mvnw spring-boot:run
```

Chạy student app:

```powershell
cd frontend\student
npm install
npm run dev
```

Chạy teacher app:

```powershell
cd frontend\teacher
npm install
npm run dev
```

Các URL mặc định:

- Student app: http://localhost:5173
- Teacher app: http://localhost:5174
- Backend health: http://localhost:8080/actuator/health
- Learning health: http://localhost:8081/actuator/health
- Backend Swagger UI: http://localhost:8080/swagger-ui/index.html
- Learning Swagger UI: http://localhost:8081/swagger-ui/index.html
- AI service health: http://localhost:8002/health

## Chạy Bằng Docker Compose

```powershell
Copy-Item backend\.env.example backend\.env
docker compose up -d --build
```

Nginx gateway:

- http://localhost:8088/student/
- http://localhost:8088/teacher/
- http://localhost:8088/api/
- http://localhost:8088/api/learning/

## Chạy Test Và Build

Backend:

```powershell
cd backend
.\mvnw -q test
```

Learning service:

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

AI service:

```powershell
cd aiservice
pip install -r requirements.txt -r requirements-dev.txt
pytest
```

## Gợi Ý Kịch Bản Demo Khóa Luận

1. Mở Swagger UI và giới thiệu các API chính.
2. Đăng nhập giáo viên, tạo lớp, tạo đề thi và câu hỏi.
3. Đăng nhập sinh viên và làm bài thi.
4. Nộp bài viết hoặc bài nói.
5. Trình bày luồng AI hỗ trợ chấm điểm và giáo viên duyệt kết quả.
6. Mở module học từ vựng và demo spaced repetition.
7. Trình bày Flyway migrations, test tự động và Docker Compose.

## Tài Liệu Liên Quan

- [Kiến trúc hệ thống](docs/ARCHITECTURE.vi.md)
- [Kiểm thử](docs/TESTING.vi.md)
- [Bảo mật](docs/SECURITY.vi.md)
- [Thiết kế cơ sở dữ liệu](docs/DATABASE.vi.md)
- [Rà soát sẵn sàng bảo vệ](docs/GRADUATION_READINESS.vi.md)
- [Docker deployment](docs/DOCKER_DEPLOYMENT.md)
- [Production optimization notes](docs/PRODUCTION_OPTIMIZATION.md)
