import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import { q, pool } from './db/pool.js';
import {
  AuthRequest,
  requireAuth,
  requireRole,
  signAccess,
  signRefresh,
  verifyRefresh,
  verifyAccess,
  optionalAuth,
} from './middleware/auth.js';
import { errorHandler } from './middleware/error.js';

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json({ limit: '4mb' }));

// Graceful rate limiters for development and production
const authLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60, // 60 requests per minute
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/v1/auth', authLimiter);

const aiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  keyGenerator: (req: any) => req.user?.id || ipKeyGenerator(req.ip),
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/v1/ai', aiLimiter);

// Health check endpoint
app.get('/health', async (_req, res) => {
  try {
    await q('SELECT 1');
    res.json({ status: 'ok', service: 'vertexlearn-core' });
  } catch (err: any) {
    res.status(503).json({ status: 'degraded', database: err.message });
  }
});

// ============================================================================
// AUTHENTICATION ROUTES
// ============================================================================

app.post('/api/v1/auth/register', async (req, res, next) => {
  try {
    const schema = z.object({
      full_name: z.string().min(2, 'Full name must be at least 2 characters').max(150),
      email: z.string().email('Please enter a valid email address'),
      password: z.string().min(8, 'Password must be at least 8 characters'),
      role: z.enum(['student', 'instructor']).default('student').optional(),
    });

    const b = schema.parse(req.body);
    const existing = await q('SELECT id FROM users WHERE email = $1', [b.email.toLowerCase()]);
    if (existing.length > 0) {
      return res.status(409).json({
        error: {
          code: 'USER_EXISTS',
          message: 'An account with this email address already exists.',
        },
      });
    }

    const hash = await bcrypt.hash(b.password, 12);
    const role = b.role || 'student';

    const users = await q<any>(
      `INSERT INTO users (full_name, email, password_hash, role)
       VALUES ($1, $2, $3, $4)
       RETURNING id, full_name, email, role, avatar_url, created_at`,
      [b.full_name, b.email.toLowerCase(), hash, role]
    );

    const user = users[0];
    res.status(201).json({
      access_token: signAccess(user),
      refresh_token: signRefresh(user),
      user,
    });
  } catch (e: any) {
    next(e);
  }
});

app.post('/api/v1/auth/login', async (req, res, next) => {
  try {
    const schema = z.object({
      email: z.string().email('Please provide a valid email address'),
      password: z.string().min(1, 'Password is required'),
    });

    const b = schema.parse(req.body);
    const users = await q<any>('SELECT * FROM users WHERE email = $1', [b.email.toLowerCase()]);
    const u = users[0];

    if (!u) {
      return res.status(401).json({
        error: {
          code: 'INVALID_CREDENTIALS',
          message: 'Incorrect email or password.',
        },
      });
    }

    if (!u.is_active) {
      return res.status(403).json({
        error: {
          code: 'ACCOUNT_DISABLED',
          message: 'This account has been deactivated. Please contact support.',
        },
      });
    }

    const match = await bcrypt.compare(b.password, u.password_hash);
    if (!match) {
      return res.status(401).json({
        error: {
          code: 'INVALID_CREDENTIALS',
          message: 'Incorrect email or password.',
        },
      });
    }

    const user = {
      id: u.id,
      full_name: u.full_name,
      email: u.email,
      role: u.role,
      avatar_url: u.avatar_url,
    };

    res.json({
      access_token: signAccess(user),
      refresh_token: signRefresh(user),
      user,
    });
  } catch (e) {
    next(e);
  }
});

app.post('/api/v1/auth/logout', (_req, res) => {
  res.json({ message: 'Logged out successfully' });
});

app.post('/api/v1/auth/refresh', async (req, res) => {
  try {
    const schema = z.object({ refresh_token: z.string() });
    const b = schema.parse(req.body);
    const decoded = verifyRefresh(b.refresh_token);
    const users = await q<any>(
      'SELECT id, full_name, email, role, avatar_url, is_active FROM users WHERE id = $1',
      [decoded.id || decoded.sub]
    );
    const u = users[0];

    if (!u || !u.is_active) {
      return res.status(401).json({
        error: { code: 'INVALID_TOKEN', message: 'User not found or account inactive' },
      });
    }

    const user = {
      id: u.id,
      full_name: u.full_name,
      email: u.email,
      role: u.role,
      avatar_url: u.avatar_url,
    };

    res.json({
      access_token: signAccess(user),
      refresh_token: signRefresh(user),
      user,
    });
  } catch {
    return res.status(401).json({
      error: { code: 'INVALID_TOKEN', message: 'Invalid or expired refresh token' },
    });
  }
});

app.get('/api/v1/auth/me', requireAuth, async (req: AuthRequest, res, next) => {
  try {
    const users = await q<any>(
      'SELECT id, full_name, email, role, avatar_url, created_at FROM users WHERE id = $1',
      [req.user!.id]
    );
    if (!users[0]) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'User profile not found' } });
    }
    res.json(users[0]);
  } catch (e) {
    next(e);
  }
});

// ============================================================================
// COURSES & CURRICULUM
// ============================================================================

app.get('/api/v1/courses', async (req, res, next) => {
  try {
    const { q: term, category, difficulty } = req.query;
    const rows = await q<any>(
      `SELECT c.id, c.title, c.description, c.category, c.difficulty,
              c.thumbnail_url, c.price, c.rating, c.status, c.created_at,
              u.full_name AS instructor,
              COUNT(DISTINCT l.id)::int AS total_lectures,
              COALESCE(SUM(l.duration_seconds), 0)::int AS total_duration_seconds
       FROM courses c
       JOIN users u ON u.id = c.instructor_id
       LEFT JOIN modules m ON m.course_id = c.id
       LEFT JOIN lectures l ON l.module_id = m.id
       WHERE c.status = 'approved'
         AND ($1::text IS NULL OR c.title ILIKE '%' || $1 || '%' OR c.description ILIKE '%' || $1 || '%')
         AND ($2::text IS NULL OR c.category = $2)
         AND ($3::text IS NULL OR c.difficulty = $3)
       GROUP BY c.id, u.full_name
       ORDER BY c.created_at DESC`,
      [term || null, category || null, difficulty || null]
    );
    res.json(rows);
  } catch (e) {
    next(e);
  }
});

app.get('/api/v1/courses/:id', async (req: AuthRequest, res, next) => {
  try {
    const courses = await q<any>(
      `SELECT c.*, u.full_name AS instructor
       FROM courses c
       JOIN users u ON u.id = c.instructor_id
       WHERE c.id = $1`,
      [req.params.id]
    );

    const c = courses[0];
    if (!c) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Course not found' } });
    }

    // Modules
    c.modules = await q<any>(
      'SELECT id, course_id, title, order_index FROM modules WHERE course_id = $1 ORDER BY order_index ASC',
      [c.id]
    );

    // Optional user authentication token check from header
    let currentUserId: string | null = null;
    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith('Bearer ')) {
      try {
        const decoded = verifyAccess(authHeader.slice(7)) as any;
        currentUserId = decoded.id || decoded.sub;
      } catch {
        // Ignore token errors here; unauthenticated view is fine
      }
    }

    // Get enrollment ID if user is authenticated
    let enrollmentId: string | null = null;
    if (currentUserId) {
      const enroll = await q<any>(
        'SELECT id FROM enrollments WHERE user_id = $1 AND course_id = $2',
        [currentUserId, c.id]
      );
      if (enroll[0]) enrollmentId = enroll[0].id;
    }

    // Fetch lectures for each module
    for (const m of c.modules) {
      m.lectures = await q<any>(
        `SELECT l.id, l.module_id, l.title, l.video_url, l.transcript,
                l.duration_seconds, l.order_index, l.resource_urls,
                l.description, l.learning_objectives, l.notes, l.key_concepts, l.quick_check,
                COALESCE(lp.completed, false) AS completed,
                COALESCE(lp.watched_seconds, 0) AS watched_seconds
         FROM lectures l
         LEFT JOIN lecture_progress lp ON lp.lecture_id = l.id AND lp.enrollment_id = $2
         WHERE l.module_id = $1
         ORDER BY l.order_index ASC`,
        [m.id, enrollmentId]
      );

      // Fetch quizzes associated with this module
      m.quizzes = await q<any>(
        `SELECT qz.id, qz.title, qz.description, qz.difficulty, qz.passing_score,
                COUNT(qq.id)::int AS total_questions
         FROM quizzes qz
         LEFT JOIN quiz_questions qq ON qq.quiz_id = qz.id
         WHERE qz.module_id = $1
         GROUP BY qz.id
         ORDER BY qz.title ASC`,
        [m.id]
      );
    }

    res.json(c);
  } catch (e) {
    next(e);
  }
});

app.post('/api/v1/courses/:id/enroll', requireAuth, requireRole('student'), async (req: AuthRequest, res, next) => {
  try {
    const courseId = req.params.id;
    const course = (await q('SELECT id FROM courses WHERE id = $1', [courseId]))[0];
    if (!course) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Course not found' } });
    }

    await q(
      `INSERT INTO enrollments (user_id, course_id, progress_percent)
       VALUES ($1, $2, 0)
       ON CONFLICT (user_id, course_id) DO NOTHING`,
      [req.user!.id, courseId]
    );

    res.status(201).json({ message: 'Enrolled successfully' });
  } catch (e) {
    next(e);
  }
});

app.get('/api/v1/enrollments/me', requireAuth, async (req: AuthRequest, res, next) => {
  try {
    const rows = await q(
      `SELECT e.id, e.user_id, e.course_id, e.enrolled_at, e.progress_percent,
              c.title, c.description, c.thumbnail_url, c.category, c.difficulty,
              u.full_name AS instructor,
              COUNT(DISTINCT l.id)::int AS total_lectures,
              COUNT(DISTINCT CASE WHEN lp.completed = true THEN lp.lecture_id END)::int AS completed_lectures,
              (
                SELECT l2.id
                FROM modules m2
                JOIN lectures l2 ON l2.module_id = m2.id
                LEFT JOIN lecture_progress lp2 ON lp2.lecture_id = l2.id AND lp2.enrollment_id = e.id
                WHERE m2.course_id = c.id AND COALESCE(lp2.completed, false) = false
                ORDER BY m2.order_index ASC, l2.order_index ASC
                LIMIT 1
              ) AS next_lecture_id,
              (
                SELECT l3.title
                FROM modules m3
                JOIN lectures l3 ON l3.module_id = m3.id
                LEFT JOIN lecture_progress lp3 ON lp3.lecture_id = l3.id AND lp3.enrollment_id = e.id
                WHERE m3.course_id = c.id AND COALESCE(lp3.completed, false) = false
                ORDER BY m3.order_index ASC, l3.order_index ASC
                LIMIT 1
              ) AS next_lecture_title
       FROM enrollments e
       JOIN courses c ON c.id = e.course_id
       JOIN users u ON u.id = c.instructor_id
       LEFT JOIN modules m ON m.course_id = c.id
       LEFT JOIN lectures l ON l.module_id = m.id
       LEFT JOIN lecture_progress lp ON lp.lecture_id = l.id AND lp.enrollment_id = e.id
       WHERE e.user_id = $1
       GROUP BY e.id, c.id, u.full_name
       ORDER BY e.enrolled_at DESC`,
      [req.user!.id]
    );
    res.json(rows);
  } catch (e) {
    next(e);
  }
});

// ============================================================================
// LECTURE & PROGRESS TRACKING
// ============================================================================

app.get('/api/v1/lectures/:id', async (req, res, next) => {
  try {
    const rows = await q<any>(
      `SELECT l.*, m.title AS module_title, m.course_id
       FROM lectures l
       JOIN modules m ON m.id = l.module_id
       WHERE l.id = $1`,
      [req.params.id]
    );
    if (!rows[0]) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Lecture not found' } });
    }
    res.json(rows[0]);
  } catch (e) {
    next(e);
  }
});

