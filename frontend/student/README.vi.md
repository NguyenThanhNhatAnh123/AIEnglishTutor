# Student App

Đây là ứng dụng React/Vite dành cho sinh viên. Ứng dụng hỗ trợ đăng nhập, đăng
ký, dashboard, danh sách đề thi, làm bài, xem kết quả, lịch sử nộp bài, hồ sơ cá
nhân và học từ vựng.

## Chạy Ứng Dụng

```powershell
npm install
npm run dev
```

URL mặc định:

```text
http://localhost:5173
```

Ở môi trường development, app gọi backend chính tại `http://localhost:8080/api`.
Module học từ vựng gọi `http://localhost:8081/api` nếu không cấu hình
`VITE_LEARNING_API_URL`.

## Biến Môi Trường

Có thể tạo `.env.local`:

```env
VITE_API_BASE_URL=http://localhost:8080/api
VITE_LEARNING_API_URL=http://localhost:8081/api
VITE_BASE_PATH=
```

Khi build qua Docker/Nginx, ứng dụng được phục vụ dưới `/student/` và API được
proxy qua `/api`.

## Scripts

```powershell
npm run dev
npm run build
npm run lint
npm run test
```

## Các Route Chính

- `/login`
- `/register`
- `/dashboard`
- `/exams`
- `/exam/:id`
- `/result/:submissionId`
- `/submissions`
- `/learning`
- `/profile`
