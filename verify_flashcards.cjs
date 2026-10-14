const http = require('http');

function post(url, body, token) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const u = new URL(url);
    const headers = { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const req = http.request({ hostname: u.hostname, port: u.port, path: u.pathname, method: 'POST', headers }, res => {
      let d = ''; res.on('data', c => d += c);
      res.on('end', () => resolve({ status: res.statusCode, data: JSON.parse(d) }));
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

function get(url, token) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const headers = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const req = http.request({ hostname: u.hostname, port: u.port, path: u.pathname + u.search, method: 'GET', headers }, res => {
      let d = ''; res.on('data', c => d += c);
      res.on('end', () => resolve({ status: res.statusCode, data: JSON.parse(d) }));
    });
    req.on('error', reject);
    req.end();
  });
}

async function run() {
  const login = await post('http://localhost:8000/api/v1/auth/login', { email: 'student@vertexlearn.local', password: 'Password123!' });
  const token = login.data.access_token;

  console.log('--- Checking Flashcards Across Courses ---');
  const res = await get('http://localhost:8000/api/v1/flashcards?course_id=4c780c1a-28ed-4deb-bfab-33b148340448', token);
  const cards = res.data.cards || [];
  console.log(`Total Cards in ML Course: ${cards.length}`);

  const uniqueAnswers = new Set(cards.map(c => c.answer));
  console.log(`Unique Answers Count: ${uniqueAnswers.size} / ${cards.length}`);

  console.log('\nSample Cards:');
  cards.slice(0, 4).forEach((c, idx) => {
    console.log(`\nCard ${idx + 1}:`);
    console.log(`  Q: ${c.question}`);
    console.log(`  A: ${c.answer}`);
  });
}

run().catch(console.error);