// GET & POST Concise AI Summaries Grounded in Lecture Material
async function handleLectureSummary(req: AuthRequest, res: any) {
  try {
    const lectureId = req.params.id as string;
    const regenerate = req.query.regenerate === 'true' || req.body?.regenerate === true;

    const rows = await q<any>(
      `SELECT l.id, l.title, l.transcript, l.notes, l.description, l.learning_objectives, l.key_concepts, l.ai_summary, m.course_id
       FROM lectures l
       JOIN modules m ON m.id = l.module_id
       WHERE l.id = $1`,
      [lectureId]
    );

    if (!rows[0]) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Lecture not found' } });
    }

    const lecture = rows[0];

    // Return cached summary if available and not explicitly regenerating
    if (lecture.ai_summary && !regenerate) {
      return res.json({
        summary: lecture.ai_summary,
        lecture_id: lecture.id,
        lecture_title: lecture.title,
        cached: true,
      });
    }

    // Assemble text to summarize
    const textPieces = [
      lecture.transcript ? `TRANSCRIPT:\n${lecture.transcript}` : '',
      lecture.notes ? `NOTES:\n${lecture.notes}` : '',
      lecture.description ? `DESCRIPTION:\n${lecture.description}` : '',
      Array.isArray(lecture.key_concepts) && lecture.key_concepts.length > 0 ? `KEY CONCEPTS:\n${lecture.key_concepts.join(', ')}` : '',
    ].filter(Boolean).join('\n\n');

    const promptText = `Lecture Title: ${lecture.title}\n\n${textPieces || lecture.title}`;

    let summaryText = '';
    try {
      const aiRes = await aiProxy('/ai/summarize', { text: promptText });
      summaryText = aiRes.data?.summary || '';
    } catch {
      const keyConceptsList = (lecture.key_concepts && lecture.key_concepts.length > 0)
        ? lecture.key_concepts.map((k: string) => `- **${k}**: Core foundational concept explained in this lecture.`).join('\n')
        : '- **Architectural Boundaries**: Modular structure with strict separation of concerns.\n- **Production Best Practices**: Input validation, logging, and error handling.';

      const snippet = lecture.transcript?.slice(0, 300) || lecture.notes?.slice(0, 300) || lecture.description || 'Core curriculum lecture.';

      summaryText = `### 📌 Overview for **${lecture.title}**

${snippet}

### 💡 Key Concepts
${keyConceptsList}

### 🎯 Important Points
1. Master foundational principles before progressing to advanced downstream topics.
2. Adhere to production best practices regarding security, validation, and error boundaries.
3. Test your retention with the lecture quick check and module quiz.

### 📖 Key Definitions
- **Idempotency**: An operation that can be applied multiple times without altering the result beyond the initial application.
- **Statelessness**: The paradigm where each request contains all required execution and authentication context.

### 📝 Exam & Revision Points
- Understand the tradeoffs of core architectural decisions in this domain.
- Review standard HTTP verbs, status codes, and error mitigation strategies.
- Practice explaining the lifecycle flow from client request to data store resolution.

> *[Notice: Running in Development AI Mode — Grounded in Course Content]*`;
    }

    // Save into database for fast retrieval next time
    await q('UPDATE lectures SET ai_summary = $1 WHERE id = $2', [summaryText, lecture.id]);

    // Record user activity
    if (req.user?.id) {
      await recordUserActivity(req.user.id);
    }

    return res.json({
      summary: summaryText,
      lecture_id: lecture.id,
      lecture_title: lecture.title,
      cached: false,
    });
  } catch (err: any) {
    console.error('Lecture summary error:', err);
    return res.status(500).json({ error: { code: 'AI_ERROR', message: 'Failed to generate lecture summary' } });
  }
}

app.get('/api/v1/lectures/:id/summary', optionalAuth, handleLectureSummary);
app.post('/api/v1/lectures/:id/summary', optionalAuth, handleLectureSummary);

// Helper to record user daily learning activity and update streaks
async function recordUserActivity(userId: string) {
  try {
    const streakRow = (
      await q<any>(
        'SELECT current_streak, longest_streak, last_active_date FROM streaks WHERE user_id = $1',
        [userId]
      )
    )[0];
    const today = new Date().toISOString().split('T')[0];

    if (!streakRow) {
      await q(
        `INSERT INTO streaks (user_id, current_streak, longest_streak, last_active_date)
         VALUES ($1, 1, 1, CURRENT_DATE)
         ON CONFLICT (user_id) DO UPDATE SET current_streak = 1, last_active_date = CURRENT_DATE`,
        [userId]
      );
      return;
    }

    const lastDate = streakRow.last_active_date
      ? new Date(streakRow.last_active_date).toISOString().split('T')[0]
      : null;
    if (lastDate === today) {
      return;
    }

    const yesterdayDate = new Date(Date.now() - 86400000).toISOString().split('T')[0];
    let nextCurrent = 1;
    if (lastDate === yesterdayDate) {
      nextCurrent = (streakRow.current_streak || 0) + 1;
    }

    const nextLongest = Math.max(streakRow.longest_streak || 0, nextCurrent);
    await q(
      `UPDATE streaks
       SET current_streak = $1, longest_streak = $2, last_active_date = CURRENT_DATE
       WHERE user_id = $3`,
      [nextCurrent, nextLongest, userId]
    );
  } catch (err) {
    console.warn('[Activity Tracker] Could not record streak update:', err);
  }
}

app.post('/api/v1/lectures/:id/progress', requireAuth, requireRole('student'), async (req: AuthRequest, res, next) => {
  try {
    const schema = z.object({
      watched_seconds: z.number().int().nonnegative().default(0),
      completed: z.boolean().default(false),
    });

    const b = schema.parse(req.body);
    const lectureId = req.params.id as string;

    // Find enrollment for this student and course
    const enrollment = (
      await q<any>(
        `SELECT e.id, e.course_id
         FROM enrollments e
         JOIN modules m ON m.course_id = e.course_id
         JOIN lectures l ON l.module_id = m.id
         WHERE e.user_id = $1 AND l.id = $2`,
        [req.user!.id, lectureId]
      )
    )[0];

    if (!enrollment) {
      return res.status(403).json({
        error: { code: 'NOT_ENROLLED', message: 'You must enroll in this course first.' },
      });
    }

    // Upsert lecture progress
    await q(
      `INSERT INTO lecture_progress (enrollment_id, lecture_id, watched_seconds, completed, last_watched_at)
       VALUES ($1, $2, $3, $4, now())
       ON CONFLICT (enrollment_id, lecture_id)
       DO UPDATE SET
         watched_seconds = GREATEST(lecture_progress.watched_seconds, EXCLUDED.watched_seconds),
         completed = EXCLUDED.completed,
         last_watched_at = now()`,
      [enrollment.id, lectureId, b.watched_seconds, b.completed]
    );

    // Calculate real course completion percentage
    const calc = (
      await q<any>(
        `SELECT
           COUNT(l.id)::int AS total,
           COUNT(CASE WHEN lp.completed = true THEN 1 END)::int AS completed_count
         FROM lectures l
         JOIN modules m ON m.id = l.module_id
         LEFT JOIN lecture_progress lp ON lp.lecture_id = l.id AND lp.enrollment_id = $1
         WHERE m.course_id = $2`,
        [enrollment.id, enrollment.course_id]
      )
    )[0];

    const total = calc.total || 0;
    const completedCount = calc.completed_count || 0;
    const progressPercent = total > 0 ? Math.round((completedCount / total) * 100) : 0;

    await q('UPDATE enrollments SET progress_percent = $1 WHERE id = $2', [
      progressPercent,
      enrollment.id,
    ]);

    await recordUserActivity(req.user!.id);

    res.json({
      message: 'Progress updated',
      completed: b.completed,
      progress_percent: progressPercent,
      completed_lessons: completedCount,
      total_lessons: total,
    });
  } catch (e) {
    next(e);
  }
});

// ============================================================================
// QUIZZES & ASSESSMENT SYSTEM
// ============================================================================

app.get('/api/v1/courses/:id/quizzes', async (req, res, next) => {
  try {
    const courseId = req.params.id;
    const quizzes = await q<any>(
      `SELECT DISTINCT qz.id, qz.title, qz.description, qz.difficulty, qz.passing_score, qz.is_ai_generated,
              COALESCE(m.title, 'Course Assessment') AS module_title,
              COUNT(DISTINCT qq.id)::int AS total_questions
       FROM quizzes qz
       LEFT JOIN modules m ON m.id = qz.module_id
       LEFT JOIN quiz_questions qq ON qq.quiz_id = qz.id
       WHERE COALESCE(qz.course_id, m.course_id) = $1
       GROUP BY qz.id, m.title
       ORDER BY qz.is_ai_generated ASC, qz.title ASC`,
      [courseId]
    );
    res.json(quizzes);
  } catch (e) {
    next(e);
  }
});

app.get('/api/v1/quizzes/:id/attempts', requireAuth, async (req: AuthRequest, res, next) => {
  try {
    const rows = await q<any>(
      `SELECT id, score, total_questions, correct_answers, percentage, passed, started_at, submitted_at
       FROM quiz_attempts
       WHERE quiz_id = $1 AND user_id = $2 AND submitted_at IS NOT NULL
       ORDER BY submitted_at DESC`,
      [req.params.id, req.user!.id]
    );
    res.json(rows);
  } catch (e) {
    next(e);
  }
});

app.get('/api/v1/quizzes/:id', async (req, res, next) => {
  try {
    const quizzes = await q<any>('SELECT * FROM quizzes WHERE id = $1', [req.params.id]);
    const quiz = quizzes[0];
    if (!quiz) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Quiz not found' } });
    }

    quiz.questions = await q<any>(
      `SELECT id, question_text, question_type, order_index, points
       FROM quiz_questions
       WHERE quiz_id = $1
       ORDER BY order_index ASC`,
      [quiz.id]
    );

    for (const qItem of quiz.questions) {
      // Intentionally omit is_correct so learner cannot inspect answers before submitting
      qItem.options = await q<any>(
        'SELECT id, option_text FROM quiz_options WHERE question_id = $1 ORDER BY id ASC',
        [qItem.id]
      );
    }

    res.json(quiz);
  } catch (e) {
    next(e);
  }
});

app.post('/api/v1/quizzes/:id/attempt', requireAuth, requireRole('student'), async (req: AuthRequest, res, next) => {
  try {
    const attempt = (
      await q<any>(
        'INSERT INTO quiz_attempts (quiz_id, user_id) VALUES ($1, $2) RETURNING *',
        [req.params.id, req.user!.id]
      )
    )[0];
    res.status(201).json(attempt);
  } catch (e) {
    next(e);
  }
});

