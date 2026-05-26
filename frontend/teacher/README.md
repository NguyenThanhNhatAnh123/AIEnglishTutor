# Teacher App

React/Vite application for teachers and administrators. It supports login,
dashboard, class management, student management, exam management, question bank,
OCR question import, results review, analytics, and profile management.

## Run

```powershell
npm install
npm run dev
```

Default URL:

```text
http://localhost:5174
```

The app calls the main backend at `http://localhost:8080/api` in development.

## Environment

Optional `.env.local` values:

```env
VITE_API_BASE_URL=http://localhost:8080/api
VITE_BASE_PATH=
```

For the Docker/Nginx gateway build, the app is served under `/teacher/` and API
requests are proxied through `/api`.

## Scripts

```powershell
npm run dev
npm run build
npm run lint
npm run test
```

## Main Routes

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
