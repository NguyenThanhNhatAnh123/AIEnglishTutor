# Bảo Mật

Tài liệu này tóm tắt thiết kế bảo mật của AI English Tutor ở phạm vi khóa luận
tốt nghiệp.

## Xác Thực

Hệ thống sử dụng JWT stateless:

- Người dùng đăng nhập qua `POST /api/auth/login`.
- Backend kiểm tra mật khẩu bằng BCrypt.
- Backend trả về access token và thông tin người dùng.
- React app gửi token qua header `Authorization: Bearer <token>`.
- Learning service dùng cùng JWT secret để sinh viên có thể truy cập API học từ
  vựng sau khi đăng nhập qua backend chính.

## Phân Quyền

Hệ thống phân quyền theo role:

- `STUDENT`: xem đề thi đang mở, bắt đầu/nộp bài của chính mình, xem kết quả của
  chính mình, upload bài nói và sử dụng module học từ vựng.
- `TEACHER`: quản lý lớp, sinh viên, đề thi, câu hỏi, media và chấm/duyệt bài
  thuộc phạm vi của giáo viên.
- `ADMIN`: truy cập các chức năng quản trị.

Spring Security bảo vệ các API không public. Nhiều endpoint dùng
`@PreAuthorize`. Ngoài ra, tầng service còn kiểm tra ownership để đảm bảo người
dùng không truy cập dữ liệu không thuộc quyền của mình.

## Kiểm Tra Dữ Liệu Đầu Vào

Các API Java dùng Bean Validation như `@Valid`, `@NotBlank`, `@NotNull`,
`@Email`, `@Size`.

AI service bằng Python kiểm tra:

- Thiếu file upload
- File vượt quá giới hạn kích thước
- Text TTS rỗng
- Cấu trúc request OCR/TTS cơ bản

## Bảo Mật Upload File

Backend kiểm tra kích thước và content type của file. Một số luồng ảnh/PDF/audio
còn kiểm tra magic bytes để tránh tin hoàn toàn vào tên file hoặc MIME type do
client gửi.

File upload được lưu trong thư mục kiểm soát bởi hệ thống và dùng tên file sinh
tự động, không phụ thuộc vào tên file gốc của người dùng.

## CORS Và CSRF

CORS được cấu hình bằng biến môi trường. CSRF được tắt vì API là REST stateless,
xác thực bằng bearer token, không dùng session cookie truyền thống.

## Rate Limiting

Backend có `RateLimitFilter` với hai chế độ:

- In-memory cho local development
- Redis-backed cho Docker/prod-like stack

Các endpoint AI nặng có giới hạn chặt hơn endpoint thông thường.

## Hardening Ở Gateway

Nginx đã bổ sung các security headers cơ bản:

- `X-Content-Type-Options`
- `X-Frame-Options`
- `Referrer-Policy`
- `Permissions-Policy`
- `Content-Security-Policy`

Trong Docker Compose, AI service mặc định bind về `127.0.0.1`, tránh mở rộng ra
toàn bộ host network.

## Quản Lý Secrets

Các giá trị nhạy cảm nên đặt trong `backend/.env` hoặc biến môi trường:

- Mật khẩu database
- JWT secret
- Redis password
- API key của AI provider

File `.env.example` chỉ chứa placeholder.

## Giới Hạn Ở Phạm Vi Khóa Luận

Các giới hạn sau nên trình bày trung thực trong báo cáo:

- JWT đang lưu trong localStorage để đơn giản hóa triển khai demo.
- Swagger UI đang public trong môi trường local/demo để thuận tiện bảo vệ.
- CSP vẫn cho phép inline style vì frontend hiện tại cần tương thích với setup
  UI/Tailwind.
- Dependency audit của npm vẫn còn cảnh báo.
- AI service đang xử lý bằng HTTP đồng bộ, chưa chuyển sang job queue.

## Hướng Cải Thiện Khi Triển Khai Production

- Chuyển lưu token sang HttpOnly Secure SameSite cookie hoặc refresh-token
  rotation.
- Bảo vệ Swagger UI ngoài môi trường local/demo.
- Thêm quét CVE dependency trong CI.
- Dùng object storage cho media upload.
- Chuyển AI processing sang background job queue.
- Thêm centralized logging và alerting.
