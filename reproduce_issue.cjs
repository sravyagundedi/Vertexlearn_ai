const http = require('http');

async function reproduce() {
  console.log('=== REPRODUCING BROWSER ACTIONS ===\n');

  // 1. Login as student
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

  console.log('1. Student Login Status:', loginRes.status);
  const token = loginRes.data?.access_token;
  if (!token) {
    console.error('Failed to get token:', loginRes.data);
    return;
  }

  // 2. Get Courses
  const coursesRes = await new Promise((resolve) => {
    http.get('http://localhost:8000/api/v1/courses', (res) => {
      let d = ''; res.on('data', c => d += c);
      res.on('end', () => resolve({ status: res.statusCode, data: JSON.parse(d) }));
    });
  });
  console.log('2. Courses Count:', coursesRes.data?.length);
  // Look for course related to RAG / AI if available, or first course
  const ragCourse = coursesRes.data?.find(c => c.title.toLowerCase().includes('rag') || c.title.toLowerCase().includes('ai')) || coursesRes.data[0];
  console.log(`   Target Course: "${ragCourse.title}" (ID: ${ragCourse.id})`);

  // 3. Get Course Details & Lectures
  const courseDetailRes = await new Promise((resolve) => {
    http.get(`http://localhost:8000/api/v1/courses/${ragCourse.id}`, (res) => {
      let d = ''; res.on('data', c => d += c);
      res.on('end', () => resolve({ status: res.statusCode, data: JSON.parse(d) }));
    });
  });
  const firstLecture = courseDetailRes.data?.modules?.[0]?.lectures?.[0];
  console.log(`   Target Lecture: "${firstLecture?.title}" (ID: ${firstLecture?.id})`);

  // 4. Submit the EXACT user question to AI Tutor:
  // "Explain Retrieval Augmented Generation (RAG) Architecture simply with an everyday analogy."
  console.log('\n4. Sending AI Tutor Question...');
  const chatBody = JSON.stringify({
    course_id: ragCourse.id,
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

  console.log('   AI Tutor HTTP Status:', chatRes.status);
  console.log('   AI Tutor Response Body:', JSON.stringify(chatRes.data, null, 2));

  // 5. Click Generate Summary on the lecture
  console.log('\n5. Requesting Lecture Summary...');
  const summaryRes = await new Promise((resolve) => {
    const req = http.request(`http://localhost:8000/api/v1/lectures/${firstLecture.id}/summary?regenerate=true`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    }, (res) => {
      let d = ''; res.on('data', c => d += c);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, data: JSON.parse(d) }); }
        catch { resolve({ status: res.statusCode, data: d }); }
      });
    });
    req.end();
  });

  console.log('   Lecture Summary HTTP Status:', summaryRes.status);
  console.log('   Lecture Summary Response Body:', JSON.stringify(summaryRes.data, null, 2));
}

reproduce().catch(console.error);
