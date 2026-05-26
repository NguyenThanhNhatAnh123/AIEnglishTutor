# Teacher App

Đây là ứng dụng React/Vite dành cho giáo viên và quản trị viên. Ứng dụng hỗ trợ
đăng nhập, dashboard, quản lý lớp, quản lý sinh viên, quản lý đề thi, ngân hàng
câu hỏi, import câu hỏi bằng OCR, xem kết quả, analytics và hồ sơ cá nhân.

## Chạy Ứng Dụng

```powershell
npm install
npm run dev
```

URL mặc định:

```text
http://localhost:5174
```

Ở môi trường development, app gọi backend chính tại `http://localhost:8080/api`.

## Biến Môi Trường

Có thể tạo `.env.local`:

```env
VITE_API_BASE_URL=http://localhost:8080/api
VITE_BASE_PATH=
```

Khi build qua Docker/Nginx, ứng dụng được phục vụ dưới `/teacher/` và API được
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
- `/dashboard`
- `/classes`
- `/students`
- `/exams`
- `/questions`
- `/ocr`
- `/results`
- `/analytics`
- `/profile`