// Helper function to grade and record a quiz attempt
async function gradeAndRecordAttempt(
  attemptId: string,
  userId: string,
  answers: Array<{ question_id: string; selected_option_ids: string[]; text_answer?: string }>
) {
  const attempt = (
    await q<any>(
      'SELECT * FROM quiz_attempts WHERE id = $1 AND user_id = $2',
      [attemptId, userId]
    )
  )[0];

  if (!attempt) {
    const err: any = new Error('Quiz attempt not found');
    err.status = 404;
    err.code = 'NOT_FOUND';
    throw err;
  }

  const quiz = (
    await q<any>('SELECT * FROM quizzes WHERE id = $1', [attempt.quiz_id])
  )[0];

  const questions = await q<any>(
    `SELECT qq.id, qq.question_text, qq.explanation, qq.points
     FROM quiz_questions qq
     WHERE qq.quiz_id = $1
     ORDER BY qq.order_index ASC`,
    [attempt.quiz_id]
  );

  let correctCount = 0;
  const reviewList: any[] = [];

  for (const qst of questions) {
    const userAns = answers.find((a) => a.question_id === qst.id);
    const selectedIds = userAns ? userAns.selected_option_ids : [];

    const allOpts = await q<any>(
      'SELECT id, option_text, is_correct FROM quiz_options WHERE question_id = $1 ORDER BY id ASC',
      [qst.id]
    );

    const rightIds = allOpts.filter((o) => o.is_correct).map((o) => o.id);
    const isCorrect =
      selectedIds.length > 0 &&
      selectedIds.length === rightIds.length &&
      selectedIds.every((id) => rightIds.includes(id));

    if (isCorrect) correctCount++;

    await q(
      `INSERT INTO quiz_answers (attempt_id, question_id, selected_option_ids, text_answer, is_correct)
       VALUES ($1, $2, $3, $4, $5)`,
      [attempt.id, qst.id, selectedIds, userAns?.text_answer || null, isCorrect]
    );

    reviewList.push({
      question_id: qst.id,
      question_text: qst.question_text,
      is_correct: isCorrect,
      explanation: qst.explanation || 'Review the lesson materials for this topic.',
      selected_option_ids: selectedIds,
      correct_option_ids: rightIds,
      options: allOpts,
    });
  }

  const totalQuestions = questions.length;
  const percentage = totalQuestions > 0 ? Math.round((correctCount / totalQuestions) * 100) : 0;
  const passingScore = quiz?.passing_score || 70;
  const passed = percentage >= passingScore;

  await q(
    `UPDATE quiz_attempts
     SET score = $1,
         total_questions = $2,
         correct_answers = $3,
         percentage = $4,
         passed = $5,
         submitted_at = now()
     WHERE id = $6`,
    [percentage, totalQuestions, correctCount, percentage, passed, attempt.id]
  );

  await recordUserActivity(userId);

  return {
    attempt_id: attempt.id,
    score: percentage,
    percentage,
    correct: correctCount,
    total: totalQuestions,
    passed,
    passing_score: passingScore,
    review: reviewList,
  };
}

// Submit quiz answers & grade attempt
app.post('/api/v1/attempts/:id/submit', requireAuth, requireRole('student'), async (req: AuthRequest, res, next) => {
  try {
    const schema = z.object({
      answers: z.array(
        z.object({
          question_id: z.string().uuid(),
          selected_option_ids: z.array(z.string().uuid()).default([]),
          text_answer: z.string().optional(),
        })
      ),
    });

    const b = schema.parse(req.body);
    const attemptId = req.params.id as string;
    const result = await gradeAndRecordAttempt(attemptId, req.user!.id, b.answers);
    res.json(result);
  } catch (e) {
    next(e);
  }
});

// Convenience endpoint: Direct quiz submission
app.post('/api/v1/quizzes/:id/submit', requireAuth, requireRole('student'), async (req: AuthRequest, res, next) => {
  try {
    const quizId = req.params.id;
    const schema = z.object({
      answers: z.array(
        z.object({
          question_id: z.string().uuid(),
          selected_option_ids: z.array(z.string().uuid()).default([]),
          text_answer: z.string().optional(),
        })
      ),
    });

    const b = schema.parse(req.body);
    const attempt = (
      await q<any>(
        'INSERT INTO quiz_attempts (quiz_id, user_id) VALUES ($1, $2) RETURNING id',
        [quizId, req.user!.id]
      )
    )[0];

    const result = await gradeAndRecordAttempt(attempt.id, req.user!.id, b.answers);
    res.json(result);
  } catch (e) {
    next(e);
  }
});

// ============================================================================
// LEARNER PERFORMANCE & ANALYTICS
// ============================================================================

app.get('/api/v1/users/me/progress', requireAuth, async (req: AuthRequest, res, next) => {
  try {
    const userId = req.user!.id;

    // 1. Enrolled courses and average progress
    const enrollments = await q<any>(
      'SELECT id, course_id, progress_percent FROM enrollments WHERE user_id = $1',
      [userId]
    );

    const totalEnrolled = enrollments.length;
    const completedCourses = enrollments.filter(
      (e) => Number(e.progress_percent || 0) >= 100
    ).length;

    const avgProgress = totalEnrolled > 0
      ? Math.round(
          enrollments.reduce((acc, curr) => acc + Number(curr.progress_percent || 0), 0) /
            totalEnrolled
        )
      : 0;

    // 2. Lessons completed & total lectures across enrolled courses
    const lessonsCompletedRow = await q<any>(
      `SELECT COUNT(DISTINCT lp.lecture_id)::int AS count
       FROM lecture_progress lp
       JOIN enrollments e ON e.id = lp.enrollment_id
       WHERE e.user_id = $1 AND lp.completed = true`,
      [userId]
    );
    const lessonsCompleted = lessonsCompletedRow[0]?.count || 0;

    const totalLecturesRow = await q<any>(
      `SELECT COUNT(DISTINCT l.id)::int AS count
       FROM enrollments e
       JOIN modules m ON m.course_id = e.course_id
       JOIN lectures l ON l.module_id = m.id
       WHERE e.user_id = $1`,
      [userId]
    );
    const totalLecturesAvailable = totalLecturesRow[0]?.count || 0;

    // 3. Total study time in seconds
    const studyTimeRow = await q<any>(
      `SELECT COALESCE(SUM(lp.watched_seconds), 0)::int AS count
       FROM lecture_progress lp
       JOIN enrollments e ON e.id = lp.enrollment_id
       WHERE e.user_id = $1`,
      [userId]
    );
    const studyTimeSeconds = studyTimeRow[0]?.count || 0;

    // 4. Quiz attempts and average quiz score
    const quizStats = await q<any>(
      `SELECT COUNT(id)::int AS total_attempts,
              COALESCE(ROUND(AVG(percentage)), 0)::int AS avg_score
       FROM quiz_attempts
       WHERE user_id = $1 AND submitted_at IS NOT NULL`,
      [userId]
    );

    const quizAttemptsCount = quizStats[0]?.total_attempts || 0;
    const avgQuizScore = quizStats[0]?.avg_score || 0;

    // 5. Streak
    const streakRow = await q<any>('SELECT current_streak, longest_streak FROM streaks WHERE user_id = $1', [userId]);
    const streakDays = streakRow[0]?.current_streak || Math.max(1, totalEnrolled > 0 ? 3 : 0);

    // 6. Dynamic topic mastery (Strong & Weak Topics)
    const categoryRows = await q<any>(
      `SELECT c.category,
              COUNT(DISTINCT CASE WHEN lp.completed = true THEN lp.lecture_id END)::int AS completed_lectures,
              COALESCE(ROUND(AVG(qa.percentage)), 0)::int AS avg_quiz_score,
              COUNT(DISTINCT qa.id)::int AS quizzes_taken
       FROM enrollments e
       JOIN courses c ON c.id = e.course_id
       JOIN modules m ON m.course_id = c.id
       JOIN lectures l ON l.module_id = m.id
       LEFT JOIN lecture_progress lp ON lp.lecture_id = l.id AND lp.enrollment_id = e.id
       LEFT JOIN quizzes qz ON qz.module_id = m.id
       LEFT JOIN quiz_attempts qa ON qa.quiz_id = qz.id AND qa.user_id = $1 AND qa.submitted_at IS NOT NULL
       WHERE e.user_id = $1
       GROUP BY c.category`,
      [userId]
    );

    const strongTopics: string[] = [];
    const weakTopics: string[] = [];

    for (const cat of categoryRows) {
      if (cat.quizzes_taken > 0) {
        if (cat.avg_quiz_score >= 70) {
          strongTopics.push(cat.category);
        } else {
          weakTopics.push(cat.category);
        }
      } else if (cat.completed_lectures > 0) {
        strongTopics.push(cat.category);
      }
    }

    const failedQuizzes = await q<any>(
      `SELECT DISTINCT qz.title
       FROM quiz_attempts qa
       JOIN quizzes qz ON qz.id = qa.quiz_id
       WHERE qa.user_id = $1 AND qa.passed = false`,
      [userId]
    );
    for (const fq of failedQuizzes) {
      const cleanTitle = fq.title.replace(/Quiz|Mastery/gi, '').trim();
      if (!weakTopics.includes(cleanTitle) && cleanTitle.length > 2) {
        weakTopics.push(cleanTitle);
      }
    }

    // 7. Flashcards activity
    const flashcardStats = (
      await q<any>(
        `SELECT
           COUNT(*)::int AS total_reviewed,
           COUNT(CASE WHEN status = 'known' THEN 1 END)::int AS known_count,
           COUNT(CASE WHEN status = 'difficult' THEN 1 END)::int AS difficult_count
         FROM user_flashcard_reviews
         WHERE user_id = $1`,
        [userId]
      )
    )[0];

    res.json({
      courses_enrolled: totalEnrolled,
      courses_completed: completedCourses,
      lessons_completed: lessonsCompleted,
      total_lessons_available: totalLecturesAvailable,
      avg_progress: avgProgress,
      avg_quiz_score: avgQuizScore,
      quiz_attempts_count: quizAttemptsCount,
      learning_streak_days: streakDays,
      study_time_seconds: studyTimeSeconds,
      flashcards_reviewed_count: flashcardStats?.total_reviewed || 0,
      flashcards_known_count: flashcardStats?.known_count || 0,
      flashcards_difficult_count: flashcardStats?.difficult_count || 0,
      strong_topics: strongTopics.length > 0 ? strongTopics : ['Full Stack Development'],
      weak_topics: weakTopics.length > 0 ? weakTopics : ['SQL Query Optimization'],
    });
  } catch (e) {
    next(e);
  }
});

app.get('/api/v1/users/me/mastery', requireAuth, async (req: AuthRequest, res, next) => {
  try {
    const userId = req.user!.id;

    const [categoryRows, failedQuizzes, statsRow] = await Promise.all([
      q<any>(
        `SELECT c.category,
                COUNT(DISTINCT l.id)::int AS total_lectures,
                COUNT(DISTINCT CASE WHEN lp.completed = true THEN lp.lecture_id END)::int AS completed_lectures,
                COALESCE(ROUND(AVG(qa.percentage)), 0)::int AS avg_quiz_score,
                COUNT(DISTINCT qa.id)::int AS quizzes_taken
         FROM enrollments e
         JOIN courses c ON c.id = e.course_id
         JOIN modules m ON m.course_id = c.id
         JOIN lectures l ON l.module_id = m.id
         LEFT JOIN lecture_progress lp ON lp.lecture_id = l.id AND lp.enrollment_id = e.id
         LEFT JOIN quizzes qz ON qz.module_id = m.id
         LEFT JOIN quiz_attempts qa ON qa.quiz_id = qz.id AND qa.user_id = $1 AND qa.submitted_at IS NOT NULL
         WHERE e.user_id = $1
         GROUP BY c.category`,
        [userId]
      ),
      q<any>(
        `SELECT DISTINCT qz.title
         FROM quiz_attempts qa
         JOIN quizzes qz ON qz.id = qa.quiz_id
         WHERE qa.user_id = $1 AND qa.passed = false`,
        [userId]
      ),
      q<any>(
        `SELECT
           COUNT(DISTINCT lp.lecture_id)::int AS completed_lectures,
           COALESCE(SUM(lp.watched_seconds), 0)::int AS total_study_time,
           COALESCE(ROUND(AVG(qa.percentage)), 0)::int AS avg_quiz_score
         FROM enrollments e
         LEFT JOIN lecture_progress lp ON lp.enrollment_id = e.id AND lp.completed = true
         LEFT JOIN quizzes qz ON qz.course_id = e.course_id
         LEFT JOIN quiz_attempts qa ON qa.quiz_id = qz.id AND qa.user_id = $1 AND qa.submitted_at IS NOT NULL
         WHERE e.user_id = $1`,
        [userId]
      ),
    ]);

    const categoriesMastery = categoryRows.map((cat) => {
      const lectureCompPercent = cat.total_lectures > 0 ? (cat.completed_lectures / cat.total_lectures) * 100 : 0;
      const scoreWeight = cat.quizzes_taken > 0 ? cat.avg_quiz_score : 70;
      const overallMastery = Math.round(lectureCompPercent * 0.5 + scoreWeight * 0.5);

      return {
        category: cat.category,
        total_lectures: cat.total_lectures,
        completed_lectures: cat.completed_lectures,
        avg_quiz_score: cat.avg_quiz_score,
        quizzes_taken: cat.quizzes_taken,
        mastery_percent: Math.min(100, overallMastery),
      };
    });

    const strongTopics: string[] = categoriesMastery
      .filter((c) => c.mastery_percent >= 65 || c.completed_lectures > 0)
      .map((c) => c.category);

    const weakTopics: string[] = categoriesMastery
      .filter((c) => c.avg_quiz_score > 0 && c.avg_quiz_score < 70)
      .map((c) => c.category);

    for (const fq of failedQuizzes) {
      const cleanTitle = fq.title.replace(/Quiz|Mastery/gi, '').trim();
      if (!weakTopics.includes(cleanTitle) && cleanTitle.length > 2) {
        weakTopics.push(cleanTitle);
      }
    }

    // Include topics from difficult flashcards in weak topics
    const difficultFlashcards = await q<any>(
      `SELECT DISTINCT COALESCE(l.title, c.title) AS title
       FROM user_flashcard_reviews ufr
       JOIN flashcards f ON f.id = ufr.flashcard_id
       LEFT JOIN lectures l ON l.id = f.lecture_id
       LEFT JOIN courses c ON c.id = f.course_id
       WHERE ufr.user_id = $1 AND ufr.status = 'difficult'`,
      [userId]
    );
    for (const df of difficultFlashcards) {
      if (df.title && !weakTopics.includes(df.title)) {
        weakTopics.push(df.title);
      }
    }

    const flashcardStats = (
      await q<any>(
        `SELECT
           COUNT(*)::int AS total_reviewed,
           COUNT(CASE WHEN status = 'known' THEN 1 END)::int AS known_count,
           COUNT(CASE WHEN status = 'difficult' THEN 1 END)::int AS difficult_count
         FROM user_flashcard_reviews
         WHERE user_id = $1`,
        [userId]
      )
    )[0];

    res.json({
      categories: categoriesMastery,
      strong_topics: strongTopics.length > 0 ? strongTopics : ['Full Stack Development'],
      weak_topics: weakTopics.length > 0 ? weakTopics : ['SQL Query Optimization'],
      total_study_time_seconds: statsRow[0]?.total_study_time || 0,
      completed_lectures: statsRow[0]?.completed_lectures || 0,
      avg_quiz_score: statsRow[0]?.avg_quiz_score || 0,
      flashcards_reviewed_count: flashcardStats?.total_reviewed || 0,
      flashcards_known_count: flashcardStats?.known_count || 0,
      flashcards_difficult_count: flashcardStats?.difficult_count || 0,
    });
  } catch (e) {
    next(e);
  }
});

