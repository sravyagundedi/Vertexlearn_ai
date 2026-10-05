# VertexLearn AI — Real Features & Architecture Verification

This document specifies the end-to-end implementation and architecture mapping for the functional features of the VertexLearn AI platform.

---

## 1. Feature-to-Code Mapping

| Feature | Frontend Page & Component | Backend Route & Controller | DB Table / Model | AI Service Router | Test Verification Script |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **1. Course-Grounded AI Tutor** | `frontend/src/pages/AiTutor.tsx`, `CourseDetails.tsx` (Chat panel) | `POST /api/v1/ai/chat`, `GET /api/v1/ai/chat/history`, `DELETE /api/v1/ai/chat/history` | `ai_chat_sessions`, `ai_chat_messages`, `document_chunks` | `app/routers/chat.py` (`/ai/chat`), `app/rag/retriever.py` | `test_phase6_ai_tutor.cjs` |
| **2. Personalized Learning Profile** | `frontend/src/pages/PersonalizedLearning.tsx` | `GET /api/v1/learning/profile` | `quiz_attempts`, `lecture_progress`, `user_flashcard_reviews`, `enrollments` | Dynamic algorithmic diagnostic synthesis | `test_phase10_learning_profile.cjs` |
| **3. Automated AI Quizzes** | `frontend/src/pages/Quizzes.tsx`, `frontend/src/components/QuizPlayer.tsx` | `POST /api/v1/ai/generate-quiz`, `GET /api/v1/quizzes/:id`, `POST /api/v1/quizzes/:id/submit`, `GET /api/v1/quizzes/:id/attempts` | `quizzes`, `quiz_questions`, `quiz_options`, `quiz_attempts` | `app/routers/content.py` (`/ai/generate-quiz`) | `test_phase8_ai_quizzes.cjs` |
| **4. Concise AI Summaries** | `frontend/src/pages/Summaries.tsx`, `CourseDetails.tsx` (Summary panel) | `GET /api/v1/lectures/:id/summary`, `POST /api/v1/lectures/:id/summary`, `POST /api/v1/ai/summarize` | `lectures.ai_summary` | `app/routers/content.py` (`/ai/summarize`) | `test_phase7_summaries.cjs` |
| **5. Interactive 3D Flashcards** | `frontend/src/pages/Flashcards.tsx`, `CourseDetails.tsx` (Flashcards link) | `GET /api/v1/flashcards`, `POST /api/v1/ai/generate-flashcards`, `POST /api/v1/flashcards/:id/review` | `flashcards`, `user_flashcard_reviews` | `app/routers/content.py` (`/ai/flashcards`) | `test_phase9_flashcards.cjs` |
| **6. Smart Study Plans** | `frontend/src/pages/StudyPlan.tsx` | `GET /api/v1/study-plans`, `POST /api/v1/ai/study-plan`, `PATCH /api/v1/study-plans/:id/tasks/:taskId` | `study_plans` | `app/routers/content.py` (`/ai/study-plan`) | `test_phase11_study_plans.cjs` |
| **7. Progress & Mastery Tracking** | `frontend/src/pages/Progress.tsx`, `frontend/src/pages/Dashboard.tsx` | `GET /api/v1/users/me/progress`, `GET /api/v1/users/me/mastery`, `GET /api/v1/users/me/quiz-results` | `streaks`, `lecture_progress`, `quiz_attempts`, `user_flashcard_reviews` | Cross-curriculum aggregation algorithms | `verify_demo_flow.cjs` |
| **8. Curated & Verified Curriculum** | `frontend/src/pages/Courses.tsx`, `frontend/src/pages/CourseDetails.tsx` | `GET /api/v1/courses`, `GET /api/v1/courses/:id`, `POST /api/v1/courses/:id/enroll`, `POST /api/v1/lectures/:id/progress` | `courses`, `modules`, `lectures`, `enrollments`, `course_approvals` | Course grounding chunking | `verify_demo_flow.cjs` |

---

## 2. Key Architectural Guarantees

1. **No Fake / Client-Only Simulations**:
   - Every user action makes an authenticated HTTP request (`Authorization: Bearer <jwt>`) to the backend API (`http://localhost:8000`).
   - Every metric (quiz scores, completed lessons, streaks, study minutes, mastery percentages) is computed from real PostgreSQL tables.

2. **Strict RAG Grounding & Hallucination Prevention**:
   - The AI Tutor queries PostgreSQL with pgvector embeddings or relevant lecture transcript chunks.
   - If material cannot be retrieved for a user query, the AI Tutor strictly returns:
     `"I couldn't find enough information in this course material to answer that accurately."` with `sources: []`.

3. **Secure Quiz Evaluation**:
   - When generating or fetching quizzes, `is_correct` is omitted from all questions sent to the client.
   - Answer submission (`POST /api/v1/quizzes/:id/submit`) performs server-side grading, records attempts, updates user study streaks, and returns explanations with the score.

4. **Bi-Directional Learning Synergy**:
   - Quizzes failed or flashcards marked "difficult" immediately feed into the user's `weak_topics` and trigger targeted revision blocks in the **Smart Study Plan** and **Personalized Learning Profile**.

---

## 3. Test Suites

All tests can be executed against the running local development environment:

```bash
# Course-grounded AI Tutor test
node test_phase6_ai_tutor.cjs

# Concise AI Summaries test
node test_phase7_summaries.cjs

# Automated AI Quizzes test
node test_phase8_ai_quizzes.cjs

# Interactive 3D Flashcards test
node test_phase9_flashcards.cjs

# Personalized Learning Profile test
node test_phase10_learning_profile.cjs

# Smart Study Plans test
node test_phase11_study_plans.cjs

# Full 19-step demo flow test
node verify_demo_flow.cjs
```
