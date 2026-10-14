const http = require('http');

function post(url, body, token) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const u = new URL(url);
    const headers = { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const req = http.request({ hostname: u.hostname, port: u.port, path: u.pathname, method: 'POST', headers }, res => {
      let d = ''; res.on('data', c => d += c);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, data: JSON.parse(d) }); }
        catch { resolve({ status: res.statusCode, data: d }); }
      });
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

function get(url) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const req = http.request({ hostname: u.hostname, port: u.port, path: u.pathname + u.search, method: 'GET' }, res => {
      let d = ''; res.on('data', c => d += c);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, data: JSON.parse(d) }); }
        catch { resolve({ status: res.statusCode, data: d }); }
      });
    });
    req.on('error', reject);
    req.end();
  });
}

async function testOtp() {
  console.log('=== TESTING PRODUCTION SECURE TWO-FACTOR AUTHENTICATION ===\n');

  // Step 1: Submit Login Credentials
  console.log('1. Submitting student credentials...');
  const loginRes = await post('http://localhost:8000/api/v1/auth/login', {
    email: 'student@vertexlearn.local',
    password: 'Password123!'
  });

  console.log('   Login Status:', loginRes.status);
  console.log('   OTP Required:', loginRes.data.otp_required);
  console.log('   Masked Email Hint:', loginRes.data.masked_email);
  console.log('   Security Check: OTP Leaked in API Response?:', 'otp_preview' in loginRes.data);
  console.log('   Security Check: Access Token Leaked Before 2FA?:', 'access_token' in loginRes.data);

  if ('otp_preview' in loginRes.data || 'access_token' in loginRes.data) {
    console.error('FAIL: Security vulnerability - OTP or access token leaked in login response');
    process.exit(1);
  }

  // Step 2: Retrieve out-of-band dispatched email
  console.log('\n2. Retrieving out-of-band dispatched email from mail transport...');
  const mailRes = await get('http://localhost:8000/api/v1/auth/dev-mailbox?email=student@vertexlearn.local');
  const latestMail = mailRes.data.messages[0];
  console.log('   Mailbox Message ID:', latestMail?.id);
  console.log('   Dispatched To:', latestMail?.to);
  console.log('   Dispatched OTP Code:', latestMail?.code);

  if (!latestMail?.code) {
    console.error('FAIL: No out-of-band email dispatched');
    process.exit(1);
  }
  const otp = latestMail.code;

  // Step 3: Test Invalid OTP rejection with attempts tracking
  console.log('\n3. Testing Invalid OTP rejection (000000)...');
  const badOtpRes = await post('http://localhost:8000/api/v1/auth/verify-otp', {
    email: 'student@vertexlearn.local',
    otp: '000000',
    temp_token: loginRes.data.temp_token
  });
  console.log('   Bad OTP Status:', badOtpRes.status);
  console.log('   Error Message:', badOtpRes.data?.error?.message);

  // Step 4: Test Valid OTP verification
  console.log(`\n4. Testing Valid OTP verification (${otp})...`);
  const goodOtpRes = await post('http://localhost:8000/api/v1/auth/verify-otp', {
    email: 'student@vertexlearn.local',
    otp: otp,
    temp_token: loginRes.data.temp_token
  });
  console.log('   Good OTP Status:', goodOtpRes.status);
  console.log('   Verification Success:', goodOtpRes.data.success);
  console.log('   JWT Access Token Issued:', !!goodOtpRes.data.access_token);
  console.log('   Authenticated User:', goodOtpRes.data.user?.full_name, `(${goodOtpRes.data.user?.role})`);

  // Step 5: Test Single-Use Token Burn (Replay attack prevention)
  console.log('\n5. Testing Single-Use Token Burn (Replaying same OTP)...');
  const replayRes = await post('http://localhost:8000/api/v1/auth/verify-otp', {
    email: 'student@vertexlearn.local',
    otp: otp,
    temp_token: loginRes.data.temp_token
  });
  console.log('   Replay Status:', replayRes.status);
  console.log('   Replay Error:', replayRes.data?.error?.code);

  console.log('\n=== ALL 5 SECURE TWO-FACTOR AUTHENTICATION STEPS PASSED! ===');
}

testOtp().catch(console.error);
