# Student App

React/Vite application for students. It supports login, registration, dashboard,
exam list, exam taking, result review, submission history, profile, and
vocabulary learning.

## Run

```powershell
npm install
npm run dev
```

Default URL:

```text
http://localhost:5173
```

The app calls the main backend at `http://localhost:8080/api` in development.
The learning module calls `http://localhost:8081/api` unless
`VITE_LEARNING_API_URL` is configured.

## Environment

Optional `.env.local` values:

```env
VITE_API_BASE_URL=http://localhost:8080/api
VITE_LEARNING_API_URL=http://localhost:8081/api
VITE_BASE_PATH=
```

For the Docker/Nginx gateway build, the app is served under `/student/` and API
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
- `/register`
- `/dashboard`
- `/exams`
- `/exam/:id`
- `/result/:submissionId`
- `/submissions`
- `/learning`
- `/profile`
