# AI English Exam Grading Platform

Production-ready full-stack system for AI-based English exam grading.

## Tech Stack

### Backend
- Java 21
- Spring Boot 3
- Spring Data JPA
- MySQL
- Lombok
- JWT Authentication

### Frontend
- React 19
- Vite
- React Router
- Axios
- TailwindCSS

## Project Structure

```
aienglishtutor/
├── backend/                 # Spring Boot API
│   └── src/main/java/com/ai/englishsystem/
│       ├── auth/            # Authentication & roles
│       ├── user/
│       ├── student/
│       ├── teacher/
│       ├── classmodule/     # Classes
│       ├── exam/
│       ├── submission/
│       ├── result/
│       ├── ai/              # AI scoring service
│       ├── media/
│       ├── analytics/
│       └── config/
├── frontend/
│   ├── student/             # Student app (port 5173)
│   └── teacher/             # Teacher app (port 5174)
```

## Quick Start

### 1. Database
Create MySQL database:
```sql
CREATE DATABASE englishsystem;
```

Update `backend/src/main/resources/application.yml` if needed:
- `spring.datasource.url`
- `spring.datasource.username`
- `spring.datasource.password`

### 2. Backend
```bash
cd backend
mvn spring-boot:run -Dspring-boot.run.mainClass=com.ai.englishsystem.EnglishSystemApplication
```

API runs at `http://localhost:8080`

### 3. Student Frontend
```bash
cd frontend/student
npm install
npm run dev
```
Runs at `http://localhost:5173`

### 4. Teacher Frontend
```bash
cd frontend/teacher
npm install
npm run dev
```
Runs at `http://localhost:5174`

## REST API

Base URL: `http://localhost:8080/api`

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /auth/login | Login |
| POST | /auth/register | Register |
| GET | /users | List users |
| GET | /users/{id} | Get user |
| POST | /users | Create user |
| PUT | /users/{id} | Update user |
| DELETE | /users/{id} | Delete user |
| GET | /students | List students |
| POST | /students | Create student |
| GET | /teachers | List teachers |
| POST | /teachers | Create teacher |
| GET | /classes | List classes |
| POST | /classes | Create class |
| GET | /exams | List exams |
| GET | /exams/{id} | Get exam with sections |
| POST | /exams | Create exam |
| GET | /questions | List questions |
| POST | /questions | Create question |
| POST | /submissions/start | Start exam |
| POST | /submissions/submit | Submit exam |
| POST | /answers | Save answer |
| POST | /ai/score-writing | AI score writing |
| POST | /ai/score-speaking | AI score speaking |
| GET | /scores/{submissionId} | Get scores |

## Seed Data

On first run, the backend creates default roles: ADMIN, TEACHER, STUDENT.

Create a user via `/api/auth/register` with `roleId: 2` for STUDENT or `roleId: 1` for TEACHER.

## AI Scoring

The AI service evaluates:
- **Writing**: grammar_score, vocabulary_score, coherence_score, overall_score
- **Speaking**: pronunciation_score, fluency_score, grammar_score, overall_score

Production: Replace mock scoring in `AiScoringService` with OpenAI API or similar.