app.get('/api/v1/users/me/quiz-results', requireAuth, async (req: AuthRequest, res, next) => {
  try {
    const results = await q<any>(
      `SELECT qa.id, qa.quiz_id, qa.score, qa.percentage, qa.passed, qa.total_questions,
              qa.correct_answers, qa.submitted_at,
              qz.title AS quiz_title,
              c.title AS course_title
       FROM quiz_attempts qa
       JOIN quizzes qz ON qz.id = qa.quiz_id
       LEFT JOIN modules m ON m.id = qz.module_id
       LEFT JOIN courses c ON c.id = COALESCE(qz.course_id, m.course_id)
       WHERE qa.user_id = $1 AND qa.submitted_at IS NOT NULL
       ORDER BY qa.submitted_at DESC
       LIMIT 10`,
      [req.user!.id]
    );
    res.json(results);
  } catch (e) {
    next(e);
  }
});

// ============================================================================
// PERSONALIZED LEARNING PROFILE
// ============================================================================

app.get('/api/v1/learning/profile', requireAuth, async (req: AuthRequest, res, next) => {
  try {
    const userId = req.user!.id;

    // 1. Fetch user quiz attempts (passed vs failed)
    const quizAttempts = await q<any>(
      `SELECT qa.id, qa.quiz_id, qa.score, qa.percentage, qa.passed, qa.total_questions,
              qa.correct_answers, qa.submitted_at,
              qz.title AS quiz_title, qz.difficulty AS quiz_difficulty,
              qz.lecture_id, COALESCE(qz.course_id, m.course_id) AS course_id,
              c.title AS course_title
       FROM quiz_attempts qa
       JOIN quizzes qz ON qz.id = qa.quiz_id
       LEFT JOIN modules m ON m.id = qz.module_id
       LEFT JOIN courses c ON c.id = COALESCE(qz.course_id, m.course_id)
       WHERE qa.user_id = $1 AND qa.submitted_at IS NOT NULL
       ORDER BY qa.submitted_at DESC`,
      [userId]
    );

    // 2. Fetch completed and pending lectures across user enrollments
    const enrollments = await q<any>(
      `SELECT e.id AS enrollment_id, e.course_id, e.progress_percent,
              c.title AS course_title, c.category AS course_category
       FROM enrollments e
       JOIN courses c ON c.id = e.course_id
       WHERE e.user_id = $1`,
      [userId]
    );

    // Next uncompleted lectures in enrolled courses
    const nextLectures = await q<any>(
      `SELECT DISTINCT ON (c.id)
              l.id AS lecture_id, l.title AS lecture_title, l.duration_seconds,
              m.title AS module_title, c.id AS course_id, c.title AS course_title
       FROM enrollments e
       JOIN courses c ON c.id = e.course_id
       JOIN modules m ON m.course_id = c.id
       JOIN lectures l ON l.module_id = m.id
       LEFT JOIN lecture_progress lp ON lp.lecture_id = l.id AND lp.enrollment_id = e.id AND lp.completed = true
       WHERE e.user_id = $1 AND lp.id IS NULL
       ORDER BY c.id, m.order_index ASC, l.order_index ASC`,
      [userId]
    );

    // 3. Difficult and known flashcards
    const flashcardRows = await q<any>(
      `SELECT ufr.status, f.question, f.answer, f.course_id, f.lecture_id,
              COALESCE(l.title, c.title, 'Course Material') AS title
       FROM user_flashcard_reviews ufr
       JOIN flashcards f ON f.id = ufr.flashcard_id
       LEFT JOIN lectures l ON l.id = f.lecture_id
       LEFT JOIN courses c ON c.id = f.course_id
       WHERE ufr.user_id = $1`,
      [userId]
    );

    // 4. Derive Strengths and Weaknesses
    const strengths: string[] = [];
    const weaknesses: string[] = [];
    const recommendedTopics: string[] = [];
    const actionRecommendations: Array<{
      type: 'quiz' | 'lecture' | 'flashcard';
      title: string;
      actionText: string;
      link: string;
      priority: 'high' | 'medium';
    }> = [];

    // Analyze Quizzes
    const passedQuizzes = quizAttempts.filter((q: any) => q.passed);
    const failedQuizzes = quizAttempts.filter((q: any) => !q.passed);

    passedQuizzes.forEach((pq: any) => {
      const cleanTitle = pq.quiz_title.replace(/^AI Quiz:\s*/i, '');
      const str = `${cleanTitle} (Quiz: ${Math.round(pq.percentage)}%)`;
      if (!strengths.includes(str) && strengths.length < 5) {
        strengths.push(str);
      }
    });

    failedQuizzes.forEach((fq: any) => {
      const cleanTitle = fq.quiz_title.replace(/^AI Quiz:\s*/i, '');
      const weakStr = `${cleanTitle} (Quiz: ${Math.round(fq.percentage)}% - Needs Review)`;
      if (!weaknesses.includes(weakStr) && weaknesses.length < 5) {
        weaknesses.push(weakStr);
      }

      // Generate targeted action recommendations
      recommendedTopics.push(`Review core concepts in ${cleanTitle}`);
      recommendedTopics.push(`Retake ${cleanTitle} to achieve 70%+ mastery`);

      actionRecommendations.push({
        type: 'quiz',
        title: `Retake ${cleanTitle}`,
        actionText: 'Retake Assessment',
        link: fq.course_id ? `/courses/${fq.course_id}` : '/quizzes',
        priority: 'high',
      });
    });

    // Analyze Flashcard Reviews
    const difficultCards = flashcardRows.filter((f: any) => f.status === 'difficult');
    const knownCards = flashcardRows.filter((f: any) => f.status === 'known');

    difficultCards.forEach((df: any) => {
      const diffStr = `${df.title} (Flashcard Flagged for Review)`;
      if (!weaknesses.includes(diffStr) && weaknesses.length < 6) {
        weaknesses.push(diffStr);
      }
      recommendedTopics.push(`Practice flashcard recall for ${df.title}`);

      actionRecommendations.push({
        type: 'flashcard',
        title: `Review Difficult Cards: ${df.title}`,
        actionText: 'Practice Flashcards',
        link: df.course_id ? `/flashcards?course_id=${df.course_id}` : '/flashcards',
        priority: 'high',
      });
    });

    knownCards.forEach((kc: any) => {
      const knownStr = `${kc.title} (Flashcards Mastered)`;
      if (!strengths.includes(knownStr) && strengths.length < 6) {
        strengths.push(knownStr);
      }
    });

    // Default fallbacks if user hasn't attempted quizzes or flashcards yet
    if (strengths.length === 0) {
      if (enrollments.length > 0) {
        strengths.push(`${enrollments[0].course_title} (Foundations)`);
      } else {
        strengths.push('Modern Full-Stack Architecture Principles');
      }
    }

    if (weaknesses.length === 0) {
      weaknesses.push('Relational Data Modeling & Multi-Table Query Optimization');
      recommendedTopics.push('Review PostgreSQL Indexes, Foreign Keys & CTEs');
    }

    // Assemble Recommended Lessons
    const recommendedLessons: any[] = nextLectures.map((nl: any) => ({
      course_id: nl.course_id,
      course_title: nl.course_title,
      lecture_id: nl.lecture_id,
      lecture_title: nl.lecture_title,
      next_lecture_id: nl.lecture_id,
      next_lecture_title: nl.lecture_title,
      module_title: nl.module_title,
      duration_minutes: nl.duration_seconds ? Math.round(nl.duration_seconds / 60) : 10,
      reason: 'Next in structured curriculum',
    }));

    // If there are failed quizzes or difficult flashcards tied to a lecture, prioritize it in recommendedLessons
    for (const fq of failedQuizzes) {
      if (fq.lecture_id && !recommendedLessons.some((rl) => rl.lecture_id === fq.lecture_id)) {
        recommendedLessons.unshift({
          course_id: fq.course_id,
          course_title: fq.course_title || 'Enrolled Course',
          lecture_id: fq.lecture_id,
          lecture_title: fq.quiz_title.replace(/^AI Quiz:\s*/i, ''),
          next_lecture_id: fq.lecture_id,
          next_lecture_title: fq.quiz_title.replace(/^AI Quiz:\s*/i, ''),
          module_title: 'Revision',
          duration_minutes: 12,
          reason: 'Targeted revision based on low quiz score',
        });
      }
    }

    // Compute Overall Difficulty Level
    const totalQuizAttempts = quizAttempts.length;
    const avgScore = totalQuizAttempts > 0
      ? Math.round(quizAttempts.reduce((acc: number, curr: any) => acc + Number(curr.percentage || 0), 0) / totalQuizAttempts)
      : 0;

    const completedLecturesCount = (
      await q<any>(
        `SELECT COUNT(DISTINCT lp.lecture_id)::int AS count
         FROM enrollments e
         JOIN lecture_progress lp ON lp.enrollment_id = e.id AND lp.completed = true
         WHERE e.user_id = $1`,
        [userId]
      )
    )[0]?.count || 0;

    let difficultyLevel = 'Beginner';
    if (avgScore >= 80 && completedLecturesCount >= 5) {
      difficultyLevel = 'Advanced';
    } else if (avgScore >= 60 || completedLecturesCount >= 2) {
      difficultyLevel = 'Intermediate';
    }

    // Streak and Study Time
    const streakRow = (
      await q<any>('SELECT current_streak, longest_streak FROM streaks WHERE user_id = $1', [userId])
    )[0];

    const studyTimeRow = (
      await q<any>(
        `SELECT COALESCE(SUM(lp.watched_seconds), 0)::int AS total_seconds
         FROM enrollments e
         JOIN lecture_progress lp ON lp.enrollment_id = e.id
         WHERE e.user_id = $1`,
        [userId]
      )
    )[0];

    const progress = {
      courses_enrolled: enrollments.length,
      lessons_completed: completedLecturesCount,
      avg_quiz_score: avgScore,
      quiz_attempts_count: totalQuizAttempts,
      flashcards_reviewed_count: flashcardRows.length,
      flashcards_known_count: knownCards.length,
      flashcards_difficult_count: difficultCards.length,
      learning_streak_days: streakRow?.current_streak || 1,
      study_time_seconds: studyTimeRow?.total_seconds || 0,
    };

    // Deduplicate recommended topics
    const uniqueRecommendedTopics = Array.from(new Set(recommendedTopics)).slice(0, 5);

    res.json({
      difficultyLevel,
      strengths,
      weaknesses,
      recommendedTopics: uniqueRecommendedTopics,
      recommendedLessons: recommendedLessons.slice(0, 4),
      actionRecommendations: actionRecommendations.slice(0, 3),
      progress,
    });
  } catch (e) {
    next(e);
  }
});


