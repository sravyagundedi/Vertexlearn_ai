# VertexLearn AI Architecture

```mermaid
flowchart LR
  UI[React SPA\nStudent / Instructor / Admin] --> API[Node.js + Express\nCore LMS API]
  API --> DB[(PostgreSQL + pgvector)]
  API --> REDIS[(Redis)]
  API --> AI[Python + FastAPI\nAI Tutor Service]
  AI --> DB
  AI --> LLM[Anthropic API]
  API --> OBJ[S3 / MinIO\nVideo / PDF / Certificates]
```

## AI Tutor request flow

1. Authenticated client sends course id + question.
2. AI service retrieves course-scoped document chunks from pgvector.
3. Retrieved context is passed to the LLM with an instruction to answer only from course context.
4. The API returns the answer and source lecture references.
5. A production extension should persist session/messages and enqueue mastery-score updates.
