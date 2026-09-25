# VertexLearn AI

AI-augmented Learning Management System built from the supplied Vertexon LMS-AI PRD v1.0.

## Architecture

- React + TypeScript + Vite frontend
- Node.js + Express + TypeScript Core LMS API
- Python + FastAPI AI service
- PostgreSQL + pgvector
- Redis
- Docker Compose
- Anthropic API for production LLM calls (optional in local demo mode)

## Included working flows

- JWT access + refresh authentication
- Student / Instructor / Admin roles
- Course catalog, filtering and enrollment
- Course/module/lecture management
- Progress, notes and bookmarks
- Quiz creation, attempts and auto-grading for objective questions
- AI tutor endpoint scoped to course material with source references
- AI summary, quiz generation, flashcards and study-plan endpoints
- Instructor analytics
- Admin course approval and user management
- Redis-backed rate limiting/cache hooks
- Docker local development
- GitHub Actions CI skeleton

## Quick start

1. Install Docker Desktop.
2. Copy `.env.example` to `.env`.
3. Run `docker compose up --build`.
4. Open http://localhost:5173.
5. Demo accounts:
   - student@vertexlearn.local / Password123!
   - instructor@vertexlearn.local / Password123!
   - admin@vertexlearn.local / Password123!

AI calls run in demo mode until `ANTHROPIC_API_KEY` is supplied to the AI service. The RAG pipeline still retrieves course chunks from PostgreSQL; demo embeddings are deterministic so the stack runs without downloading a large model.

## Production direction

Replace demo embeddings with a real embedding provider, connect S3/MinIO for media, add HLS/CDN delivery, background workers, transactional refresh-token storage, observability, and cloud deployment as described in `docs/prd-summary.md`.