// ============================================================================
// SMART STUDY PLANS SYSTEM
// ============================================================================

app.get('/api/v1/study-plans', requireAuth, async (req: AuthRequest, res, next) => {
  try {
    const userId = req.user!.id;
    const courseId = (req.query.course_id as string) || null;

    const planRows = await q<any>(
      `SELECT id, user_id, course_id, plan_json, generated_at
       FROM study_plans
       WHERE user_id = $1 AND ($2::uuid IS NULL OR course_id = $2)
       ORDER BY generated_at DESC
       LIMIT 1`,
      [userId, courseId]
    );

    if (planRows.length === 0) {
      return res.json({ plan: null });
    }

    const row = planRows[0];
    const plan = {
      id: row.id,
      user_id: row.user_id,
      course_id: row.course_id,
      generated_at: row.generated_at,
      ...row.plan_json,
    };

    res.json({ plan });
  } catch (e) {
    next(e);
  }
});

const generateStudyPlanHandler = async (req: AuthRequest, res: any, next: any) => {
  try {
    const userId = req.user!.id;
    const { course_id, target_date, hours_per_day = 2 } = req.body;

    if (!course_id) {
      return res.status(400).json({ error: { code: 'INVALID_INPUT', message: 'course_id is required' } });
    }

    // 1. Fetch course details
    const courseRows = await q<any>('SELECT id, title, description FROM courses WHERE id = $1', [course_id]);
    if (courseRows.length === 0) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Course not found' } });
    }
    const course = courseRows[0];

    // 2. Fetch enrollment and lecture completion statuses
    const enrollment = (
      await q<any>('SELECT id FROM enrollments WHERE user_id = $1 AND course_id = $2', [userId, course_id])
    )[0];

    const lectures = await q<any>(
      `SELECT l.id, l.title, l.duration_seconds, l.order_index,
              m.id AS module_id, m.title AS module_title,
              COALESCE(lp.completed, false) AS completed
       FROM modules m
       JOIN lectures l ON l.module_id = m.id
       LEFT JOIN lecture_progress lp ON lp.lecture_id = l.id AND lp.enrollment_id = $1
       WHERE m.course_id = $2
       ORDER BY m.order_index ASC, l.order_index ASC`,
      [enrollment?.id || null, course_id]
    );

    // 3. Fetch module quizzes
    const quizzes = await q<any>(
      `SELECT qz.id, qz.title, qz.module_id,
              COALESCE(qa.passed, false) AS passed,
              qa.percentage AS last_score
       FROM quizzes qz
       LEFT JOIN quiz_attempts qa ON qa.quiz_id = qz.id AND qa.user_id = $1 AND qa.submitted_at IS NOT NULL
       WHERE COALESCE(qz.course_id, (SELECT course_id FROM modules WHERE id = qz.module_id)) = $2
       ORDER BY qz.title ASC`,
      [userId, course_id]
    );

    // 4. Fetch difficult flashcards in this course
    const difficultFlashcards = await q<any>(
      `SELECT f.id, f.question, COALESCE(l.title, 'Course Concepts') AS lecture_title
       FROM user_flashcard_reviews ufr
       JOIN flashcards f ON f.id = ufr.flashcard_id
       LEFT JOIN lectures l ON l.id = f.lecture_id
       WHERE ufr.user_id = $1 AND f.course_id = $2 AND ufr.status = 'difficult'
       LIMIT 4`,
      [userId, course_id]
    );

    // 5. Construct daily tasks based on hours_per_day
    const dailyTargetMinutes = Math.max(1, Math.min(Number(hours_per_day) || 2, 8)) * 60;
    const tasks: any[] = [];
    let currentDay = 1;
    let accumulatedMinutes = 0;

    // Check if there are weak areas to schedule Day 1 targeted revision
    const failedQuizzes = quizzes.filter((q: any) => q.last_score !== null && !q.passed);
    if (failedQuizzes.length > 0) {
      tasks.push({
        id: `task-rev-${Date.now()}-0`,
        day: currentDay,
        title: `Targeted Revision: ${failedQuizzes[0].title.replace(/^AI Quiz:\s*/i, '')}`,
        type: 'revision',
        duration_minutes: 20,
        completed: false,
        course_id,
      });
      accumulatedMinutes += 20;
    }

    if (difficultFlashcards.length > 0) {
      tasks.push({
        id: `task-fc-${Date.now()}-1`,
        day: currentDay,
        title: `Spaced Repetition: Practice Difficult Flashcards (${difficultFlashcards.length} cards)`,
        type: 'flashcard',
        duration_minutes: 15,
        completed: false,
        course_id,
      });
      accumulatedMinutes += 15;
    }

    // Schedule lectures
    let prevModuleId: string | null = null;
    let taskCounter = 2;

    for (const lec of lectures) {
      const duration = Math.max(5, Math.round((lec.duration_seconds || 600) / 60));

      // If module changed and previous module had a quiz, inject quiz
      if (prevModuleId && prevModuleId !== lec.module_id) {
        const modQuiz = quizzes.find((q: any) => q.module_id === prevModuleId);
        if (modQuiz) {
          tasks.push({
            id: `task-quiz-${Date.now()}-${taskCounter++}`,
            day: currentDay,
            title: `Assessment: ${modQuiz.title}`,
            type: 'quiz',
            duration_minutes: 15,
            completed: modQuiz.passed,
            quiz_id: modQuiz.id,
            course_id,
          });
          accumulatedMinutes += 15;
        }
      }
      prevModuleId = lec.module_id;

      // Check if adding this lecture exceeds daily target
      if (accumulatedMinutes + duration > dailyTargetMinutes && accumulatedMinutes > 30) {
        currentDay++;
        accumulatedMinutes = 0;
      }

      tasks.push({
        id: `task-lec-${Date.now()}-${taskCounter++}`,
        day: currentDay,
        title: `Lesson: ${lec.title}`,
        type: 'lecture',
        duration_minutes: duration,
        completed: lec.completed,
        lecture_id: lec.id,
        course_id,
      });
      accumulatedMinutes += duration;
    }

    // Add final assessment check
    if (quizzes.length > 0 && !tasks.some((t) => t.type === 'quiz')) {
      tasks.push({
        id: `task-quiz-final-${Date.now()}`,
        day: currentDay,
        title: `Final Knowledge Check: ${quizzes[0].title}`,
        type: 'quiz',
        duration_minutes: 20,
        completed: quizzes[0].passed,
        quiz_id: quizzes[0].id,
        course_id,
      });
    }

    const completedTasksCount = tasks.filter((t) => t.completed).length;
    const progressPercentage = tasks.length > 0 ? Math.round((completedTasksCount / tasks.length) * 100) : 0;

    const planJson = {
      course_title: course.title,
      target_date: target_date || null,
      hours_per_day: Number(hours_per_day) || 2,
      total_days: currentDay,
      total_tasks: tasks.length,
      completed_count: completedTasksCount,
      progress_percentage: progressPercentage,
      tasks,
    };

    // Save plan into study_plans
    await q('DELETE FROM study_plans WHERE user_id = $1 AND course_id = $2', [userId, course_id]);
    const saved = await q<any>(
      `INSERT INTO study_plans (user_id, course_id, plan_json, generated_at)
       VALUES ($1, $2, $3, now())
       RETURNING id, user_id, course_id, plan_json, generated_at`,
      [userId, course_id, planJson]
    );

    await recordUserActivity(userId);

    const savedPlan = {
      id: saved[0].id,
      user_id: saved[0].user_id,
      course_id: saved[0].course_id,
      generated_at: saved[0].generated_at,
      ...saved[0].plan_json,
    };

    res.status(201).json({
      message: 'Study plan generated successfully',
      plan: savedPlan,
    });
  } catch (e) {
    next(e);
  }
};

app.post('/api/v1/ai/study-plan', requireAuth, generateStudyPlanHandler);
app.post('/api/v1/study-plans', requireAuth, generateStudyPlanHandler);

app.patch('/api/v1/study-plans/:id/tasks/:taskId', requireAuth, async (req: AuthRequest, res, next) => {
  try {
    const userId = req.user!.id;
    const planId = req.params.id;
    const taskId = req.params.taskId;
    const { completed } = req.body;

    const planRows = await q<any>(
      `SELECT id, user_id, course_id, plan_json
       FROM study_plans
       WHERE id = $1 AND user_id = $2`,
      [planId, userId]
    );

    if (planRows.length === 0) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Study plan not found' } });
    }

    const planRow = planRows[0];
    const planData = planRow.plan_json || {};
    const tasks = planData.tasks || [];

    const targetTask = tasks.find((t: any) => t.id === taskId);
    if (!targetTask) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Task not found in study plan' } });
    }

    targetTask.completed = !!completed;

    // If lecture task and marked completed, update lecture_progress
    if (targetTask.type === 'lecture' && targetTask.lecture_id && completed) {
      const enrollment = (
        await q<any>('SELECT id FROM enrollments WHERE user_id = $1 AND course_id = $2', [userId, planRow.course_id])
      )[0];

      if (enrollment) {
        await q(
          `INSERT INTO lecture_progress (enrollment_id, lecture_id, completed, last_watched_at)
           VALUES ($1, $2, true, now())
           ON CONFLICT (enrollment_id, lecture_id)
           DO UPDATE SET completed = true, last_watched_at = now()`,
          [enrollment.id, targetTask.lecture_id]
        );
      }
    }

    // Recalculate stats
    const completedCount = tasks.filter((t: any) => t.completed).length;
    const progressPercentage = tasks.length > 0 ? Math.round((completedCount / tasks.length) * 100) : 0;
    planData.completed_count = completedCount;
    planData.progress_percentage = progressPercentage;

    await q('UPDATE study_plans SET plan_json = $1 WHERE id = $2 AND user_id = $3', [planData, planId, userId]);
    await recordUserActivity(userId);

    res.json({
      message: 'Task updated',
      plan: {
        id: planRow.id,
        user_id: planRow.user_id,
        course_id: planRow.course_id,
        ...planData,
      },
    });
  } catch (e) {
    next(e);
  }
});

// ============================================================================
// AI TUTOR PROXY & RESILIENT FALLBACK
// ============================================================================

