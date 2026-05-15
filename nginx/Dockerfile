FROM node:22-alpine AS student-build
WORKDIR /app
COPY frontend/student/package*.json frontend/student/
COPY frontend/packages frontend/packages
RUN cd frontend/student && npm ci
COPY frontend/student/index.html frontend/student/vite.config.js frontend/student/postcss.config.js frontend/student/tailwind.config.js frontend/student/
COPY frontend/student/public frontend/student/public
COPY frontend/student/src frontend/student/src
RUN cd frontend/student && VITE_BASE_PATH=/student VITE_API_BASE_URL=/api npm run build

FROM node:22-alpine AS teacher-build
WORKDIR /app
COPY frontend/teacher/package*.json frontend/teacher/
COPY frontend/packages frontend/packages
RUN cd frontend/teacher && npm ci
COPY frontend/teacher/index.html frontend/teacher/vite.config.js frontend/teacher/postcss.config.js frontend/teacher/tailwind.config.js frontend/teacher/
COPY frontend/teacher/public frontend/teacher/public
COPY frontend/teacher/src frontend/teacher/src
RUN cd frontend/teacher && VITE_BASE_PATH=/teacher VITE_API_BASE_URL=/api npm run build

FROM nginx:1.27-alpine

COPY nginx/nginx.conf /etc/nginx/nginx.conf
COPY --from=student-build /app/frontend/student/dist /usr/share/nginx/html/student
COPY --from=teacher-build /app/frontend/teacher/dist /usr/share/nginx/html/teacher
