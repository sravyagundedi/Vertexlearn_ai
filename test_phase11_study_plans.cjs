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
  console.log('--- Phase 11 Verification: Smart Study Plans ---');

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

  // 2. Fetch courses list
  console.log('\n2. Fetching courses list...');
  const coursesRes = await request({
    hostname: 'localhost',
    port: 8000,
    path: '/api/v1/courses',
    method: 'GET',
    headers: authHeaders,
  });

  const courseList = Array.isArray(coursesRes.data) ? coursesRes.data : coursesRes.data.courses || [];
  const targetCourse = courseList[0];
  console.log(`✓ Target course: "${targetCourse.title}" (${targetCourse.id})`);

  // 3. POST /api/v1/ai/study-plan
  console.log('\n3. Generating Smart Study Plan via POST /api/v1/ai/study-plan...');
  const genPlanRes = await request(
    {
      hostname: 'localhost',
      port: 8000,
      path: '/api/v1/ai/study-plan',
      method: 'POST',
      headers: authHeaders,
    },
    {
      course_id: targetCourse.id,
      target_date: '2026-11-15',
      hours_per_day: 2,
    }
  );

  if (genPlanRes.status !== 201) {
    throw new Error(`Generate study plan failed with status ${genPlanRes.status}: ${JSON.stringify(genPlanRes.data)}`);
  }

  const plan = genPlanRes.data.plan;
  console.log('✓ Smart Study Plan generated!');
  console.log(`  - Plan ID: ${plan.id}`);
  console.log(`  - Total Days: ${plan.total_days}`);
  console.log(`  - Total Tasks: ${plan.total_tasks}`);
  console.log(`  - Completed Tasks: ${plan.completed_count}`);
  console.log(`  - Progress Percentage: ${plan.progress_percentage}%`);

  const tasks = plan.tasks || [];
  if (tasks.length === 0) {
    throw new Error('No tasks generated in study plan');
  }

  console.log(`  Sample Day 1 Task: [${tasks[0].type.toUpperCase()}] "${tasks[0].title}" (${tasks[0].duration_minutes}m)`);
  if (tasks.length > 1) {
    console.log(`  Sample Task 2: [${tasks[1].type.toUpperCase()}] "${tasks[1].title}" (${tasks[1].duration_minutes}m)`);
  }

  // 4. GET /api/v1/study-plans
  console.log('\n4. Verifying persistence via GET /api/v1/study-plans...');
  const getPlanRes = await request({
    hostname: 'localhost',
    port: 8000,
    path: `/api/v1/study-plans?course_id=${targetCourse.id}`,
    method: 'GET',
    headers: authHeaders,
  });

  if (getPlanRes.status !== 200 || !getPlanRes.data.plan) {
    throw new Error(`GET /study-plans failed: ${JSON.stringify(getPlanRes.data)}`);
  }
  console.log('✓ Study plan confirmed stored and retrieved from PostgreSQL');

  // 5. PATCH /api/v1/study-plans/:id/tasks/:taskId (toggle task completion)
  console.log('\n5. Toggling task completion state...');
  const taskToToggle = tasks.find((t) => !t.completed) || tasks[0];
  const initialCompleted = taskToToggle.completed;

  const toggleRes = await request(
    {
      hostname: 'localhost',
      port: 8000,
      path: `/api/v1/study-plans/${plan.id}/tasks/${taskToToggle.id}`,
      method: 'PATCH',
      headers: authHeaders,
    },
    { completed: !initialCompleted }
  );

  if (toggleRes.status !== 200) {
    throw new Error(`Toggle task failed with status ${toggleRes.status}: ${JSON.stringify(toggleRes.data)}`);
  }

  const updatedPlan = toggleRes.data.plan;
  const updatedTask = updatedPlan.tasks.find((t) => t.id === taskToToggle.id);
  console.log(`✓ Task "${taskToToggle.title}" toggled to: ${updatedTask.completed}`);
  console.log(`✓ Updated Plan Progress: ${updatedPlan.progress_percentage}% (${updatedPlan.completed_count}/${updatedPlan.total_tasks})`);

  if (updatedTask.completed === initialCompleted) {
    throw new Error('Task completion was not toggled in backend');
  }

  console.log('\n======================================================');
  console.log('🎉 ALL PHASE 11 SMART STUDY PLAN CHECKS PASSED!');
  console.log('======================================================');
}

run().catch((err) => {
  console.error('\n❌ Phase 11 Verification Failed:', err);
  process.exit(1);
});