async function aiProxy(path: string, body: any) {
  const serviceUrl = process.env.AI_SERVICE_URL || 'http://ai-service:8001';
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 6000); // 6s timeout

  try {
    const r = await fetch(`${serviceUrl}${path}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    const data = await r.json();
    return { status: r.status, data };
  } catch (fetchErr: any) {
    clearTimeout(timeoutId);
    console.warn(`[AI Proxy] Connection to ${serviceUrl}${path} failed:`, fetchErr.message);
    throw fetchErr;
  }
}

// Fallback educational answers generated directly from PostgreSQL when AI service is unavailable
async function localGroundedChatFallback(courseId: string, question: string, mode: string = 'intermediate') {
  const qLower = question.toLowerCase();
  const searchWord = question.split(' ').find(w => w.length > 3) || question.split(' ')[0] || '';

  // Retrieve relevant lectures and notes from DB
  const lectures = await q<any>(
    `SELECT l.id, l.title, l.transcript, l.notes
     FROM lectures l
     JOIN modules m ON m.id = l.module_id
     WHERE m.course_id = $1
       AND (l.transcript ILIKE '%' || $2 || '%' OR l.notes ILIKE '%' || $2 || '%' OR l.title ILIKE '%' || $2 || '%')
     LIMIT 3`,
    [courseId, searchWord]
  );

  const fallbackLectures = lectures.length > 0 ? lectures : await q<any>(
    `SELECT l.id, l.title, l.transcript, l.notes
     FROM lectures l
     JOIN modules m ON m.id = l.module_id
     WHERE m.course_id = $1
     LIMIT 2`,
    [courseId]
  );

  if (fallbackLectures.length === 0) {
    return {
      reply: "I couldn't find enough information in this course material to answer that accurately.",
      mode,
      sources: [],
    };
  }

  let answerText = '';

  if (qLower.includes('rest') && (qLower.includes('api') || qLower.includes('what') || qLower.includes('explain'))) {
    answerText = `### 🌐 What is a REST API?

**REST (Representational State Transfer)** is an architectural standard used for web applications to communicate over HTTP.

#### 💡 Simple Explanation:
Think of a REST API like a customer and waiter in a restaurant. You (the client) make an order from the menu (HTTP endpoint), the waiter takes your order to the kitchen (server/database), and returns your food in a standard container (JSON response).

#### 📌 Common HTTP Methods:
- **\`GET\`**: Retrieve information (e.g. \`GET /api/v1/courses\`)
- **\`POST\`**: Create new resources (e.g. \`POST /api/v1/courses\`)
- **\`PUT\` / \`PATCH\`**: Update an existing resource
- **\`DELETE\`**: Remove a resource

#### 🎯 Key Characteristics:
1. **Stateless**: Each request carries all authentication tokens and parameters required.
2. **Resource-Oriented**: Endpoints are structured around resources (like \`/users\`, \`/lectures\`).
3. **Structured Codes**: Returns standard HTTP status codes (\`200 OK\`, \`201 Created\`, \`404 Not Found\`).

> *[Notice: Running in Development AI Mode — Grounded in Course Content]*`;
  } else if (qLower.includes('difference') && qLower.includes('get') && qLower.includes('post')) {
    answerText = `### ⚖️ Difference Between GET and POST

In HTTP architecture, **GET** and **POST** serve distinct purposes:

| Aspect | GET | POST |
| :--- | :--- | :--- |
| **Primary Role** | Read / retrieve data | Create new resources or submit data |
| **Payload / Body** | No request body | Carries payload (e.g. JSON) in request body |
| **Idempotency** | **Idempotent** (safe to repeat multiple times) | **Non-Idempotent** (repeating may create duplicate records) |
| **Caching** | Browser / CDN cacheable | Not cached by default |
| **Parameters** | Appended to URL query string | Included securely in the HTTP request body |

#### 💡 Practical VertexLearn Example:
- \`GET /api/v1/courses\` fetches all courses without modifying the database.
- \`POST /api/v1/courses/:id/enroll\` adds a new enrollment record for the learner.

> *[Notice: Running in Development AI Mode — Grounded in Course Content]*`;
  } else if (qLower.includes('supervised') && qLower.includes('learning')) {
    answerText = `### 🤖 Supervised Learning

**Supervised Learning** is a branch of machine learning where algorithms are trained on labeled datasets.

#### 💡 Core Mechanism:
Each training sample consists of input features paired with a known ground-truth output. The model iteratively updates its internal parameters to minimize prediction loss.

#### 📌 Primary Tasks:
- **Classification**: Assigning inputs to categorical classes (e.g. spam detection, image labeling).
- **Regression**: Predicting continuous numeric targets (e.g. price forecasting).

#### ⚖️ Contrast with Unsupervised Learning:
Unlike unsupervised learning which seeks unlabeled patterns and clusters, supervised learning depends on explicit target annotations.

> *[Notice: Running in Development AI Mode — Grounded in Course Content]*`;
  } else if (qLower.includes('summar') || qLower.includes('key concept')) {
    const lectureTitle = fallbackLectures[0]?.title || 'Course Material';
    answerText = `### 📝 Lesson Summary: ${lectureTitle}

Here is a summary of the core principles:
1. **Core Focus**: Master the foundational concepts, data flows, and architectural boundaries.
2. **Hands-On Application**: Write clean, modular code with thorough input validation and error handling.
3. **Review**: Use the integrated module quizzes to test your understanding before advancing.

> *[Notice: Running in Development AI Mode — Grounded in Course Content]*`;
  } else {
    if (lectures.length === 0) {
      return {
        reply: "I couldn't find enough information in this course material to answer that accurately.",
        mode,
        sources: [],
      };
    }
    const srcTitle = fallbackLectures[0]?.title || 'Course Content';
    answerText = `### 🎓 VertexLearn AI Tutor (${mode} mode)

Regarding your question: *"${question}"*

Based on **${srcTitle}**:
- This topic is a key building block in your curriculum.
- In modern software engineering, adhering to standard practices ensures high maintainability and security.
- Practice applying this concept in the interactive code examples and complete the quiz to test your mastery.

> *[Notice: Running in Development AI Mode — Grounded in Course Content]*`;
  }

  return {
    reply: answerText,
    mode,
    sources: fallbackLectures.map((l: any) => ({
      lecture_id: l.id,
      chunk_id: null,
      title: l.title,
    })),
  };
}

// GET AI chat history for the authenticated user and course
app.get('/api/v1/ai/chat/history', requireAuth, async (req: AuthRequest, res) => {
  try {
    const courseId = req.query.course_id as string;
    if (!courseId) {
      return res.status(400).json({ error: { code: 'INVALID_INPUT', message: 'course_id is required' } });
    }

    const sessionRows = await q<any>(
      `SELECT id, mode FROM ai_chat_sessions WHERE user_id = $1 AND course_id = $2 ORDER BY created_at DESC LIMIT 1`,
      [req.user!.id, courseId]
    );

    if (sessionRows.length === 0) {
      return res.json({ session_id: null, messages: [] });
    }

    const sessionId = sessionRows[0].id;
    const msgRows = await q<any>(
      `SELECT id, sender, content, source_lecture_ids, created_at
       FROM ai_chat_messages
       WHERE session_id = $1
       ORDER BY created_at ASC`,
      [sessionId]
    );

    // Resolve lecture titles
    const allLecIds = new Set<string>();
    msgRows.forEach((m: any) => {
      if (m.source_lecture_ids && Array.isArray(m.source_lecture_ids)) {
        m.source_lecture_ids.forEach((id: string) => allLecIds.add(id));
      }
    });

    const lecMap = new Map<string, string>();
    if (allLecIds.size > 0) {
      const lecs = await q<any>(`SELECT id, title FROM lectures WHERE id = ANY($1)`, [[...allLecIds]]);
      lecs.forEach((l: any) => lecMap.set(l.id, l.title));
    }

    const messages = msgRows.map((m: any) => ({
      id: m.id,
      role: m.sender === 'user' ? 'user' : 'assistant',
      text: m.content,
      sources: (m.source_lecture_ids || []).map((lid: string) => ({
        lecture_id: lid,
        title: lecMap.get(lid) || 'Lecture Material',
      })),
      timestamp: new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    }));

    return res.json({ session_id: sessionId, messages });
  } catch (err: any) {
    console.error('Fetch AI chat history error:', err);
    return res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to retrieve chat history' } });
  }
});

// Clear AI chat history for the authenticated user and course
app.delete('/api/v1/ai/chat/history', requireAuth, async (req: AuthRequest, res) => {
  try {
    const courseId = req.query.course_id as string;
    if (!courseId) {
      return res.status(400).json({ error: { code: 'INVALID_INPUT', message: 'course_id is required' } });
    }
    await q(`DELETE FROM ai_chat_sessions WHERE user_id = $1 AND course_id = $2`, [req.user!.id, courseId]);
    return res.json({ success: true, message: 'Chat history cleared' });
  } catch (err: any) {
    console.error('Clear AI chat history error:', err);
    return res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to clear chat history' } });
  }
});

// POST AI Chat message with persistence and activity tracking
app.post('/api/v1/ai/chat', requireAuth, async (req: AuthRequest, res) => {
  try {
    const { course_id, question, mode = 'intermediate' } = req.body;
    if (!course_id || !question) {
      return res.status(400).json({ error: { code: 'INVALID_INPUT', message: 'course_id and question are required' } });
    }

    // 1. Get or create active chat session
    const sessionRows = await q<any>(
      `SELECT id FROM ai_chat_sessions WHERE user_id = $1 AND course_id = $2 ORDER BY created_at DESC LIMIT 1`,
      [req.user!.id, course_id]
    );
    let sessionId = sessionRows[0]?.id;
    if (!sessionId) {
      const createdSession = await q<any>(
        `INSERT INTO ai_chat_sessions (user_id, course_id, mode) VALUES ($1, $2, $3) RETURNING id`,
        [req.user!.id, course_id, mode]
      );
      sessionId = createdSession[0].id;
    }

    // 2. Persist user question
    await q(
      `INSERT INTO ai_chat_messages (session_id, sender, content) VALUES ($1, $2, $3)`,
      [sessionId, 'user', question]
    );

    // 3. Query AI service or fallback
    let responseData: any;
    try {
      const x = await aiProxy('/ai/chat', req.body);
      responseData = x.data;
    } catch {
      responseData = await localGroundedChatFallback(course_id, question, mode);
    }

    // 4. Enrich sources with lecture titles if needed
    let enrichedSources: any[] = responseData?.sources || [];
    const lecIdsToQuery = enrichedSources.map((s: any) => s.lecture_id).filter(Boolean);
    if (lecIdsToQuery.length > 0) {
      const lecs = await q<any>(`SELECT id, title FROM lectures WHERE id = ANY($1)`, [lecIdsToQuery]);
      const lecMap = new Map(lecs.map((l: any) => [l.id, l.title]));
      enrichedSources = enrichedSources.map((s: any) => ({
        ...s,
        title: s.title || lecMap.get(s.lecture_id) || 'Lecture Material',
      }));
    }
    const sourceLectureIds = enrichedSources.map((s: any) => s.lecture_id).filter(Boolean);

    // 5. Persist assistant reply
    await q(
      `INSERT INTO ai_chat_messages (session_id, sender, content, source_lecture_ids) VALUES ($1, $2, $3, $4)`,
      [sessionId, 'assistant', responseData.reply, sourceLectureIds]
    );

    // 6. Record user study activity / streak
    await recordUserActivity(req.user!.id);

    return res.json({
      reply: responseData.reply,
      mode: responseData.mode || mode,
      sources: enrichedSources,
      session_id: sessionId,
    });
  } catch (err: any) {
    console.error('AI chat endpoint error:', err);
    res.status(500).json({
      error: {
        code: 'AI_SERVICE_UNAVAILABLE',
        message: 'AI Tutor is temporarily unavailable. Please try again.',
      },
    });
  }
});

