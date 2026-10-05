const http = require('http');

function request(options, body = null) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(data), raw: data });
        } catch {
          resolve({ status: res.statusCode, data, raw: data });
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

async function run() {
  console.log('--- Phase 10 Verification: Personalized Learning Profile ---');

  // 1. Authenticate student
  console.log('\n1. Logging in as student...');
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

  if (loginRes.status !== 200 || !loginRes.data.access_token) {
    throw new Error(`Login failed with status ${loginRes.status}: ${JSON.stringify(loginRes.data)}`);
  }
  const token = loginRes.data.access_token;
  const authHeaders = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };
  console.log('✓ Successfully authenticated student');

  // 2. Query GET /api/v1/learning/profile
  console.log('\n2. Calling GET /api/v1/learning/profile...');
  const profileRes = await request({
    hostname: 'localhost',
    port: 8000,
    path: '/api/v1/learning/profile',
    method: 'GET',
    headers: authHeaders,
  });

  if (profileRes.status !== 200) {
    throw new Error(`GET /learning/profile failed with status ${profileRes.status}: ${JSON.stringify(profileRes.data)}`);
  }

  const p = profileRes.data;
  console.log('✓ Received Learning Profile from backend!');
  console.log(`  - Calibrated Difficulty Level: "${p.difficultyLevel}"`);
  console.log(`  - Verified Strengths count: ${p.strengths?.length || 0}`);
  console.log(`    Strengths: ${JSON.stringify(p.strengths)}`);
  console.log(`  - Areas for Improvement count: ${p.weaknesses?.length || 0}`);
  console.log(`    Weaknesses: ${JSON.stringify(p.weaknesses)}`);
  console.log(`  - Recommended Focus Topics: ${JSON.stringify(p.recommendedTopics)}`);
  console.log(`  - Recommended Lessons count: ${p.recommendedLessons?.length || 0}`);
  console.log(`  - Action Recommendations count: ${p.actionRecommendations?.length || 0}`);

  console.log('\n3. Verifying progress analytics object...');
  console.log(`  - Courses Enrolled: ${p.progress?.courses_enrolled}`);
  console.log(`  - Lessons Completed: ${p.progress?.lessons_completed}`);
  console.log(`  - Average Quiz Score: ${p.progress?.avg_quiz_score}%`);
  console.log(`  - Quiz Attempts: ${p.progress?.quiz_attempts_count}`);
  console.log(`  - Flashcards Reviewed: ${p.progress?.flashcards_reviewed_count}`);
  console.log(`  - Flashcards Known: ${p.progress?.flashcards_known_count}`);
  console.log(`  - Flashcards Difficult: ${p.progress?.flashcards_difficult_count}`);
  console.log(`  - Learning Streak: ${p.progress?.learning_streak_days} days`);

  // Assertions
  if (!p.difficultyLevel) {
    throw new Error('difficultyLevel is missing from response');
  }
  if (!Array.isArray(p.strengths)) {
    throw new Error('strengths must be an array');
  }
  if (!Array.isArray(p.weaknesses)) {
    throw new Error('weaknesses must be an array');
  }
  if (!Array.isArray(p.recommendedTopics)) {
    throw new Error('recommendedTopics must be an array');
  }
  if (!Array.isArray(p.recommendedLessons)) {
    throw new Error('recommendedLessons must be an array');
  }
  if (!p.progress || typeof p.progress.lessons_completed !== 'number') {
    throw new Error('progress object is incomplete or invalid');
  }

  // Check that recommended lessons have real course and lecture ids
  if (p.recommendedLessons.length > 0) {
    const l1 = p.recommendedLessons[0];
    if (!l1.course_id || !l1.lecture_id || !l1.lecture_title) {
      throw new Error(`Recommended lesson structure is invalid: ${JSON.stringify(l1)}`);
    }
    console.log(`\n4. Verified sample recommended lesson: "${l1.lecture_title}" (${l1.course_title})`);
  }

  console.log('\n======================================================');
  console.log('🎉 ALL PHASE 10 PERSONALIZED LEARNING CHECKS PASSED!');
  console.log('======================================================');
}

run().catch((err) => {
  console.error('\n❌ Phase 10 Verification Failed:', err);
  process.exit(1);
});
