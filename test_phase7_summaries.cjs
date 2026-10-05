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
  console.log('=== Testing Phase 7: Concise AI Summaries ===\n');

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

  // Step 2: Get course and first lecture
  console.log('\n2. Fetching courses to find a lecture for testing...');
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
  if (!lecture) throw new Error('No lecture found in first module');
  const lectureId = lecture.id;
  console.log(`   ✓ Selected Lecture: "${lecture.title}" (${lectureId})`);

  // Step 3: Test summary generation (Initial request)
  console.log('\n3. Requesting summary via GET /api/v1/lectures/:id/summary (with regenerate=true to test generation)...');
  const genRes = await request({
    hostname: 'localhost',
    port: 8000,
    path: `/api/v1/lectures/${lectureId}/summary?regenerate=true`,
    method: 'GET',
    headers: { Authorization: `Bearer ${token}` },
  });

  console.log(`   Status: ${genRes.status}`);
  console.log(`   Cached: ${genRes.data?.cached}`);
  console.log(`   Lecture Title: ${genRes.data?.lecture_title}`);
  console.log(`   Summary Length: ${genRes.data?.summary?.length} characters`);

  if (genRes.status !== 200 || !genRes.data?.summary) {
    throw new Error(`Summary generation failed: ${JSON.stringify(genRes.data)}`);
  }

  const summary = genRes.data.summary;
  console.log('\n--- Summary Content Preview ---');
  console.log(summary.substring(0, 350) + '...\n-------------------------------');

  // Verify the 5 required sections
  const requiredSections = [
    'Overview',
    'Key Concepts',
    'Important Points',
    'Definitions',
    'Exam & Revision Points',
  ];

  for (const section of requiredSections) {
    const found = summary.toLowerCase().includes(section.toLowerCase());
    if (!found) {
      throw new Error(`Summary is missing required section: "${section}"`);
    }
    console.log(`   ✓ Verified section: "${section}"`);
  }

  // Step 4: Verify Caching Behavior
  console.log('\n4. Verifying caching behavior on subsequent request...');
  const cachedRes = await request({
    hostname: 'localhost',
    port: 8000,
    path: `/api/v1/lectures/${lectureId}/summary`,
    method: 'GET',
    headers: { Authorization: `Bearer ${token}` },
  });

  console.log(`   Status: ${cachedRes.status}`);
  console.log(`   Cached: ${cachedRes.data?.cached}`);

  if (cachedRes.status !== 200) {
    throw new Error('Cached summary request failed');
  }
  if (cachedRes.data?.cached !== true) {
    throw new Error('Expected summary to be retrieved from cache (cached: true)');
  }
  if (cachedRes.data?.summary !== summary) {
    throw new Error('Cached summary content does not match stored summary');
  }
  console.log('   ✓ Database cache confirmed: retrieved existing summary instantly without regeneration.');

  // Step 5: Test POST /api/v1/lectures/:id/summary with regenerate: true
  console.log('\n5. Testing POST /api/v1/lectures/:id/summary with regenerate: true...');
  const postGenRes = await request(
    {
      hostname: 'localhost',
      port: 8000,
      path: `/api/v1/lectures/${lectureId}/summary`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
    },
    { regenerate: true }
  );

  console.log(`   Status: ${postGenRes.status}`);
  console.log(`   Cached: ${postGenRes.data?.cached}`);
  if (postGenRes.status !== 200 || !postGenRes.data?.summary) {
    throw new Error('POST summary regeneration failed');
  }
  console.log('   ✓ POST regeneration confirmed.');

  // Step 6: Test generic AI summarize endpoint POST /api/v1/ai/summarize
  console.log('\n6. Testing POST /api/v1/ai/summarize with arbitrary text...');
  const aiSumRes = await request(
    {
      hostname: 'localhost',
      port: 8000,
      path: '/api/v1/ai/summarize',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
    },
    { text: 'A REST API uses HTTP methods like GET and POST to interact with standard resources.' }
  );

  console.log(`   Status: ${aiSumRes.status}`);
  if (aiSumRes.status !== 200 || !aiSumRes.data?.summary) {
    throw new Error('Generic AI summarize failed');
  }
  console.log('   ✓ Generic AI summarize endpoint functional.');

  console.log('\n🎉 ALL PHASE 7 CONCISE AI SUMMARIES TESTS PASSED!');
}

runTests().catch((err) => {
  console.error('\n❌ Test failed:', err);
  process.exit(1);
});