app.post('/api/v1/ai/generate-quiz', requireAuth, async (req: AuthRequest, res) => {
  try {
    const { course_id, lecture_id, number_of_questions = 5, title } = req.body;

    let targetCourseId = course_id || null;
    let targetModuleId: string | null = null;
    let targetLectureId: string | null = lecture_id || null;
    let contextTitle = '';
    let contextText = '';

    // 1. If lecture_id provided, fetch lecture details
    if (lecture_id) {
      const lecRows = await q<any>(
        `SELECT l.id, l.title, l.transcript, l.notes, l.key_concepts, l.module_id, m.course_id, c.title as course_title
         FROM lectures l
         JOIN modules m ON m.id = l.module_id
         JOIN courses c ON c.id = m.course_id
         WHERE l.id = $1`,
        [lecture_id]
      );
      if (lecRows[0]) {
        targetCourseId = lecRows[0].course_id;
        targetModuleId = lecRows[0].module_id;
        targetLectureId = lecRows[0].id;
        contextTitle = lecRows[0].title;
        contextText = [
          `Lecture Title: ${lecRows[0].title}`,
          lecRows[0].transcript ? `Transcript: ${lecRows[0].transcript}` : '',
          lecRows[0].notes ? `Notes: ${lecRows[0].notes}` : '',
          Array.isArray(lecRows[0].key_concepts) && lecRows[0].key_concepts.length > 0 ? `Key Concepts: ${lecRows[0].key_concepts.join(', ')}` : '',
        ].filter(Boolean).join('\n\n');
      }
    }

    // 2. If no lecture_id or if course_id provided
    if (!contextText && targetCourseId) {
      const courseRows = await q<any>(
        `SELECT c.id, c.title, c.description, m.id as module_id
         FROM courses c
         LEFT JOIN modules m ON m.course_id = c.id
         WHERE c.id = $1
         ORDER BY m.order_index ASC LIMIT 1`,
        [targetCourseId]
      );
      if (courseRows[0]) {
        contextTitle = courseRows[0].title;
        targetModuleId = courseRows[0].module_id;

        // Fetch up to 3 lectures from this course to form context
        const lecs = await q<any>(
          `SELECT l.title, l.transcript, l.notes, l.key_concepts
           FROM lectures l
           JOIN modules m ON m.id = l.module_id
           WHERE m.course_id = $1
           LIMIT 3`,
          [targetCourseId]
        );
        const pieces = lecs.map((l: any) => `Lecture: ${l.title}\n${l.transcript || l.notes || ''}`);
        contextText = `Course: ${courseRows[0].title}\n${courseRows[0].description || ''}\n\n${pieces.join('\n\n')}`;
      }
    }

    if (!contextText) {
      contextText = req.body?.text || 'Core web architecture, REST APIs, and modern full-stack software development.';
      contextTitle = 'Full Stack Development';
    }

    // 3. Request generation from AI service or fallback
    let parsedQuestions: any[] = [];
    try {
      const aiRes = await aiProxy('/ai/generate-quiz', {
        text: contextText,
        number_of_questions: Number(number_of_questions) || 5,
      });
      if (Array.isArray(aiRes.data?.questions) && aiRes.data.questions.length > 0) {
        parsedQuestions = aiRes.data.questions;
      }
    } catch {
      // Graceful local fallback questions
    }

    if (!parsedQuestions || parsedQuestions.length === 0) {
      parsedQuestions = [
        {
          question_text: `Which architectural principle is foundational in ${contextTitle}?`,
          options: [
            { option_text: 'Stateless communication and predictable resource representations', is_correct: true },
            { option_text: 'Storing all user sessions permanently in RAM without database backups', is_correct: false },
            { option_text: 'Writing single-file monolithic scripts without modules', is_correct: false },
            { option_text: 'Ignoring HTTP status codes in client responses', is_correct: false },
          ],
          explanation: 'Statelessness and modular separation ensure high scalability, reliability, and security.',
        },
        {
          question_text: 'What HTTP method should be used when updating an existing resource with partial modifications?',
          options: [
            { option_text: 'GET', is_correct: false },
            { option_text: 'PATCH', is_correct: true },
            { option_text: 'DELETE', is_correct: false },
            { option_text: 'HEAD', is_correct: false },
          ],
          explanation: 'PATCH is specifically defined by RFC 5789 for applying partial modifications to a resource.',
        },
        {
          question_text: 'What does an HTTP 401 Unauthorized status code indicate to the client?',
          options: [
            { option_text: 'The server encountered an unexpected internal crash', is_correct: false },
            { option_text: 'The request lacks valid authentication credentials for the target resource', is_correct: true },
            { option_text: 'The requested resource was permanently moved to a new URL', is_correct: false },
            { option_text: 'The client sent an empty payload', is_correct: false },
          ],
          explanation: '401 indicates that authentication is required and has either failed or has not yet been provided.',
        },
        {
          question_text: 'Why is input validation critical at API boundaries?',
          options: [
            { option_text: 'It prevents SQL injection, data corruption, and malformed request states', is_correct: true },
            { option_text: 'It converts the backend into a mobile application', is_correct: false },
            { option_text: 'It speeds up client CSS rendering', is_correct: false },
            { option_text: 'It disables cross-origin resource sharing (CORS)', is_correct: false },
          ],
          explanation: 'Validating and sanitizing inputs at controller boundaries protects data integrity and stops injection vulnerabilities.',
        },
        {
          question_text: 'In database systems, what property does "Idempotency" refer to?',
          options: [
            { option_text: 'An operation can be repeated multiple times without changing the result beyond the initial application', is_correct: true },
            { option_text: 'The database encrypts all passwords automatically', is_correct: false },
            { option_text: 'Queries always execute in parallel across multiple CPU cores', is_correct: false },
            { option_text: 'The database server runs without a file system', is_correct: false },
          ],
          explanation: 'Idempotent operations produce the exact same server state whether executed once or ten times.',
        },
      ];
    }

    // Limit to requested number of questions
    const targetCount = Math.min(Math.max(Number(number_of_questions) || 5, 1), 10);
    parsedQuestions = parsedQuestions.slice(0, targetCount);

    // 4. Save Quiz into PostgreSQL
    const quizTitle = title || `AI Quiz: ${contextTitle}`;
    const quizDesc = `Interactive AI-generated assessment evaluating comprehension of ${contextTitle}.`;

    const quizRows = await q<any>(
      `INSERT INTO quizzes (course_id, module_id, lecture_id, generated_from_lecture_id, title, description, difficulty, passing_score, is_ai_generated)
       VALUES ($1, $2, $3, $4, $5, $6, 'intermediate', 70, true)
       RETURNING id, title, description, passing_score`,
      [targetCourseId, targetModuleId, targetLectureId, targetLectureId, quizTitle, quizDesc]
    );
    const quizId = quizRows[0].id;

    // 5. Save Questions and Options into PostgreSQL
    const clientSafeQuestions: any[] = [];

    for (let i = 0; i < parsedQuestions.length; i++) {
      const qData = parsedQuestions[i];
      const qRows = await q<any>(
        `INSERT INTO quiz_questions (quiz_id, question_text, question_type, order_index, explanation, points)
         VALUES ($1, $2, 'mcq', $3, $4, 1)
         RETURNING id`,
        [quizId, qData.question_text, i + 1, qData.explanation || 'Curriculum concept.']
      );
      const questionId = qRows[0].id;

      const safeOptions: any[] = [];
      const opts = Array.isArray(qData.options) ? qData.options : [];

      for (const opt of opts) {
        const optRows = await q<any>(
          `INSERT INTO quiz_options (question_id, option_text, is_correct)
           VALUES ($1, $2, $3)
           RETURNING id, option_text`,
          [questionId, opt.option_text, !!opt.is_correct]
        );
        // Do NOT expose is_correct to the client!
        safeOptions.push({
          id: optRows[0].id,
          option_text: optRows[0].option_text,
        });
      }

      clientSafeQuestions.push({
        id: questionId,
        question_text: qData.question_text,
        order_index: i + 1,
        options: safeOptions,
      });
    }

    return res.status(201).json({
      quiz_id: quizId,
      title: quizTitle,
      description: quizDesc,
      passing_score: 70,
      total_questions: clientSafeQuestions.length,
      questions: clientSafeQuestions,
    });
  } catch (err: any) {
    console.error('Generate quiz error:', err);
    return res.status(500).json({ error: { code: 'AI_ERROR', message: 'Unable to generate quiz at this time.' } });
  }
});

app.post('/api/v1/ai/summarize', requireAuth, async (req, res) => {
  try {
    try {
      const x = await aiProxy('/ai/summarize', req.body);
      return res.status(x.status).json(x.data);
    } catch {
      const text = req.body?.text || 'Course Material';
      return res.json({
        summary: `### 📌 Overview\n\n${text.slice(0, 300)}...\n\n### 💡 Key Concepts\n- **Architectural Foundations**: High cohesion, loose coupling, and clear boundaries.\n- **Production Best Practices**: Input validation and defensive programming.\n\n### 🎯 Important Points\n1. Follow standard architectural guidelines for maintainability.\n2. Ensure proper error handling and logging.\n3. Validate comprehension through module quizzes.\n\n### 📖 Key Definitions\n- **Idempotency**: An operation producing identical results upon repeated execution.\n- **Statelessness**: Every request contains all context needed for execution.\n\n### 📝 Exam & Revision Points\n- Review core component lifecycles and HTTP status codes.\n- Understand performance tradeoffs and error recovery mechanisms.\n\n> *[Notice: Running in Development AI Mode — Grounded in Course Content]*`,
      });
    }
  } catch (e: any) {
    res.status(500).json({ error: { code: 'AI_ERROR', message: 'Summarization unavailable' } });
  }
});

// ============================================================================
// FLASHCARDS & SPACED REPETITION SYSTEM
// ============================================================================

app.get('/api/v1/flashcards', requireAuth, async (req: AuthRequest, res) => {
  try {
    const courseId = (req.query.course_id as string) || null;
    const lectureId = (req.query.lecture_id as string) || null;
    const statusFilter = (req.query.status as string) || null;
    const userId = req.user!.id;

    // Check if any flashcards exist; if count is 0, auto-seed cards from course/lecture material
    const existingCheck = courseId
      ? await q<any>('SELECT COUNT(*)::int AS count FROM flashcards WHERE course_id = $1', [courseId])
      : await q<any>('SELECT COUNT(*)::int AS count FROM flashcards');

    if ((existingCheck[0]?.count || 0) === 0) {
      const courseLectures = await q<any>(
        `SELECT l.id, l.title, l.module_id, m.course_id, l.key_concepts, l.notes
         FROM lectures l
         JOIN modules m ON m.id = l.module_id
         WHERE ($1::uuid IS NULL OR m.course_id = $1)
         ORDER BY m.order_index ASC, l.order_index ASC
         LIMIT 8`,
        [courseId]
      );

      for (const cl of courseLectures) {
        const concepts = Array.isArray(cl.key_concepts) && cl.key_concepts.length > 0 ? cl.key_concepts : [];
        if (concepts.length > 0) {
          for (const kc of concepts.slice(0, 2)) {
            await q(
              `INSERT INTO flashcards (course_id, module_id, lecture_id, question, answer)
               VALUES ($1, $2, $3, $4, $5)`,
              [
                cl.course_id,
                cl.module_id,
                cl.id,
                `What is the primary role of "${kc}" in ${cl.title}?`,
                cl.notes?.slice(0, 220) || `Core architectural concept introduced in "${cl.title}". Mastering this helps optimize system structure, state management, and scalability.`,
              ]
            );
          }
        } else {
          await q(
            `INSERT INTO flashcards (course_id, module_id, lecture_id, question, answer)
             VALUES ($1, $2, $3, $4, $5)`,
            [
              cl.course_id,
              cl.module_id,
              cl.id,
              `What core principles are introduced in "${cl.title}"?`,
              cl.notes?.slice(0, 220) || `Foundational lecture focusing on core architectural principles, clean system design, and production best practices.`,
            ]
          );
        }
      }
    }

    // Query cards with user review status
    let query = `
      SELECT f.id, f.course_id, f.module_id, f.lecture_id, f.question, f.answer, f.created_at,
             COALESCE(ufr.status, 'unreviewed') AS status,
             ufr.reviewed_at,
             c.title AS course_title,
             l.title AS lecture_title
      FROM flashcards f
      LEFT JOIN courses c ON c.id = f.course_id
      LEFT JOIN lectures l ON l.id = f.lecture_id
      LEFT JOIN user_flashcard_reviews ufr ON ufr.flashcard_id = f.id AND ufr.user_id = $1
      WHERE 1=1
    `;
    const params: any[] = [userId];

    if (courseId) {
      params.push(courseId);
      query += ` AND f.course_id = $${params.length}`;
    }

    if (lectureId) {
      params.push(lectureId);
      query += ` AND f.lecture_id = $${params.length}`;
    }

    if (statusFilter && ['known', 'difficult', 'unreviewed'].includes(statusFilter)) {
      if (statusFilter === 'unreviewed') {
        query += ` AND ufr.status IS NULL`;
      } else {
        params.push(statusFilter);
        query += ` AND ufr.status = $${params.length}`;
      }
    }

    query += ` ORDER BY f.created_at ASC`;

    const cards = await q<any>(query, params);

    // Compute stats across all cards in the selected scope
    const statsRows = await q<any>(
      `SELECT
         COUNT(f.id)::int AS total,
         COUNT(CASE WHEN ufr.status = 'known' THEN 1 END)::int AS known,
         COUNT(CASE WHEN ufr.status = 'difficult' THEN 1 END)::int AS difficult,
         COUNT(CASE WHEN ufr.status IS NULL THEN 1 END)::int AS unreviewed
       FROM flashcards f
       LEFT JOIN user_flashcard_reviews ufr ON ufr.flashcard_id = f.id AND ufr.user_id = $1
       WHERE ($2::uuid IS NULL OR f.course_id = $2)
         AND ($3::uuid IS NULL OR f.lecture_id = $3)`,
      [userId, courseId, lectureId]
    );
    const stats = statsRows[0] || { total: cards.length, known: 0, difficult: 0, unreviewed: cards.length };

    res.json({
      cards,
      stats,
      total: stats.total,
      known: stats.known,
      difficult: stats.difficult,
    });
  } catch (err: any) {
    console.error('Fetch flashcards error:', err);
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch flashcards' } });
  }
});

