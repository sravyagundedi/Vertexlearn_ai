# VertexLearn AI — Comprehensive Technical & Functionality Audit

Date of Audit: October 2026  
Status: Production Refactoring in Progress  
Target: Transform VertexLearn AI from hybrid development prototype to fully functional, end-to-end production software.

---

## 1. Complete Feature Matrix

| Feature | Frontend | API | Backend | Database | AI Required | Real Data | Status |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :--- |
| **Authentication & Authorization** | YES | YES | YES | YES | N/A | YES | **Functional** (JWT, bcrypt, roles: student, instructor, admin) |
| **Curated Course Catalog** | YES | YES | YES | YES | N/A | YES | **Functional** (Search, category filter, difficulty filter, sorting) |
| **Course Details & Curriculum** | YES | YES | YES | YES | N/A | YES | **Functional** (Modules, lectures, objectives, prerequisites) |
| **Course Enrollment System** | YES | YES | YES | YES | N/A | YES | **Functional** (Enrollment gates, user isolation, progress linking) |
| **Video Player & Playback Progress** | YES | YES | YES | YES | N/A | YES | **Functional** (YouTube embed, resume playback, `lecture_progress` sync) |
| **Course-Grounded AI Tutor (RAG)** | YES | YES | YES | YES | YES | YES | **Functional** (Course RAG retrieval with verified pgvector embeddings; returns 503 configuration error when unconfigured, no mock fallbacks) |
| **Concise AI Summaries** | YES | YES | YES | YES | YES | YES | **Functional** (Generates from lecture transcripts; returns 503 configuration error when unconfigured, no mock fallbacks) |
| **Automated AI Quizzes** | YES | YES | YES | YES | YES | YES | **Functional** (Grounded MCQ generation; returns 503 configuration error when unconfigured, no mock fallbacks) |
| **Interactive 3D Flashcards** | YES | YES | YES | YES | YES | YES | **Functional** (3D flip animation, spaced repetition review tracking, DB persistence) |
| **Personalized Learning Profile** | YES | YES | YES | YES | N/A | YES | **Functional** (Calculated from real quiz scores, failed attempts, and difficult flashcards) |
| **Smart Study Plans** | YES | YES | YES | YES | OPTIONAL | YES | **Functional** (Curriculum schedule, task toggles, PostgreSQL persistence) |
| **Progress & Mastery Dashboard** | YES | YES | YES | YES | N/A | YES | **Functional** (Real lecture completions, streak calculations, quiz averages, study time) |
| **Instructor Workspace** | YES | YES | YES | YES | N/A | YES | **Functional** (Course creation, analytics overview, student count) |
| **Admin Content Governance** | YES | YES | YES | YES | N/A | YES | **Functional** (Approval/rejection queue, platform metrics, user counts) |

---

## 2. Audit Findings: Demo / Mock / Fallback Functionality Identified

The audit identified specific locations where the application currently uses fallback demo text when the external AI provider is not configured:

### A. AI Service (`ai-service/app/core/llm.py`)
- **Issue**: `educational_context_answer(user)` contains ~150 lines of canned markdown responses (e.g., explaining REST APIs or supervised learning).
- **Rule Violation**: Pretends the AI service succeeded and returned a real Claude completion when `ANTHROPIC_API_KEY` is missing.
- **Required Fix**: Remove `educational_context_answer`. When `ANTHROPIC_API_KEY` is missing or invalid, raise an HTTP 503 error with error code `AI_NOT_CONFIGURED` and the message:  
  `"AI service is not configured. Add the required AI provider API key (ANTHROPIC_API_KEY) to the environment configuration."`

### B. AI Service Routers (`ai-service/app/routers/content.py`)
- **Issue**: For `/ai/generate-quiz` and `/ai/flashcards`, if the LLM output is empty or missing, hardcoded fallback question/card banks are returned.
- **Rule Violation**: Silent fallback to canned questions instead of notifying the user of missing configuration.
- **Required Fix**: When LLM generation is unavailable, raise HTTP 503 `AI_NOT_CONFIGURED`.

