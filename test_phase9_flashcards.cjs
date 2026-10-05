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
  console.log('--- Phase 9 Verification: Interactive 3D Flashcards & Spaced Repetition ---');

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

  // 2. Fetch courses to pick a test target
  console.log('\n2. Fetching courses list...');
  const coursesRes = await request({
    hostname: 'localhost',
    port: 8000,
    path: '/api/v1/courses',
    method: 'GET',
    headers: authHeaders,
  });

  const courseList = Array.isArray(coursesRes.data) ? coursesRes.data : coursesRes.data.courses || [];
  if (courseList.length === 0) {
    throw new Error('No courses found in database');
  }
  const targetCourse = courseList[0];
  console.log(`✓ Target course: "${targetCourse.title}" (${targetCourse.id})`);

  // 3. GET /api/v1/flashcards for target course
  console.log('\n3. Fetching flashcards for target course (with auto-seeding if empty)...');
  const getCardsRes = await request({
    hostname: 'localhost',
    port: 8000,
    path: `/api/v1/flashcards?course_id=${targetCourse.id}`,
    method: 'GET',
    headers: authHeaders,
  });

  if (getCardsRes.status !== 200) {
    throw new Error(`GET /flashcards failed with status ${getCardsRes.status}: ${JSON.stringify(getCardsRes.data)}`);
  }

  const initialCards = getCardsRes.data.cards || [];
  console.log(`✓ Flashcards retrieved: ${initialCards.length} cards`);
  console.log(`✓ Stats reported:`, getCardsRes.data.stats);

  if (initialCards.length > 0) {
    console.log(`  Sample Card 1 Front: "${initialCards[0].question.slice(0, 70)}..."`);
    console.log(`  Sample Card 1 Back: "${initialCards[0].answer.slice(0, 70)}..."`);
  }

  // 4. POST /api/v1/ai/generate-flashcards
  console.log('\n4. Generating new flashcards via AI endpoint...');
  const genRes = await request(
    {
      hostname: 'localhost',
      port: 8000,
      path: '/api/v1/ai/generate-flashcards',
      method: 'POST',
      headers: authHeaders,
    },
    {
      course_id: targetCourse.id,
      count: 4,
    }
  );

  if (genRes.status !== 201) {
    throw new Error(`Generate flashcards failed with status ${genRes.status}: ${JSON.stringify(genRes.data)}`);
  }
  const generatedCards = genRes.data.cards || [];
  console.log(`✓ Successfully generated ${generatedCards.length} new flashcards`);
  console.log(`  New Card Front: "${generatedCards[0]?.question}"`);
  console.log(`  New Card Back: "${generatedCards[0]?.answer}"`);

  // 5. POST /api/v1/flashcards/:id/review (mark known and mark difficult)
  console.log('\n5. Testing spaced repetition review recording...');
  const cardToMarkKnown = generatedCards[0] || initialCards[0];
  const cardToMarkDiff = generatedCards[1] || initialCards[1] || initialCards[0];

  const reviewKnownRes = await request(
    {
      hostname: 'localhost',
      port: 8000,
      path: `/api/v1/flashcards/${cardToMarkKnown.id}/review`,
      method: 'POST',
      headers: authHeaders,
    },
    { status: 'known' }
  );

  if (reviewKnownRes.status !== 200 || reviewKnownRes.data.review?.status !== 'known') {
    throw new Error(`Mark known failed: ${JSON.stringify(reviewKnownRes.data)}`);
  }
  console.log(`✓ Card ${cardToMarkKnown.id} recorded as "known"`);

  const reviewDiffRes = await request(
    {
      hostname: 'localhost',
      port: 8000,
      path: `/api/v1/flashcards/${cardToMarkDiff.id}/review`,
      method: 'POST',
      headers: authHeaders,
    },
    { status: 'difficult' }
  );

  if (reviewDiffRes.status !== 200 || reviewDiffRes.data.review?.status !== 'difficult') {
    throw new Error(`Mark difficult failed: ${JSON.stringify(reviewDiffRes.data)}`);
  }
  console.log(`✓ Card ${cardToMarkDiff.id} recorded as "difficult"`);

  // 6. Verify status persistence and filter query
  console.log('\n6. Verifying review persistence & status filtering...');
  const diffFilterRes = await request({
    hostname: 'localhost',
    port: 8000,
    path: `/api/v1/flashcards?course_id=${targetCourse.id}&status=difficult`,
    method: 'GET',
    headers: authHeaders,
  });

  const diffCards = diffFilterRes.data.cards || [];
  console.log(`✓ Difficult filtered cards count: ${diffCards.length}`);
  const hasDiffCard = diffCards.some((c) => c.id === cardToMarkDiff.id);
  if (!hasDiffCard) {
    throw new Error('Difficult card not found in filtered list');
  }
  console.log('✓ Status filter and persistence confirmed in PostgreSQL');

  // 7. Verify Progress & Mastery tracking integration
  console.log('\n7. Verifying integration with User Progress & Topic Mastery...');
  const progressRes = await request({
    hostname: 'localhost',
    port: 8000,
    path: '/api/v1/users/me/progress',
    method: 'GET',
    headers: authHeaders,
  });

  console.log('✓ Progress stats:');
  console.log(`  - Flashcards reviewed: ${progressRes.data.flashcards_reviewed_count}`);
  console.log(`  - Flashcards known: ${progressRes.data.flashcards_known_count}`);
  console.log(`  - Flashcards difficult: ${progressRes.data.flashcards_difficult_count}`);
  console.log(`  - Learning streak: ${progressRes.data.learning_streak_days} days`);

  if (progressRes.data.flashcards_reviewed_count < 1) {
    throw new Error('Progress endpoint did not count flashcard reviews');
  }

  const masteryRes = await request({
    hostname: 'localhost',
    port: 8000,
    path: '/api/v1/users/me/mastery',
    method: 'GET',
    headers: authHeaders,
  });

  console.log('✓ Mastery stats:');
  console.log(`  - Flashcards reviewed: ${masteryRes.data.flashcards_reviewed_count}`);
  console.log(`  - Weak topics: ${JSON.stringify(masteryRes.data.weak_topics)}`);

  console.log('\n======================================================');
  console.log('🎉 ALL PHASE 9 FLASHCARD VERIFICATION CHECKS PASSED!');
  console.log('======================================================');
}

run().catch((err) => {
  console.error('\n❌ Phase 9 Verification Failed:', err);
  process.exit(1);
});
