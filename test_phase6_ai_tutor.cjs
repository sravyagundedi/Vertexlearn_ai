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
  console.log('=== Testing Phase 6: Course-Grounded AI Tutor ===\n');

  // Step 1: Login
  console.log('1. Logging in as Demo Student...');
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
  console.log('   ✓ Logged in successfully. Token acquired.');

  // Step 2: Get Courses to find Full Stack course ID
  console.log('\n2. Fetching course catalog...');
  const coursesRes = await request({
    hostname: 'localhost',
    port: 8000,
    path: '/api/v1/courses',
    method: 'GET',
    headers: { Authorization: `Bearer ${token}` },
  });

  const fullStackCourse = coursesRes.data.find((c) => c.title.includes('Full Stack'));
  if (!fullStackCourse) throw new Error('Full Stack course not found in catalog');
  const courseId = fullStackCourse.id;
  console.log(`   ✓ Selected course: "${fullStackCourse.title}" (${courseId})`);

  // Step 3: Clear any existing chat history for clean test
  console.log('\n3. Resetting session history for course...');
  await request({
    hostname: 'localhost',
    port: 8000,
    path: `/api/v1/ai/chat/history?course_id=${courseId}`,
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
  console.log('   ✓ Session cleared.');

  // Step 4: Ask course-grounded question: "What is a REST API?"
  console.log('\n4. Sending grounded question: "What is a REST API and how does it work?"...');
  const chatRes1 = await request(
    {
      hostname: 'localhost',
      port: 8000,
      path: '/api/v1/ai/chat',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
    },
    {
      course_id: courseId,
      question: 'What is a REST API and how does it work?',
      mode: 'intermediate',
    }
  );

  console.log(`   Status: ${chatRes1.status}`);
  console.log(`   Session ID: ${chatRes1.data?.session_id}`);
  console.log(`   Reply Preview: ${chatRes1.data?.reply?.substring(0, 100)}...`);
  console.log(`   Sources Count: ${chatRes1.data?.sources?.length}`);
  if (chatRes1.data?.sources?.length > 0) {
    console.log(`   Source 1 Title: ${chatRes1.data.sources[0].title}`);
  }

  if (chatRes1.status !== 200 || !chatRes1.data?.reply || !chatRes1.data?.session_id) {
    throw new Error('Chat request failed or missing fields');
  }
  if (!chatRes1.data.sources || chatRes1.data.sources.length === 0) {
    throw new Error('Expected grounded sources for REST API query');
  }
  console.log('   ✓ Grounded reply with verified source citations verified.');

  // Step 5: Verify conversation history retrieval
  console.log('\n5. Fetching chat history via GET /api/v1/ai/chat/history...');
  const historyRes = await request({
    hostname: 'localhost',
    port: 8000,
    path: `/api/v1/ai/chat/history?course_id=${courseId}`,
    method: 'GET',
    headers: { Authorization: `Bearer ${token}` },
  });

  console.log(`   History Status: ${historyRes.status}`);
  console.log(`   Messages count in history: ${historyRes.data?.messages?.length}`);
  if (historyRes.status !== 200 || !Array.isArray(historyRes.data?.messages) || historyRes.data.messages.length < 2) {
    throw new Error('History did not return expected user + assistant messages');
  }
  const userMsg = historyRes.data.messages[0];
  const assistantMsg = historyRes.data.messages[1];
  console.log(`   User Message in DB: "${userMsg.text}" (${userMsg.role})`);
  console.log(`   Assistant Reply in DB: "${assistantMsg.text.substring(0, 60)}..." (${assistantMsg.role})`);
  console.log(`   Assistant Sources attached: ${assistantMsg.sources?.length}`);
  console.log('   ✓ History correctly persisted and retrieved.');

  // Step 6: Test insufficient context behavior (Out-of-scope query)
  console.log('\n6. Asking out-of-scope question: "What is quantum entanglement in photosynthesis?"...');
  const chatRes2 = await request(
    {
      hostname: 'localhost',
      port: 8000,
      path: '/api/v1/ai/chat',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
    },
    {
      course_id: courseId,
      question: 'What is quantum entanglement in photosynthesis?',
      mode: 'intermediate',
    }
  );

  console.log(`   Status: ${chatRes2.status}`);
  console.log(`   Reply: "${chatRes2.data?.reply}"`);
  console.log(`   Sources: ${JSON.stringify(chatRes2.data?.sources)}`);

  const expectedInsufficient = "I couldn't find enough information in this course material to answer that accurately.";
  if (chatRes2.data?.reply !== expectedInsufficient) {
    throw new Error(`Expected refusal for out-of-scope topic, got: ${chatRes2.data?.reply}`);
  }
  if (chatRes2.data?.sources && chatRes2.data.sources.length > 0) {
    throw new Error('Expected empty sources for out-of-scope question');
  }
  console.log('   ✓ Strict grounding confirmed: AI Tutor accurately refused to hallucinate on out-of-scope question.');

  // Step 7: Clear history
  console.log('\n7. Testing DELETE /api/v1/ai/chat/history...');
  const delRes = await request({
    hostname: 'localhost',
    port: 8000,
    path: `/api/v1/ai/chat/history?course_id=${courseId}`,
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
  console.log(`   Delete Status: ${delRes.status}, message: ${delRes.data?.message}`);

  const postDeleteHistory = await request({
    hostname: 'localhost',
    port: 8000,
    path: `/api/v1/ai/chat/history?course_id=${courseId}`,
    method: 'GET',
    headers: { Authorization: `Bearer ${token}` },
  });
  console.log(`   History count after delete: ${postDeleteHistory.data?.messages?.length}`);
  if (postDeleteHistory.data?.messages?.length !== 0) {
    throw new Error('Chat history was not cleared');
  }
  console.log('   ✓ Conversation history successfully cleared.');

  console.log('\n🎉 ALL PHASE 6 COURSE-GROUNDED AI TUTOR TESTS PASSED!');
}

runTests().catch((err) => {
  console.error('\n❌ Test failed:', err);
  process.exit(1);
});