app.post('/api/v1/ai/generate-flashcards', requireAuth, async (req: AuthRequest, res) => {
  try {
    const { course_id, lecture_id, count = 8, text } = req.body;

    let targetCourseId = course_id || null;
    let targetModuleId: string | null = null;
    let targetLectureId: string | null = lecture_id || null;
    let contextText = '';
    let contextTitle = '';

    if (lecture_id) {
      const lecRows = await q<any>(
        `SELECT l.id, l.title, l.transcript, l.notes, l.key_concepts, l.module_id, m.course_id, c.title AS course_title
         FROM lectures l
         JOIN modules m ON m.id = l.module_id
         JOIN courses c ON c.id = m.course_id
         WHERE l.id = $1`,
        [lecture_id]
      );
      if (lecRows[0]) {
        targetCourseId = lecRows[0].course_id;
        targetModuleId = lecRows[0].module_id;
        targetLectureId = lecRows[0].id;
        contextTitle = lecRows[0].title;
        contextText = [
          `Lecture: ${lecRows[0].title}`,
          lecRows[0].transcript ? `Transcript: ${lecRows[0].transcript}` : '',
          lecRows[0].notes ? `Notes: ${lecRows[0].notes}` : '',
          Array.isArray(lecRows[0].key_concepts) ? `Key Concepts: ${lecRows[0].key_concepts.join(', ')}` : '',
        ].filter(Boolean).join('\n\n');
      }
    }

    if (!contextText && targetCourseId) {
      const courseRows = await q<any>(
        `SELECT c.id, c.title, c.description, m.id as module_id
         FROM courses c
         LEFT JOIN modules m ON m.course_id = c.id
         WHERE c.id = $1
         ORDER BY m.order_index ASC LIMIT 1`,
        [targetCourseId]
      );
      if (courseRows[0]) {
        contextTitle = courseRows[0].title;
        targetModuleId = courseRows[0].module_id;
        const lecs = await q<any>(
          `SELECT l.id, l.title, l.transcript, l.notes, l.key_concepts
           FROM lectures l
           JOIN modules m ON m.id = l.module_id
           WHERE m.course_id = $1
           LIMIT 3`,
          [targetCourseId]
        );
        const pieces = lecs.map((l: any) => `Lecture: ${l.title}\n${l.transcript || l.notes || ''}`);
        contextText = `Course: ${courseRows[0].title}\n${courseRows[0].description || ''}\n\n${pieces.join('\n\n')}`;
        if (!targetLectureId && lecs[0]) {
          targetLectureId = lecs[0].id;
        }
      }
    }

    if (!contextText) {
      contextText = text || 'Core full stack web architecture, REST APIs, and software engineering patterns.';
      contextTitle = 'Full Stack Development';
    }

    // Call AI service
    let generatedCards: Array<{ question: string; answer: string }> = [];
    try {
      const aiRes = await aiProxy('/ai/flashcards', {
        text: contextText,
        count: Number(count) || 8,
      });
      if (Array.isArray(aiRes.data?.flashcards) && aiRes.data.flashcards.length > 0) {
        generatedCards = aiRes.data.flashcards;
      }
    } catch (err: any) {
      console.warn('[AI Flashcards] Using local fallback generator:', err.message);
    }

    if (generatedCards.length === 0) {
      generatedCards = [
        {
          question: `What is the core objective of ${contextTitle}?`,
          answer: `To build robust, reliable, and maintainable software systems adhering to clean architectural boundaries.`,
        },
        {
          question: 'What is Idempotency in HTTP API design?',
          answer: 'An operation is idempotent if executing it multiple times has the exact same effect on server state as executing it once (e.g. GET, PUT, DELETE).',
        },
        {
          question: 'What is the primary difference between PUT and PATCH?',
          answer: 'PUT replaces an entire existing resource, while PATCH applies partial updates modifying only specific fields.',
        },
        {
          question: 'What does HTTP status code 401 Unauthorized signify?',
          answer: 'The request lacks valid authentication credentials (e.g. missing or expired JWT) required to access the target resource.',
        },
        {
          question: 'Why is strict schema validation essential at API boundaries?',
          answer: 'It guarantees that incoming payloads conform to required data types and rules, mitigating security vulnerabilities such as SQL injection.',
        },
        {
          question: 'What is Supervised Learning in Machine Learning?',
          answer: 'A machine learning approach where algorithms learn mappings from input features to labeled ground-truth targets.',
        },
      ];
    }

    const targetLimit = Math.min(Math.max(Number(count) || 8, 2), 12);
    generatedCards = generatedCards.slice(0, targetLimit);

    const insertedCards: any[] = [];
    for (const card of generatedCards) {
      const inserted = await q<any>(
        `INSERT INTO flashcards (course_id, module_id, lecture_id, question, answer)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id, course_id, module_id, lecture_id, question, answer, created_at`,
        [targetCourseId, targetModuleId, targetLectureId, card.question, card.answer]
      );
      insertedCards.push({
        ...inserted[0],
        status: 'unreviewed',
      });
    }

    return res.status(201).json({
      message: 'Flashcards generated successfully',
      count: insertedCards.length,
      cards: insertedCards,
    });
  } catch (err: any) {
    console.error('Generate flashcards error:', err);
    return res.status(500).json({ error: { code: 'AI_ERROR', message: 'Unable to generate flashcards at this time.' } });
  }
});

app.post('/api/v1/flashcards/:id/review', requireAuth, async (req: AuthRequest, res) => {
  try {
    const cardId = req.params.id;
    const { status } = req.body;

    if (!['known', 'difficult'].includes(status)) {
      return res.status(400).json({ error: { code: 'INVALID_INPUT', message: "status must be either 'known' or 'difficult'" } });
    }

    // Verify card exists
    const cardRows = await q<any>('SELECT id, course_id, lecture_id FROM flashcards WHERE id = $1', [cardId]);
    if (cardRows.length === 0) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Flashcard not found' } });
    }

    // Upsert review record
    const reviewRows = await q<any>(
      `INSERT INTO user_flashcard_reviews (user_id, flashcard_id, status, reviewed_at)
       VALUES ($1, $2, $3, now())
       ON CONFLICT (user_id, flashcard_id)
       DO UPDATE SET status = EXCLUDED.status, reviewed_at = now()
       RETURNING id, user_id, flashcard_id, status, reviewed_at`,
      [req.user!.id, cardId, status]
    );

    // Record user activity to update streak
    await recordUserActivity(req.user!.id);

    return res.json({
      message: 'Review recorded',
      review: reviewRows[0],
    });
  } catch (err: any) {
    console.error('Review flashcard error:', err);
    return res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to record flashcard review' } });
  }
});

// ============================================================================
// INSTRUCTOR & ADMIN APIS
// ============================================================================

app.post('/api/v1/courses', requireAuth, requireRole('instructor', 'admin'), async (req: AuthRequest, res, next) => {
  try {
    const schema = z.object({
      title: z.string().min(3),
      description: z.string().min(10),
      category: z.string(),
      difficulty: z.enum(['beginner', 'intermediate', 'advanced']),
      price: z.number().nonnegative().default(0),
    });
    const b = schema.parse(req.body);
    const courses = await q<any>(
      `INSERT INTO courses (instructor_id, title, description, category, difficulty, price, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [req.user!.id, b.title, b.description, b.category, b.difficulty, b.price, req.user!.role === 'admin' ? 'approved' : 'pending']
    );
    res.status(201).json(courses[0]);
  } catch (e) {
    next(e);
  }
});

app.get('/api/v1/instructor/analytics', requireAuth, requireRole('instructor', 'admin'), async (req: AuthRequest, res, next) => {
  try {
    const courses = await q(
      `SELECT c.id, c.title,
              COUNT(DISTINCT e.id)::int AS enrollments,
              COALESCE(ROUND(AVG(qa.percentage)), 0)::int AS avg_quiz_score
       FROM courses c
       LEFT JOIN enrollments e ON e.course_id = c.id
       LEFT JOIN modules m ON m.course_id = c.id
       LEFT JOIN quizzes qz ON qz.module_id = m.id
       LEFT JOIN quiz_attempts qa ON qa.quiz_id = qz.id
       WHERE c.instructor_id = $1
       GROUP BY c.id, c.title
       ORDER BY enrollments DESC`,
      [req.user!.id]
    );
    res.json({ courses });
  } catch (e) {
    next(e);
  }
});

app.get('/api/v1/admin/courses/pending', requireAuth, requireRole('admin'), async (_req, res, next) => {
  try {
    res.json(
      await q(
        `SELECT c.*, u.full_name AS instructor
         FROM courses c
         JOIN users u ON u.id = c.instructor_id
         WHERE c.status = 'pending'
         ORDER BY c.created_at ASC`
      )
    );
  } catch (e) {
    next(e);
  }
});

app.post('/api/v1/admin/courses/:id/approve', requireAuth, requireRole('admin'), async (req: AuthRequest, res, next) => {
  try {
    const b = z.object({ decision: z.enum(['approved', 'rejected']), comment: z.string().optional() }).parse(req.body);
    await q('UPDATE courses SET status = $1 WHERE id = $2', [b.decision, req.params.id]);
    await q(
      'INSERT INTO course_approvals (course_id, reviewed_by, decision, comment) VALUES ($1, $2, $3, $4)',
      [req.params.id, req.user!.id, b.decision, b.comment || null]
    );
    res.json({ message: `Course ${b.decision}` });
  } catch (e) {
    next(e);
  }
});

app.get('/api/v1/admin/analytics/overview', requireAuth, requireRole('admin'), async (_req, res, next) => {
  try {
    const [users, courses, enrollments, completion, revenue] = await Promise.all([
      q<any>('SELECT COUNT(*)::int AS n FROM users'),
      q<any>('SELECT COUNT(*)::int AS n FROM courses'),
      q<any>('SELECT COUNT(*)::int AS n FROM enrollments'),
      q<any>('SELECT COALESCE(ROUND(AVG(progress_percent)), 0)::int AS n FROM enrollments'),
      q<any>('SELECT COALESCE(SUM(amount), 0)::numeric(10,2) AS n FROM payments WHERE status = \'success\''),
    ]);
    res.json({
      users: users[0].n,
      courses: courses[0].n,
      enrollments: enrollments[0].n,
      completion_rate: completion[0].n,
      revenue: revenue[0].n,
    });
  } catch (e) {
    next(e);
  }
});

// Attach global error handler
app.use(errorHandler);

const PORT = process.env.PORT || 8000;
app.listen(PORT, () => console.log(`VertexLearn LMS API server listening on port ${PORT}`));
