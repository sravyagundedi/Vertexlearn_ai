const http = require('http');

async function runPipelineTests() {
  console.log('===============================================================');
  console.log('       VERTEXLEARN AI — 7-LAYER PIPELINE INTEGRITY TESTS       ');
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

  // TEST 1: Frontend -> Backend connectivity
  console.log('--- TEST 1: Frontend -> Backend API Communication ---');
  const healthRes = await new Promise((resolve) => {
    http.get('http://localhost:8000/api/v1/health', (res) => {
      let d = ''; res.on('data', c => d += c);
      res.on('end', () => resolve({ status: res.statusCode, data: JSON.parse(d) }));
    });
  });
  assert(healthRes.status === 200, 'Backend API responds on /api/v1/health with 200');
  assert(healthRes.data?.status === 'ok', 'Backend reports service status "ok"');

  // Authenticate student to obtain token
  const loginData = JSON.stringify({ email: 'student@vertexlearn.local', password: 'Password123!' });
  const loginRes = await new Promise((resolve, reject) => {
    const req = http.request('http://localhost:8000/api/v1/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(loginData) }
    }, (res) => {
      let d = ''; res.on('data', c => d += c);
      res.on('end', () => resolve({ status: res.statusCode, data: JSON.parse(d) }));
    });
    req.on('error', reject);
    req.write(loginData);
    req.end();
  });
  assert(loginRes.status === 200, 'Student authentication succeeds');
  const token = loginRes.data?.access_token;
  assert(!!token, 'Valid JWT access token issued');

  // TEST 2: Backend -> AI Service connectivity
  console.log('\n--- TEST 2: Backend -> AI Service Connectivity ---');
  const aiHealthRes = await new Promise((resolve, reject) => {
    http.get('http://localhost:8001/health', (res) => {
      let d = ''; res.on('data', c => d += c);
      res.on('end', () => resolve({ status: res.statusCode, data: JSON.parse(d) }));
    }).on('error', reject);
  });
  assert(aiHealthRes.status === 200, 'AI Service responds on /health with 200');
  assert(aiHealthRes.data?.status === 'ok' && aiHealthRes.data?.service === 'ai', 'AI Service confirms operational status');

  // TEST 3: AI Service -> PostgreSQL connection
  console.log('\n--- TEST 3: AI Service -> PostgreSQL Database Connectivity ---');
  const { execSync } = require('child_process');
  let dbCheckOutput = '';
  try {
    dbCheckOutput = execSync(
      'docker exec vertexlearn_ai-ai-service-1 python -c "import psycopg, os; conn = psycopg.connect(os.getenv(\'DATABASE_URL\')); cur = conn.cursor(); cur.execute(\'SELECT count(*) FROM document_chunks;\'); print(cur.fetchone()[0]); conn.close()"'
    ).toString().trim();
    assert(Number(dbCheckOutput) > 0, `AI service connected to PostgreSQL; found ${dbCheckOutput} document chunks`);
  } catch (err) {
    assert(false, `AI service failed to query PostgreSQL: ${err.message}`);
  }

  // TEST 4: RAG Retrieval via pgvector
  console.log('\n--- TEST 4: RAG Retrieval via pgvector ---');
  let ragOutput = '';
  try {
    ragOutput = execSync(
      'docker exec vertexlearn_ai-ai-service-1 python -c "from app.rag.retriever import retrieve; chunks = retrieve(\'4c780c1a-28ed-4deb-bfab-33b148340448\', \'Retrieval Augmented Generation RAG Architecture\', 4); print(len(chunks)); print(chunks[0][\'lecture_title\'])"'
    ).toString().trim().split('\n');
    const chunkCount = Number(ragOutput[0]);
    const topTitle = ragOutput[1];
    assert(chunkCount > 0, `RAG retriever returned ${chunkCount} chunks`);
    assert(topTitle.includes('Retrieval Augmented Generation'), `Top retrieved chunk matches lecture: "${topTitle}"`);
  } catch (err) {
    assert(false, `RAG retrieval failed: ${err.message}`);
  }

  // TEST 5: AI Service -> LLM Provider configuration handling
  console.log('\n--- TEST 5: AI Service -> LLM Provider Configuration Handling ---');
  const summarizeDirectRes = await new Promise((resolve) => {
    const postBody = JSON.stringify({ text: 'RAG combines vector retrieval with language model synthesis.' });
    const req = http.request('http://localhost:8001/ai/summarize', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(postBody) }
    }, (res) => {
      let d = ''; res.on('data', c => d += c);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, data: JSON.parse(d) }); }
        catch { resolve({ status: res.statusCode, data: d }); }
      });
    });
    req.write(postBody);
    req.end();
  });
  assert(
    summarizeDirectRes.status === 503,
    'AI service returns HTTP 503 when ANTHROPIC_API_KEY is unconfigured'
  );
  assert(
    summarizeDirectRes.data?.detail?.includes('AI service is not configured'),
    'AI service returns exact configuration error message without mock text'
  );

  // TEST 6: Full AI Tutor Flow through Backend
  console.log('\n--- TEST 6: Full AI Tutor Request Flow ---');
  const chatBody = JSON.stringify({
    course_id: '4c780c1a-28ed-4deb-bfab-33b148340448',
    question: 'Explain Retrieval Augmented Generation (RAG) Architecture simply with an everyday analogy.',
    mode: 'intermediate'
  });

  const chatRes = await new Promise((resolve) => {
    const req = http.request('http://localhost:8000/api/v1/ai/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        'Content-Length': Buffer.byteLength(chatBody)
      }
    }, (res) => {
      let d = ''; res.on('data', c => d += c);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, data: JSON.parse(d) }); }
        catch { resolve({ status: res.statusCode, data: d }); }
      });
    });
    req.write(chatBody);
    req.end();
  });

  assert(chatRes.status === 503, 'AI Tutor route returns HTTP 503 when AI provider key is unconfigured');
  assert(chatRes.data?.error?.code === 'AI_NOT_CONFIGURED', 'AI Tutor error code is "AI_NOT_CONFIGURED"');
  assert(
    chatRes.data?.error?.message === 'AI service is not configured. Add the required AI provider API key to the environment configuration.',
    'AI Tutor error message directs user to configure AI provider API key'
  );

  // TEST 7: Full Summary Flow through Backend
  console.log('\n--- TEST 7: Full Lecture Summary Request Flow ---');
  // First, fetch the lecture ID for RAG Architecture lecture
  const courseRes = await new Promise((resolve) => {
    http.get('http://localhost:8000/api/v1/courses/4c780c1a-28ed-4deb-bfab-33b148340448', (res) => {
      let d = ''; res.on('data', c => d += c);
      res.on('end', () => resolve({ status: res.statusCode, data: JSON.parse(d) }));
    });
  });

  let ragLectureId = null;
  for (const m of (courseRes.data?.modules || [])) {
    for (const l of (m.lectures || [])) {
      if (l.title.includes('Retrieval Augmented Generation')) {
        ragLectureId = l.id;
        break;
      }
    }
  }
  assert(!!ragLectureId, `Found target lecture ID: ${ragLectureId}`);

  const summaryRes = await new Promise((resolve) => {
    const req = http.request(`http://localhost:8000/api/v1/lectures/${ragLectureId}/summary?regenerate=true`, {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${token}` }
    }, (res) => {
      let d = ''; res.on('data', c => d += c);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, data: JSON.parse(d) }); }
        catch { resolve({ status: res.statusCode, data: d }); }
      });
    });
    req.end();
  });

  assert(summaryRes.status === 503, 'Lecture summary route returns HTTP 503 when AI provider key is unconfigured');
  assert(summaryRes.data?.error?.code === 'AI_NOT_CONFIGURED', 'Lecture summary error code is "AI_NOT_CONFIGURED"');
  assert(
    summaryRes.data?.error?.message === 'AI service is not configured. Add the required AI provider API key to the environment configuration.',
    'Lecture summary error message directs user to configure AI provider API key'
  );

  console.log('\n===============================================================');
  console.log(`   PIPELINE LAYER RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('===============================================================');

  if (failed > 0) process.exit(1);
}

runPipelineTests().catch((err) => {
  console.error('Fatal error during pipeline tests:', err);
  process.exit(1);
});
