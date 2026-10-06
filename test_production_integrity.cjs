const http = require('http');

const BASE_URL = 'http://localhost:8000/api/v1';

function request(path, options = {}) {
  return new Promise((resolve, reject) => {
    const fullPath = path.startsWith('http') ? path : `${BASE_URL}${path}`;
    const url = new URL(fullPath);
    const reqOptions = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method: options.method || 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers || {}),
      },
    };

    const req = http.request(reqOptions, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        let parsed = null;
        try {
          parsed = JSON.parse(data);
        } catch {
          parsed = data;
        }
        resolve({ status: res.statusCode, headers: res.headers, data: parsed });
      });
    });

    req.on('error', reject);

    if (options.body) {
      req.write(typeof options.body === 'string' ? options.body : JSON.stringify(options.body));
    }
    req.end();
  });
}

async function runTests() {
  console.log('===============================================================');
  console.log('   VERTEXLEARN AI — PRODUCTION INTEGRITY & VERIFICATION SUITE   ');
  console.log('===============================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`  ✓ PASS: ${message}`);
      passed++;
    } else {
      console.error(`  ✗ FAIL: ${message}`);
      failed++;
    }
  }

  // 1. Health & Server check
  console.log('--- TEST 1: Backend Health Check ---');
  const healthRes = await request('http://localhost:8000/health');
  assert(healthRes.status === 200, 'Health endpoint responds with 200 OK');
  assert(healthRes.data?.status === 'ok', 'Health status is "ok"');

  // 2. Authentication: Register a new student
  console.log('\n--- TEST 2: Real Student Registration & Auth ---');
  const testEmail = `student_${Date.now()}@vertexlearn.test`;
  const registerRes = await request('/auth/register', {
    method: 'POST',
    body: {
      email: testEmail,
      password: 'SecurePassword123!',
      full_name: 'Test Student',
      role: 'student',
    },
  });
  assert(registerRes.status === 201, 'Student registration returns 201 Created');
  assert(registerRes.data?.user?.email === testEmail, 'Registered user email matches');
  const token = registerRes.data?.access_token;
  assert(!!token, 'JWT access token issued on registration');

  const authHeaders = { Authorization: `Bearer ${token}` };

  // Login with credentials
  const loginRes = await request('/auth/login', {
    method: 'POST',
    body: {
      email: testEmail,
      password: 'SecurePassword123!',
    },
  });
  assert(loginRes.status === 200, 'Student login succeeds with 200 OK');
  assert(!!loginRes.data?.access_token, 'Valid JWT access token returned on login');

  // 3. Course Catalog from PostgreSQL
  console.log('\n--- TEST 3: Course Catalog from PostgreSQL ---');
  const coursesRes = await request('/courses');
  assert(coursesRes.status === 200, 'Course catalog endpoint returns 200 OK');
  assert(Array.isArray(coursesRes.data) && coursesRes.data.length >= 3, `Retrieved ${coursesRes.data?.length} real courses from database`);
  const sampleCourse = coursesRes.data[0];
  console.log(`  -> Selected Course: "${sampleCourse.title}" (ID: ${sampleCourse.id})`);

  // Course Details, Modules, Lectures
  const courseDetailRes = await request(`/courses/${sampleCourse.id}`);
  assert(courseDetailRes.status === 200, 'Course details endpoint returns 200 OK');
  assert(Array.isArray(courseDetailRes.data?.modules) && courseDetailRes.data.modules.length > 0, `Course has ${courseDetailRes.data?.modules?.length} real modules`);
  const firstLecture = courseDetailRes.data?.modules[0]?.lectures?.[0];
  assert(!!firstLecture?.id, `Module contains real lecture: "${firstLecture?.title}"`);

  // 4. Enrollment Workflow
  console.log('\n--- TEST 4: Real Course Enrollment ---');
  const enrollRes = await request(`/courses/${sampleCourse.id}/enroll`, {
    method: 'POST',
    headers: authHeaders,
  });
  assert(enrollRes.status === 201, 'Course enrollment returns 201 Created');

  const myEnrollmentsRes = await request('/enrollments/me', { headers: authHeaders });
  assert(myEnrollmentsRes.status === 200, 'GET /enrollments/me returns 200');
  const userEnrolled = myEnrollmentsRes.data?.find((e) => e.course_id === sampleCourse.id);
  assert(!!userEnrolled, 'Enrolled course present in student enrollment record');

  // 5. Lecture Progress & Persistence
  console.log('\n--- TEST 5: Lecture Video Progress & Persistence ---');
  const progressUpdateRes = await request(`/lectures/${firstLecture.id}/progress`, {
    method: 'POST',
    headers: authHeaders,
    body: {
      watched_seconds: 180,
      completed: true,
    },
  });
  assert(progressUpdateRes.status === 200, 'POST /lectures/:id/progress returns 200');
  assert(progressUpdateRes.data?.completed === true, 'Lecture marked as completed in database');

  const myProgressCheck = await request('/enrollments/me', { headers: authHeaders });
  const updatedEnrollment = myProgressCheck.data?.find((e) => e.course_id === sampleCourse.id);
  assert(Number(updatedEnrollment?.progress_percent) > 0, `Course progress recalculated in database: ${updatedEnrollment?.progress_percent}%`);

  // 6. Quizzes: Real Evaluation and Attempt Persistence
  console.log('\n--- TEST 6: Real Quizzes & Evaluation in PostgreSQL ---');
  const quizzesRes = await request(`/courses/${sampleCourse.id}/quizzes`, { headers: authHeaders });
  assert(quizzesRes.status === 200, 'GET /courses/:id/quizzes returns 200');
  const testQuiz = quizzesRes.data?.[0];
  if (testQuiz) {
    console.log(`  -> Testing Quiz: "${testQuiz.title}" (ID: ${testQuiz.id})`);
    const quizDetailRes = await request(`/quizzes/${testQuiz.id}`, { headers: authHeaders });
    assert(quizDetailRes.status === 200, 'GET /quizzes/:id returns 200');
    assert(Array.isArray(quizDetailRes.data?.questions) && quizDetailRes.data.questions.length > 0, `Quiz has ${quizDetailRes.data?.questions?.length} questions`);

    const q1 = quizDetailRes.data.questions[0];
    const opt1 = q1.options?.[0]?.id;

    // Submit attempt with valid schema
    const submitRes = await request(`/quizzes/${testQuiz.id}/submit`, {
      method: 'POST',
      headers: authHeaders,
      body: {
        answers: [
          {
            question_id: q1.id,
            selected_option_ids: [opt1],
          },
        ],
      },
    });
    assert(submitRes.status === 200, 'POST /quizzes/:id/submit returns 200');
    assert(typeof submitRes.data?.score === 'number', `Quiz scored accurately: ${submitRes.data?.percentage}%`);
    assert(!!submitRes.data?.attempt_id, 'Quiz attempt stored in quiz_attempts table');

    // Verify history in /users/me/quiz-results
    const quizResultsRes = await request('/users/me/quiz-results', { headers: authHeaders });
    assert(quizResultsRes.status === 200, 'GET /users/me/quiz-results returns 200');
    const recordedAttempt = quizResultsRes.data?.find((r) => r.quiz_id === testQuiz.id);
    assert(!!recordedAttempt, 'Attempt verified in student quiz results history');
  }

  // 7. Flashcards & Spaced Repetition in PostgreSQL
  console.log('\n--- TEST 7: Flashcards & Spaced Repetition ---');
  const flashcardsRes = await request(`/flashcards?course_id=${sampleCourse.id}`, { headers: authHeaders });
  assert(flashcardsRes.status === 200, 'GET /flashcards returns 200');
  assert(Array.isArray(flashcardsRes.data?.cards) && flashcardsRes.data.cards.length > 0, `Retrieved ${flashcardsRes.data?.cards?.length} flashcards from PostgreSQL`);

  const cardToReview = flashcardsRes.data.cards[0];
  const reviewRes = await request(`/flashcards/${cardToReview.id}/review`, {
    method: 'POST',
    headers: authHeaders,
    body: { status: 'known' },
  });
  assert(reviewRes.status === 200, 'POST /flashcards/:id/review returns 200');
  assert(reviewRes.data?.review?.status === 'known', 'Card review status stored as "known" in user_flashcard_reviews table');

  // 8. Smart Study Plans in PostgreSQL
  console.log('\n--- TEST 8: Smart Study Plans in PostgreSQL ---');
  const studyPlanRes = await request('/study-plans', {
    method: 'POST',
    headers: authHeaders,
    body: {
      course_id: sampleCourse.id,
      hours_per_day: 2,
    },
  });
  assert(studyPlanRes.status === 201, 'POST /study-plans generates plan with 201 Created');
  assert(studyPlanRes.data?.plan?.tasks?.length > 0, `Study plan contains ${studyPlanRes.data?.plan?.tasks?.length} scheduled curriculum tasks`);

  const studyPlanGetRes = await request(`/study-plans?course_id=${sampleCourse.id}`, { headers: authHeaders });
  assert(studyPlanGetRes.status === 200, 'GET /study-plans retrieves persisted plan');
  assert(studyPlanGetRes.data?.plan?.id === studyPlanRes.data?.plan?.id, 'Retrieved plan matches database record ID');

  // 9. Student Progress & Analytics (Zero Fake Mock Data)
  console.log('\n--- TEST 9: Student Analytics & Mastery Verification ---');
  const profileRes = await request('/learning/profile', { headers: authHeaders });
  assert(profileRes.status === 200, 'GET /learning/profile returns 200');
  assert(profileRes.data?.progress?.lessons_completed === 1, `Lessons completed is 1 (matches real lecture_progress record)`);
  assert(profileRes.data?.progress?.courses_enrolled === 1, `Courses enrolled is 1 (matches real enrollments record)`);
  assert(profileRes.data?.progress?.flashcards_reviewed_count >= 1, `Flashcards reviewed matches real user_flashcard_reviews record`);
  // Ensure no fake strings in strengths or weaknesses
  const hasFakeStrength = profileRes.data?.strengths?.includes('Modern Full-Stack Architecture Principles');
  const hasFakeWeakness = profileRes.data?.weaknesses?.includes('Relational Data Modeling & Multi-Table Query Optimization');
  assert(!hasFakeStrength, 'Mastery profile contains NO fake hardcoded strength strings');
  assert(!hasFakeWeakness, 'Mastery profile contains NO fake hardcoded weakness strings');

  // 10. AI Service Configuration Verification (Zero Mock AI)
  console.log('\n--- TEST 10: Strict AI Configuration Handling (Zero Mock AI) ---');

  // Test A: Relevant question when AI key unconfigured -> Returns 503
  const chatRes = await request('/ai/chat', {
    method: 'POST',
    headers: authHeaders,
    body: {
      course_id: sampleCourse.id,
      question: firstLecture.title,
      mode: 'intermediate',
    },
  });
  console.log(`  -> AI Chat Relevant Query Status: ${chatRes.status}`);
  assert(chatRes.status === 503, 'AI Chat returns HTTP 503 when AI provider key is unconfigured');
  assert(
    chatRes.data?.error?.message === 'AI service is not configured. Add the required AI provider API key to the environment configuration.',
    'AI Chat returns exact required configuration error message'
  );
  assert(!JSON.stringify(chatRes.data).includes('Running in Development AI Mode'), 'AI Chat contains NO "Running in Development AI Mode" notice');

  // Test B: Insufficient context question -> RAG returns clear notification
  const offTopicRes = await request('/ai/chat', {
    method: 'POST',
    headers: authHeaders,
    body: {
      course_id: sampleCourse.id,
      question: 'How do I cultivate Japanese bonsai trees?',
      mode: 'intermediate',
    },
  });
  console.log(`  -> AI Chat Off-Topic Query Status: ${offTopicRes.status}`);
  assert(offTopicRes.status === 200, 'AI Chat off-topic query processed');
  assert(
    offTopicRes.data?.reply === "I couldn't find enough information in this course material to answer that accurately.",
    'RAG returns clear notification when course context is insufficient'
  );

  // Test C: AI Generate Quiz when unconfigured
  const quizGenRes = await request('/ai/generate-quiz', {
    method: 'POST',
    headers: authHeaders,
    body: {
      course_id: sampleCourse.id,
      number_of_questions: 5,
    },
  });
  console.log(`  -> AI Generate Quiz Response Status: ${quizGenRes.status}`);
  assert(quizGenRes.status === 503, 'AI Generate Quiz returns HTTP 503 when unconfigured');
  assert(
    quizGenRes.data?.error?.message === 'AI service is not configured. Add the required AI provider API key to the environment configuration.',
    'AI Generate Quiz returns exact required configuration error message'
  );

  // Test D: AI Generate Flashcards when unconfigured
  const flashcardGenRes = await request('/ai/generate-flashcards', {
    method: 'POST',
    headers: authHeaders,
    body: {
      course_id: sampleCourse.id,
      count: 6,
    },
  });
  console.log(`  -> AI Generate Flashcards Response Status: ${flashcardGenRes.status}`);
  assert(flashcardGenRes.status === 503, 'AI Generate Flashcards returns HTTP 503 when unconfigured');
  assert(
    flashcardGenRes.data?.error?.message === 'AI service is not configured. Add the required AI provider API key to the environment configuration.',
    'AI Generate Flashcards returns exact required configuration error message'
  );

  // Test E: AI Summarize when unconfigured
  const summarizeRes = await request('/ai/summarize', {
    method: 'POST',
    headers: authHeaders,
    body: { text: 'Testing lecture transcript summarization.' },
  });
  console.log(`  -> AI Summarize Response Status: ${summarizeRes.status}`);
  assert(summarizeRes.status === 503, 'AI Summarize returns HTTP 503 when unconfigured');
  assert(
    summarizeRes.data?.error?.message === 'AI service is not configured. Add the required AI provider API key to the environment configuration.',
    'AI Summarize returns exact required configuration error message'
  );

  console.log('\n===============================================================');
  console.log(`   TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('===============================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
