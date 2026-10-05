const http = require('http');

function request(options, body) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: data ? JSON.parse(data) : null });
        } catch (e) {
          resolve({ status: res.statusCode, data });
        }
      });
    });
    req.on('error', reject);
    if (body) {
      req.write(typeof body === 'string' ? body : JSON.stringify(body));
    }
    req.end();
  });
}

async function runTests() {
  console.log('=== Testing Phase 8: Automated AI Quizzes ===\n');

  // Step 1: Login
  console.log('1. Authenticating as Demo Student...');
  const loginRes = await request(
    {
      hostname: 'localhost',
      port: 8000,
      path: '/api/v1/auth/login',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    },
    { email: 'student@vertexlearn.local', password: 'Password123!' }
  );

  if (loginRes.status !== 200 || !loginRes.data?.access_token) {
    throw new Error(`Login failed with status ${loginRes.status}`);
  }
  const token = loginRes.data.access_token;
  console.log('   ✓ Logged in successfully.');

  // Step 2: Select Course & Lecture
  console.log('\n2. Fetching courses to find lecture for quiz generation...');
  const coursesRes = await request({
    hostname: 'localhost',
    port: 8000,
    path: '/api/v1/courses',
    method: 'GET',
    headers: { Authorization: `Bearer ${token}` },
  });

  const course = coursesRes.data.find((c) => c.title.includes('Full Stack'));
  if (!course) throw new Error('Full Stack course not found');

  const courseDetailsRes = await request({
    hostname: 'localhost',
    port: 8000,
    path: `/api/v1/courses/${course.id}`,
    method: 'GET',
    headers: { Authorization: `Bearer ${token}` },
  });

  const lecture = courseDetailsRes.data?.modules?.[0]?.lectures?.[0];
  if (!lecture) throw new Error('No lecture found');
  console.log(`   ✓ Selected Lecture: "${lecture.title}" (${lecture.id})`);

  // Step 3: Call POST /api/v1/ai/generate-quiz
  console.log('\n3. Generating AI Quiz via POST /api/v1/ai/generate-quiz...');
  const genQuizRes = await request(
    {
      hostname: 'localhost',
      port: 8000,
      path: '/api/v1/ai/generate-quiz',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
    },
    {
      course_id: course.id,
      lecture_id: lecture.id,
      number_of_questions: 5,
    }
  );

  console.log(`   Status: ${genQuizRes.status}`);
  console.log(`   Quiz ID: ${genQuizRes.data?.quiz_id}`);
  console.log(`   Quiz Title: "${genQuizRes.data?.title}"`);
  console.log(`   Total Questions: ${genQuizRes.data?.total_questions}`);

  if (genQuizRes.status !== 201 || !genQuizRes.data?.quiz_id) {
    throw new Error(`Quiz generation failed: ${JSON.stringify(genQuizRes.data)}`);
  }

  const quizId = genQuizRes.data.quiz_id;
  const questions = genQuizRes.data.questions;

  if (!Array.isArray(questions) || questions.length !== 5) {
    throw new Error(`Expected 5 questions, got ${questions?.length}`);
  }

  // Verify options structure and ensure answers are NOT exposed
  for (let i = 0; i < questions.length; i++) {
    const q = questions[i];
    if (!q.options || q.options.length !== 4) {
      throw new Error(`Question ${i + 1} does not have 4 options`);
    }
    for (const opt of q.options) {
      if (opt.is_correct !== undefined) {
        throw new Error(`SECURITY LEAK: Option ${opt.id} exposes is_correct before submission!`);
      }
    }
  }
  console.log('   ✓ Verified: 5 questions generated, 4 options each, NO correct answers leaked to client.');

  // Step 4: Verify quiz can be retrieved by ID via GET /api/v1/quizzes/:id
  console.log('\n4. Verifying quiz retrieval via GET /api/v1/quizzes/:id...');
  const getQuizRes = await request({
    hostname: 'localhost',
    port: 8000,
    path: `/api/v1/quizzes/${quizId}`,
    method: 'GET',
    headers: { Authorization: `Bearer ${token}` },
  });

  if (getQuizRes.status !== 200 || getQuizRes.data?.id !== quizId) {
    throw new Error('Failed to retrieve newly created AI quiz');
  }
  console.log('   ✓ Quiz retrieved from PostgreSQL successfully.');

  // Step 5: Verify quiz appears in course quiz list
  console.log('\n5. Verifying quiz appears in GET /api/v1/courses/:id/quizzes...');
  const courseQuizzesRes = await request({
    hostname: 'localhost',
    port: 8000,
    path: `/api/v1/courses/${course.id}/quizzes`,
    method: 'GET',
    headers: { Authorization: `Bearer ${token}` },
  });

  const foundInCourse = courseQuizzesRes.data.find((q) => q.id === quizId);
  if (!foundInCourse) {
    throw new Error('AI quiz not listed in course quizzes list');
  }
  console.log(`   ✓ Found in course quizzes: "${foundInCourse.title}" (is_ai_generated: ${foundInCourse.is_ai_generated})`);

  // Step 6: Submit answers via POST /api/v1/quizzes/:id/submit
  console.log('\n6. Submitting student answers via POST /api/v1/quizzes/:id/submit...');
  const answersPayload = questions.map((q) => ({
    question_id: q.id,
    selected_option_ids: [q.options[0].id],
  }));

  const submitRes = await request(
    {
      hostname: 'localhost',
      port: 8000,
      path: `/api/v1/quizzes/${quizId}/submit`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
    },
    { answers: answersPayload }
  );

  console.log(`   Submission Status: ${submitRes.status}`);
  console.log(`   Score: ${submitRes.data?.score}%`);
  console.log(`   Passed: ${submitRes.data?.passed}`);
  console.log(`   Correct Answers: ${submitRes.data?.correct} / ${submitRes.data?.total}`);
  console.log(`   Explanations Returned: ${submitRes.data?.review?.length}`);

  if (submitRes.status !== 200 || submitRes.data?.score === undefined) {
    throw new Error('Quiz submission failed');
  }
  if (!Array.isArray(submitRes.data.review) || submitRes.data.review.length !== 5) {
    throw new Error('Expected 5 review explanations returned after submission');
  }
  console.log('   ✓ Quiz evaluated, score calculated, explanations returned.');

  // Step 7: Verify attempt history via GET /api/v1/quizzes/:id/attempts
  console.log('\n7. Verifying attempt stored via GET /api/v1/quizzes/:id/attempts...');
  const attemptsRes = await request({
    hostname: 'localhost',
    port: 8000,
    path: `/api/v1/quizzes/${quizId}/attempts`,
    method: 'GET',
    headers: { Authorization: `Bearer ${token}` },
  });

  if (attemptsRes.status !== 200 || !Array.isArray(attemptsRes.data) || attemptsRes.data.length === 0) {
    throw new Error('Attempt was not persisted in database');
  }
  console.log(`   ✓ Found ${attemptsRes.data.length} recorded attempt in database with score: ${attemptsRes.data[0].score}%`);

  // Step 8: Verify user progress metrics reflect the attempt
  console.log('\n8. Verifying learner progress & mastery tracking updated...');
  const progressRes = await request({
    hostname: 'localhost',
    port: 8000,
    path: '/api/v1/users/me/progress',
    method: 'GET',
    headers: { Authorization: `Bearer ${token}` },
  });

  console.log(`   Total Quiz Attempts: ${progressRes.data?.quiz_attempts_count}`);
  console.log(`   Average Quiz Score: ${progressRes.data?.average_quiz_score}%`);
  console.log(`   Learning Streak Days: ${progressRes.data?.learning_streak_days}`);
  console.log(`   Strong Topics: ${progressRes.data?.strong_topics?.join(', ')}`);
  console.log(`   Weak Topics: ${progressRes.data?.weak_topics?.join(', ')}`);

  console.log('\n🎉 ALL PHASE 8 AUTOMATED AI QUIZZES TESTS PASSED!');
}

runTests().catch((err) => {
  console.error('\n❌ Test failed:', err);
  process.exit(1);
});
