CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name VARCHAR(150) NOT NULL,
  email VARCHAR(180) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  avatar_url TEXT,
  role VARCHAR(30) NOT NULL DEFAULT 'student' CHECK (role IN ('student','instructor','admin')),
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE TABLE IF NOT EXISTS courses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), instructor_id UUID REFERENCES users(id),
  title VARCHAR(200) NOT NULL, description TEXT, category VARCHAR(80), difficulty VARCHAR(20),
  thumbnail_url TEXT, price NUMERIC(10,2) DEFAULT 0,
  status VARCHAR(20) DEFAULT 'approved' CHECK (status IN ('pending','approved','rejected','archived')),
  rating NUMERIC(3,2) DEFAULT 4.7, created_at TIMESTAMPTZ DEFAULT now()
);
CREATE TABLE IF NOT EXISTS modules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), course_id UUID REFERENCES courses(id) ON DELETE CASCADE,
  title VARCHAR(200) NOT NULL, order_index INT NOT NULL
);
CREATE TABLE IF NOT EXISTS lectures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), module_id UUID REFERENCES modules(id) ON DELETE CASCADE,
  title VARCHAR(200) NOT NULL, video_url TEXT, transcript TEXT, duration_seconds INT DEFAULT 0,
  order_index INT NOT NULL, resource_urls TEXT[] DEFAULT '{}'
);
CREATE TABLE IF NOT EXISTS enrollments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  course_id UUID REFERENCES courses(id) ON DELETE CASCADE, enrolled_at TIMESTAMPTZ DEFAULT now(),
  progress_percent NUMERIC(5,2) DEFAULT 0, UNIQUE(user_id, course_id)
);
CREATE TABLE IF NOT EXISTS lecture_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), enrollment_id UUID REFERENCES enrollments(id) ON DELETE CASCADE,
  lecture_id UUID REFERENCES lectures(id) ON DELETE CASCADE, watched_seconds INT DEFAULT 0,
  completed BOOLEAN DEFAULT FALSE, last_watched_at TIMESTAMPTZ DEFAULT now(), UNIQUE(enrollment_id, lecture_id)
);
CREATE TABLE IF NOT EXISTS notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  lecture_id UUID REFERENCES lectures(id) ON DELETE CASCADE, timestamp_seconds INT DEFAULT 0, content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE TABLE IF NOT EXISTS bookmarks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  lecture_id UUID REFERENCES lectures(id) ON DELETE CASCADE, timestamp_seconds INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(), UNIQUE(user_id, lecture_id, timestamp_seconds)
);
CREATE TABLE IF NOT EXISTS assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), course_id UUID REFERENCES courses(id) ON DELETE CASCADE,
  title VARCHAR(200), instructions TEXT, rubric JSONB, due_date TIMESTAMPTZ
);
CREATE TABLE IF NOT EXISTS assignment_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), assignment_id UUID REFERENCES assignments(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE, file_url TEXT, submitted_at TIMESTAMPTZ DEFAULT now(),
  grade NUMERIC(5,2), feedback TEXT
);
CREATE TABLE IF NOT EXISTS quizzes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), module_id UUID REFERENCES modules(id) ON DELETE CASCADE,
  title VARCHAR(200), is_ai_generated BOOLEAN DEFAULT FALSE, generated_from_lecture_id UUID REFERENCES lectures(id)
);
CREATE TABLE IF NOT EXISTS quiz_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), quiz_id UUID REFERENCES quizzes(id) ON DELETE CASCADE,
  question_text TEXT, question_type VARCHAR(20), order_index INT
);
CREATE TABLE IF NOT EXISTS quiz_options (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), question_id UUID REFERENCES quiz_questions(id) ON DELETE CASCADE,
  option_text TEXT, is_correct BOOLEAN DEFAULT FALSE
);
CREATE TABLE IF NOT EXISTS quiz_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), quiz_id UUID REFERENCES quizzes(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE, score NUMERIC(5,2), started_at TIMESTAMPTZ DEFAULT now(), submitted_at TIMESTAMPTZ
);
CREATE TABLE IF NOT EXISTS quiz_answers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), attempt_id UUID REFERENCES quiz_attempts(id) ON DELETE CASCADE,
  question_id UUID REFERENCES quiz_questions(id), selected_option_ids UUID[], text_answer TEXT, is_correct BOOLEAN
);
CREATE TABLE IF NOT EXISTS certificates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), user_id UUID REFERENCES users(id), course_id UUID REFERENCES courses(id),
  certificate_url TEXT, issued_at TIMESTAMPTZ DEFAULT now(), UNIQUE(user_id, course_id)
);
CREATE TABLE IF NOT EXISTS badges (id SERIAL PRIMARY KEY, name VARCHAR(80), description TEXT, icon_url TEXT);
CREATE TABLE IF NOT EXISTS user_badges (user_id UUID REFERENCES users(id) ON DELETE CASCADE, badge_id INT REFERENCES badges(id) ON DELETE CASCADE, earned_at TIMESTAMPTZ DEFAULT now(), PRIMARY KEY(user_id,badge_id));
CREATE TABLE IF NOT EXISTS streaks (user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE, current_streak INT DEFAULT 0, longest_streak INT DEFAULT 0, last_active_date DATE);
CREATE TABLE IF NOT EXISTS ai_chat_sessions (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), user_id UUID REFERENCES users(id), course_id UUID REFERENCES courses(id), mode VARCHAR(20) DEFAULT 'intermediate', created_at TIMESTAMPTZ DEFAULT now());
CREATE TABLE IF NOT EXISTS ai_chat_messages (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), session_id UUID REFERENCES ai_chat_sessions(id) ON DELETE CASCADE, sender VARCHAR(10), content TEXT, source_lecture_ids UUID[], created_at TIMESTAMPTZ DEFAULT now());
CREATE TABLE IF NOT EXISTS document_chunks (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), course_id UUID REFERENCES courses(id) ON DELETE CASCADE, lecture_id UUID REFERENCES lectures(id) ON DELETE CASCADE, chunk_text TEXT, embedding VECTOR(1536), created_at TIMESTAMPTZ DEFAULT now());
CREATE TABLE IF NOT EXISTS study_plans (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), user_id UUID REFERENCES users(id), course_id UUID REFERENCES courses(id), plan_json JSONB, generated_at TIMESTAMPTZ DEFAULT now());
CREATE TABLE IF NOT EXISTS flashcards (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), module_id UUID REFERENCES modules(id), question TEXT, answer TEXT);
CREATE TABLE IF NOT EXISTS recommendations (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), user_id UUID REFERENCES users(id), recommended_course_id UUID REFERENCES courses(id), reason TEXT, score NUMERIC(5,2), created_at TIMESTAMPTZ DEFAULT now());
CREATE TABLE IF NOT EXISTS discussion_threads (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), course_id UUID REFERENCES courses(id), created_by UUID REFERENCES users(id), title VARCHAR(200), created_at TIMESTAMPTZ DEFAULT now());
CREATE TABLE IF NOT EXISTS discussion_posts (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), thread_id UUID REFERENCES discussion_threads(id) ON DELETE CASCADE, user_id UUID REFERENCES users(id), content TEXT, is_flagged BOOLEAN DEFAULT FALSE, created_at TIMESTAMPTZ DEFAULT now());
CREATE TABLE IF NOT EXISTS announcements (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), course_id UUID REFERENCES courses(id), posted_by UUID REFERENCES users(id), content TEXT, created_at TIMESTAMPTZ DEFAULT now());
CREATE TABLE IF NOT EXISTS notifications (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), user_id UUID REFERENCES users(id), title VARCHAR(150), body TEXT, is_read BOOLEAN DEFAULT FALSE, created_at TIMESTAMPTZ DEFAULT now());
CREATE TABLE IF NOT EXISTS course_approvals (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), course_id UUID REFERENCES courses(id), reviewed_by UUID REFERENCES users(id), decision VARCHAR(20), comment TEXT, reviewed_at TIMESTAMPTZ DEFAULT now());
CREATE TABLE IF NOT EXISTS payments (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), user_id UUID REFERENCES users(id), course_id UUID REFERENCES courses(id), amount NUMERIC(10,2), status VARCHAR(20), created_at TIMESTAMPTZ DEFAULT now());
CREATE TABLE IF NOT EXISTS audit_logs (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), actor_id UUID REFERENCES users(id), action VARCHAR(100), entity VARCHAR(50), entity_id UUID, metadata JSONB, created_at TIMESTAMPTZ DEFAULT now());
CREATE INDEX IF NOT EXISTS idx_courses_status ON courses(status);
CREATE INDEX IF NOT EXISTS idx_enrollments_user_course ON enrollments(user_id, course_id);
CREATE INDEX IF NOT EXISTS idx_chunks_course ON document_chunks(course_id);