### C. Backend API Server (`backend/src/server.ts`)
- **Issue 1**: `localGroundedChatFallback` at line 1726 contains canned responses with `[Notice: Running in Development AI Mode - Grounded in Course Content]`.
- **Issue 2**: `POST /api/v1/ai/generate-quiz` contains hardcoded fallback questions at lines 2077–2130.
- **Issue 3**: `POST /api/v1/ai/summarize` contains hardcoded fallback summary at line 2217.
- **Issue 4**: `POST /api/v1/ai/generate-flashcards` contains hardcoded fallback flashcards at lines 2420–2455.
- **Rule Violation**: Silently masks AI service failure with static sample data.
- **Required Fix**: Eliminate all fake fallback generators. When the AI service returns 503 or is unavailable, return an explicit error:
  ```json
  {
    "error": {
      "code": "AI_NOT_CONFIGURED",
      "message": "AI service is not configured. Add the required AI provider API key to the environment configuration."
    }
  }
  ```

### D. Frontend Landing Page (`frontend/src/pages/Landing.tsx`)
- **Issue**: Lines 36–60 contains fallback courses with IDs `c1`, `c2`, `c3` and "Demo Instructor" if the API fetch fails.
- **Rule Violation**: If a user clicks `c1`, it routes to `/courses/c1`, which 404s because `c1` does not exist in PostgreSQL.
- **Required Fix**: Remove hardcoded fallback objects. Display clean loading/empty/error states.

### E. Frontend Error Banners
- **Issue**: When AI fails, the frontend displays generic messages like `"AI Tutor is temporarily unavailable"`.
- **Required Fix**: Display the exact user-facing message required by the specification:  
  `"AI service is not configured. Add the required AI provider API key to the environment configuration."`

---

## 3. Database Schema Verification

All entities are backed by genuine PostgreSQL tables in `infra/init.sql`:
- `users`: Stores user identity, bcrypt password hashes, and roles (`student`, `instructor`, `admin`).
- `courses`, `modules`, `lectures`: Curricula, video URLs, transcripts, durations, and key concepts.
- `enrollments`, `lecture_progress`: Progress percentages, watched seconds, and completion flags.
- `quizzes`, `quiz_questions`, `quiz_options`, `quiz_attempts`: Question definitions and attempt history.
- `document_chunks`: Course text chunks with pgvector embeddings (`VECTOR(1536)`).
- `flashcards`, `user_flashcard_reviews`: Spaced repetition cards and review states (`known`, `difficult`).
- `study_plans`: Personalized roadmaps and task completion states.
- `streaks`: Daily active streaks.

---

## 4. Minimum Code Changes Required

1. **`ai-service/app/core/llm.py`**:
   - Check `ANTHROPIC_API_KEY`. If empty, raise HTTP 503 `AI_NOT_CONFIGURED`.
   - Remove `educational_context_answer` canned text.
   - Call real Claude Anthropic API when key is provided.

2. **`ai-service/app/routers/content.py`**:
   - Propagate `AI_NOT_CONFIGURED` error on missing key.
   - Remove fallback questions and cards.

3. **`backend/src/server.ts`**:
   - Remove `localGroundedChatFallback` and all `[Notice: Running in Development AI Mode]` strings.
   - Return HTTP 503 `AI_NOT_CONFIGURED` when AI service is unconfigured.
   - Remove fallback quiz, summary, and flashcard generators.

4. **`frontend/src/pages/Landing.tsx`**:
   - Remove hardcoded `c1`, `c2`, `c3` fallback courses.

5. **`frontend/src/pages/AiTutor.tsx` & `CourseDetails.tsx`**:
   - Detect `AI_NOT_CONFIGURED` and show:  
     `"AI service is not configured. Add the required AI provider API key to the environment configuration."`

6. **`frontend/src/pages/Summaries.tsx`, `Quizzes.tsx`, `Flashcards.tsx`**:
   - Display configuration warning when AI service returns `AI_NOT_CONFIGURED`.

7. **`.env.example`**:
   - Fully document all variables (`POSTGRES_*`, `DATABASE_URL`, `REDIS_URL`, `JWT_*`, `AI_SERVICE_URL`, `ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL`, `VITE_API_URL`).
