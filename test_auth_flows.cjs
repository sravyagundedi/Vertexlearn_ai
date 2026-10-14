const http = require('http');

function post(url, body) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const u = new URL(url);
    const req = http.request({
      hostname: u.hostname,
      port: u.port,
      path: u.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data),
      },
    }, (res) => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(d) });
        } catch {
          resolve({ status: res.statusCode, data: d });
        }
      });
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

async function run() {
  console.log('--- Testing Auth Flows ---');

  // Flow 1: Existing Student Sign In
  console.log('\n1. Testing Student Sign In (student@vertexlearn.local):');
  const signInRes = await post('http://localhost:8000/api/v1/auth/login', {
    email: 'student@vertexlearn.local',
    password: 'Password123!'
  });
  console.log('   Status:', signInRes.status);
  console.log('   User:', signInRes.data.user?.full_name, '| Role:', signInRes.data.user?.role);
  console.log('   Has Token:', !!signInRes.data.access_token);

  // Flow 2: Register Existing Email (what happened when clicking Register on student@vertexlearn.local)
  console.log('\n2. Testing Register with Existing Email (student@vertexlearn.local):');
  const dupRes = await post('http://localhost:8000/api/v1/auth/register', {
    full_name: 'student',
    email: 'student@vertexlearn.local',
    password: 'Password123!'
  });
  console.log('   Status:', dupRes.status);
  console.log('   Error Message:', dupRes.data.error?.message);

  // Flow 3: Register New Student
  const newEmail = `student_${Date.now()}@vertexlearn.local`;
  console.log(`\n3. Testing New Student Registration (${newEmail}):`);
  const newRes = await post('http://localhost:8000/api/v1/auth/register', {
    full_name: 'Jane Doe',
    email: newEmail,
    password: 'Password123!'
  });
  console.log('   Status:', newRes.status);
  console.log('   User:', newRes.data.user?.full_name, '| Email:', newRes.data.user?.email);
  console.log('   Has Token:', !!newRes.data.access_token);
}

run().catch(console.error);
