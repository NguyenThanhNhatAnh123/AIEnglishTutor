# Rà Soát Sẵn Sàng Cho Báo Cáo Khóa Luận

Tài liệu này tổng hợp tình trạng hiện tại của hệ thống sau các phần hardening
tuần 1-4 và đề xuất những nội dung nên bổ sung để báo cáo/bảo vệ thuận lợi hơn.

## Những Phần Đã Sẵn Sàng Đưa Vào Báo Cáo

| Hạng mục | Trạng thái | Ghi chú |
|---|---|---|
| Kiến trúc tổng thể | Đạt | Có tài liệu kiến trúc và sơ đồ Mermaid |
| API documentation | Đạt | Có Swagger UI cho backend và learningservice |
| Database migration | Đạt | Flyway cho cả hai service Java |
| Backend tests | Tốt | Có test security, access control, exam flow, media, concurrency |
| Frontend tests | Cơ bản | Có smoke test cho student/teacher routing |
| AI service tests | Cơ bản | Có pytest cho health và validation |
| Docker Compose | Đạt | Có backend, learningservice, aiservice, Redis, Nginx, Prometheus |
| Security hardening demo | Đạt | Có JWT, role-based auth, CORS, rate limit, upload validation, security headers |
| Code splitting frontend | Đạt | Đã tách route/page chunks, giảm entry bundle rõ rệt |
| CI workflow | Đạt | Có GitHub Actions test/build cơ bản |

## Các Điểm Nên Trình Bày Nổi Bật

1. Hệ thống không chỉ là CRUD, mà có nhiều miền nghiệp vụ: exam, grading, media,
   AI feedback và spaced repetition.
2. Backend có phân tầng rõ: Controller, Service, Repository, DTO, Entity.
3. Có kiểm soát schema bằng Flyway thay vì để Hibernate tự tạo bảng ở production.
4. Có kiểm thử tự động ở nhiều tầng: Java, React và Python.
5. Có Swagger UI giúp hội đồng xem API trực tiếp.
6. Có tối ưu frontend bằng lazy loading/code splitting và có số liệu build trước/sau.
7. Có bảo mật cơ bản theo OWASP: authentication, authorization, validation,
   upload validation, rate limiting, CORS, security headers.

## Các Phần Nên Bổ Sung Vào Slide

- Sơ đồ kiến trúc component.
- Sơ đồ luồng đăng nhập.
- Sơ đồ luồng làm bài thi.
- Sơ đồ luồng AI hỗ trợ chấm writing/speaking.
- Sơ đồ quan hệ database chính.
- Ảnh Swagger UI.
- Bảng kết quả test gần nhất.
- Bảng so sánh bundle size trước/sau code splitting.
- Một slide riêng về giới hạn hiện tại và hướng phát triển.

## Các Cải Thiện Nên Làm Nếu Còn Thời Gian

### Ưu tiên cao

1. Tạo seed data/demo account rõ ràng cho giáo viên và sinh viên.
2. Viết `docs/DEMO_SCRIPT.vi.md` mô tả từng bước demo khi bảo vệ.
3. Chụp màn hình các màn hình chính: dashboard, exam list, exam room, OCR,
   result review, learning.
4. Thêm sơ đồ ERD đơn giản trong báo cáo.
5. Chạy `npm audit` và ghi nhận các cảnh báo dependency trong phần hạn chế.

### Ưu tiên trung bình

1. Thêm một test frontend cho login form submit mock API.
2. Thêm một e2e smoke test bằng Playwright cho luồng login giả lập.
3. Thêm JaCoCo coverage report cho backend để có số liệu coverage.
4. Chụp EXPLAIN plan cho 2-3 truy vấn chính.
5. Thêm endpoint hoặc script tạo dữ liệu demo nhanh.

### Có thể để hướng phát triển

1. Chuyển AI processing sang message queue.
2. Chuyển upload file sang object storage.
3. Thêm refresh token hoặc HttpOnly cookie.
4. Thêm Kubernetes/Terraform.
5. Thêm centralized logging và alerting đầy đủ.

## Các Điểm Cần Nói Trung Thực Khi Bảo Vệ

- Hệ thống hiện phù hợp demo/khóa luận, chưa phải production HA.
- JWT còn lưu ở localStorage để giảm độ phức tạp triển khai.
- AI service xử lý đồng bộ qua HTTP, phù hợp demo nhưng chưa tối ưu cho tải lớn.
- Frontend đã code split nhưng một số chunk như Learning vẫn còn lớn do asset và
  thư viện animation/audio.
- CI đã có test/build cơ bản, chưa có deploy tự động.

## Checklist Trước Ngày Bảo Vệ

- Chạy `mvn -q test` cho backend.
- Chạy `mvn -q test` cho learningservice.
- Chạy `npm run test` và `npm run build` cho student app.
- Chạy `npm run test` và `npm run build` cho teacher app.
- Chạy `python -m pytest` cho aiservice.
- Start Docker Compose và kiểm tra `/student/`, `/teacher/`, `/api`, `/api/learning`.
- Kiểm tra Swagger UI của backend và learningservice.
- Chuẩn bị sẵn tài khoản demo.
- Chuẩn bị sẵn dữ liệu demo để tránh mất thời gian nhập tay.
