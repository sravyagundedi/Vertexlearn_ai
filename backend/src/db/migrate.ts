import { pool, q } from './pool.js';

export async function runMigrations() {
  console.log('Running database schema updates...');

  // Add columns to lectures
  await q(`
    ALTER TABLE lectures 
    ADD COLUMN IF NOT EXISTS description TEXT,
    ADD COLUMN IF NOT EXISTS learning_objectives TEXT[] DEFAULT '{}',
    ADD COLUMN IF NOT EXISTS notes TEXT,
    ADD COLUMN IF NOT EXISTS key_concepts TEXT[] DEFAULT '{}',
    ADD COLUMN IF NOT EXISTS quick_check JSONB DEFAULT '[]'::jsonb;
  `);

  // Add columns to quizzes
  await q(`
    ALTER TABLE quizzes
    ADD COLUMN IF NOT EXISTS course_id UUID REFERENCES courses(id) ON DELETE CASCADE,
    ADD COLUMN IF NOT EXISTS lecture_id UUID REFERENCES lectures(id) ON DELETE CASCADE,
    ADD COLUMN IF NOT EXISTS description TEXT,
    ADD COLUMN IF NOT EXISTS difficulty VARCHAR(20) DEFAULT 'intermediate',
    ADD COLUMN IF NOT EXISTS passing_score INT DEFAULT 70;
  `);

  // Add columns to quiz_questions
  await q(`
    ALTER TABLE quiz_questions
    ADD COLUMN IF NOT EXISTS explanation TEXT,
    ADD COLUMN IF NOT EXISTS points INT DEFAULT 1;
  `);

  // Add columns to quiz_attempts
  await q(`
    ALTER TABLE quiz_attempts
    ADD COLUMN IF NOT EXISTS total_questions INT DEFAULT 0,
    ADD COLUMN IF NOT EXISTS correct_answers INT DEFAULT 0,
    ADD COLUMN IF NOT EXISTS percentage NUMERIC(5,2) DEFAULT 0,
    ADD COLUMN IF NOT EXISTS passed BOOLEAN DEFAULT FALSE;
  `);

  // Ensure unique constraint on course titles to prevent duplicate courses during re-seeding
  await q(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'courses_title_key'
      ) THEN
        -- Clean up duplicate courses keeping the latest or first before adding constraint
        DELETE FROM courses WHERE id NOT IN (
          SELECT DISTINCT ON (title) id FROM courses ORDER BY title, created_at DESC
        );
        ALTER TABLE courses ADD CONSTRAINT courses_title_key UNIQUE (title);
      END IF;
    END $$;
  `);

  console.log('Database migrations completed successfully.');
}

if (process.argv[1]?.endsWith('migrate.ts')) {
  runMigrations()
    .then(() => pool.end())
    .catch((err) => {
      console.error('Migration failed:', err);
      process.exit(1);
    });
}
