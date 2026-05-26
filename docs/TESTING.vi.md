# Kiểm Thử

Tài liệu này mô tả chiến lược kiểm thử của AI English Tutor ở phạm vi khóa luận.
Ưu tiên là kiểm thử các nghiệp vụ backend, phân quyền, luồng bài thi và các
smoke test quan trọng cho frontend/Python service.

## Backend Chính

Chạy test:

```powershell
cd backend
.\mvnw -q test
```

Các nhóm test hiện có:

- Đăng nhập và đăng ký tài khoản
- Bảo mật controller theo role
- Kiểm tra quyền truy cập sinh viên/giáo viên
- Luồng đề thi và bài làm
- Quy tắc số lần làm bài thi chính thức
- Xử lý quá tải endpoint AI
- Kiểm tra quyền khi chấm điểm AI
- Validate upload media và bảo mật media
- Rate limiting
- Kiểm tra Flyway runtime path
- Cache integration
- Kiểm thử concurrency

## Learning Service

Chạy test:

```powershell
cd learningservice
.\mvnw -q test
```

Các nhóm test hiện có:

- Khởi động application context
- Chính sách spaced repetition
- Luồng enroll deck và review từ vựng

## Frontend

Chạy test:

```powershell
cd frontend\student
npm run test

cd frontend\teacher
npm run test
```

Test frontend hiện tập trung vào:

- Kiểm tra điều hướng khi chưa đăng nhập
- Render trang login của student app
- Render trang login của teacher app

Đây là smoke test nhỏ, đủ để chứng minh frontend có kiểm thử tự động cơ bản và
bổ sung cho kiểm thử thủ công trên trình duyệt.

## AI Service

Chạy test:

```powershell
cd aiservice
pip install -r requirements.txt -r requirements-dev.txt
pytest
```

Test AI service hiện kiểm tra:

- Endpoint `/health` trả về trạng thái ok
- Validate khi thiếu file upload
- Validate TTS khi text rỗng
- Từ chối upload vượt quá giới hạn kích thước

Các test này không gọi model OCR/STT/TTS nặng, giúp test chạy nhanh và ổn định.

## Smoke Test Thủ Công

```powershell
.\scripts\smoke-browser-local.ps1
```

Chạy script này sau khi đã khởi động backend, student frontend và teacher
frontend.

## Kết Quả Xác Minh Gần Nhất

Các lệnh đã chạy thành công:

- `backend`: `mvn -q test`
- `learningservice`: `mvn -q test`
- `frontend/student`: `npm run test`, `npm run build`
- `frontend/teacher`: `npm run test`, `npm run build`
- `aiservice`: `python -m pytest`, kết quả 4 tests passed

## Các Phần Chưa Bao Phủ

Các nội dung sau chưa nằm trong phạm vi hardening tuần 1-4:

- Bộ test e2e frontend đầy đủ
- Load test tự động
- Kiểm thử EXPLAIN plan trên MySQL thật
- Kiểm thử chất lượng thực tế của OCR/STT/TTS
- Ngưỡng coverage bắt buộc bằng JaCoCo
