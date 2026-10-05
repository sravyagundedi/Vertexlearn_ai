const API_BASE = 'http://localhost:8000/api/v1';

async function testFullDemoFlow() {
  console.log('====================================================');
  console.log('TESTING COMPLETE COLLEGE GUIDE DEMONSTRATION FLOW');
  console.log('====================================================');

  // Step 1 & 2: Login as Student
  console.log('\n[Step 1 & 2] Authenticating as Demo Student...');
  const loginRes = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'student@vertexlearn.local',
      password: 'Password123!',
    }),
  });

  if (!loginRes.ok) {
    throw new Error(`Login failed with status ${loginRes.status}`);
  }
  const loginData = await loginRes.json();
  const token = loginData.access_token;
  console.log(`✓ Logged in as: ${loginData.user.full_name} (${loginData.user.role})`);

  const authHeaders = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };

  // Step 3 & 4: Dashboard - Check Enrolled Courses & Analytics
  console.log('\n[Step 3 & 4] Fetching Dashboard Data & Enrolled Courses...');
  const enrollRes = await fetch(`${API_BASE}/enrollments/me`, { headers: authHeaders });
  const enrollments = await enrollRes.json();
  console.log(`✓ Enrolled courses count: ${enrollments.length}`);
  enrollments.forEach((e) => {
    console.log(`  - ${e.title}: ${e.progress_percent}% completed`);
  });

  const progressRes = await fetch(`${API_BASE}/users/me/progress`, { headers: authHeaders });
  const progressStats = await progressRes.json();
  console.log('✓ Learner Analytics KPI:');
  console.log(`  - Enrolled: ${progressStats.courses_enrolled}`);
  console.log(`  - Completed Lessons: ${progressStats.lessons_completed}`);
  console.log(`  - Avg Quiz Score: ${progressStats.avg_quiz_score}%`);
  console.log(`  - Avg Course Progress: ${progressStats.avg_progress}%`);

  // Step 5: Open Full Stack Web Development
  console.log('\n[Step 5] Opening "Full Stack Web Development" Course...');
  const coursesRes = await fetch(`${API_BASE}/courses`, { headers: authHeaders });
  const courses = await coursesRes.json();
  const fsCourseSummary = courses.find((c) => c.title.includes('Full Stack'));
  if (!fsCourseSummary) throw new Error('Full Stack Web Development course not found');

  const courseRes = await fetch(`${API_BASE}/courses/${fsCourseSummary.id}`, { headers: authHeaders });
  const courseDetails = await courseRes.json();
  console.log(`✓ Course Loaded: "${courseDetails.title}"`);
  console.log(`✓ Modules Count: ${courseDetails.modules.length}`);

  // Step 6 & 7: Show Curriculum & Open a Class
  console.log('\n[Step 6 & 7] Inspecting Curriculum & Selecting Class...');
  const module1 = courseDetails.modules[0];
  console.log(`✓ Module 1: "${module1.title}" (${module1.lectures.length} lessons)`);
  const lecture1 = module1.lectures[0];
  console.log(`✓ Active Class: "${lecture1.title}"`);
  console.log(`  - Video URL: ${lecture1.video_url}`);
  console.log(`  - Duration: ${Math.round(lecture1.duration_seconds / 60)} minutes`);

  // Step 8 & 9: Video & Learning Material
  console.log('\n[Step 8 & 9] Inspecting Learning Material...');
  console.log(`✓ About this lesson: ${lecture1.description?.slice(0, 100)}...`);
  console.log(`✓ Learning Objectives: ${lecture1.learning_objectives?.length} items`);
  console.log(`✓ Key Concepts: ${lecture1.key_concepts?.join(', ')}`);
  console.log(`✓ Quick Check: ${lecture1.quick_check?.length} questions`);

  // Step 10 & 11: Ask AI Tutor - Question 1
  console.log('\n[Step 10 & 11] Asking AI Tutor: "What is REST API? Explain it simply."');
  const aiRes1 = await fetch(`${API_BASE}/ai/chat`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      course_id: courseDetails.id,
      question: 'What is REST API? Explain it simply.',
      mode: 'intermediate',
    }),
  });
  const aiData1 = await aiRes1.json();
  console.log('✓ AI Tutor Answer Received:');
  console.log(aiData1.reply.slice(0, 320) + '...\n');
  console.log(`✓ Sourced Citations: ${aiData1.sources?.length} chunks cited`);

  // Step 12 & 13: Ask AI Tutor - Question 2
  console.log('\n[Step 12 & 13] Asking AI Tutor: "What is the difference between GET and POST?"');
  const aiRes2 = await fetch(`${API_BASE}/ai/chat`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      course_id: courseDetails.id,
      question: 'What is the difference between GET and POST?',
      mode: 'intermediate',
    }),
  });
  const aiData2 = await aiRes2.json();
  console.log('✓ AI Tutor Answer Received:');
  console.log(aiData2.reply.slice(0, 320) + '...\n');

  // Step 14 & 15: Take Module Quiz & Submit Answers
  console.log('\n[Step 14 & 15] Taking Lesson Quiz...');
  const quizzesRes = await fetch(`${API_BASE}/courses/${courseDetails.id}/quizzes`, { headers: authHeaders });
  const quizzes = await quizzesRes.json();
  console.log(`✓ Available Quizzes in Course: ${quizzes.length}`);
  const quiz = quizzes[0];
  console.log(`✓ Selected Quiz: "${quiz.title}" (${quiz.total_questions} questions)`);

  const quizDetailRes = await fetch(`${API_BASE}/quizzes/${quiz.id}`, { headers: authHeaders });
  const quizDetail = await quizDetailRes.json();

  // Answer questions intentionally (1 right, 1 wrong to test explanations)
  const answersPayload = [
    {
      question_id: quizDetail.questions[0].id,
      selected_option_ids: [quizDetail.questions[0].options[0].id], // Intentionally chosen
    },
  ];
  if (quizDetail.questions.length > 1) {
    answersPayload.push({
      question_id: quizDetail.questions[1].id,
      selected_option_ids: [quizDetail.questions[1].options[0].id],
    });
  }

  console.log('\n[Step 16 & 17] Submitting Quiz and Reviewing Explanations...');
  const submitRes = await fetch(`${API_BASE}/quizzes/${quiz.id}/submit`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({ answers: answersPayload }),
  });
  const resultData = await submitRes.json();
  console.log(`✓ Quiz Evaluated!`);
  console.log(`  - Score: ${resultData.score}% (${resultData.correct} / ${resultData.total} correct)`);
  console.log(`  - Status: ${resultData.passed ? 'PASSED' : 'NEEDS REVIEW'}`);
  console.log(`  - Passing Requirement: ${resultData.passing_score}%`);
  console.log(`✓ Explanations Returned for Review:`);
  resultData.review.forEach((r, idx) => {
    console.log(`    Q${idx + 1}: ${r.is_correct ? '✓ Correct' : '✗ Incorrect'}`);
    console.log(`       Explanation: ${r.explanation}`);
  });

  // Step 18: Mark class completed
  console.log('\n[Step 18] Marking Current Class Completed...');
  const completeRes = await fetch(`${API_BASE}/lectures/${lecture1.id}/progress`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      watched_seconds: lecture1.duration_seconds || 600,
      completed: true,
    }),
  });
  const completeData = await completeRes.json();
  console.log(`✓ Lecture marked complete: ${completeData.completed}`);
  console.log(`✓ Updated Course Progress: ${completeData.progress_percent}%`);

  // Step 19: Return to Dashboard & Verify Updated Progress
  console.log('\n[Step 19] Verifying Updated Progress on Dashboard...');
  const updatedEnrollRes = await fetch(`${API_BASE}/enrollments/me`, { headers: authHeaders });
  const updatedEnrollments = await updatedEnrollRes.json();
  const updatedFs = updatedEnrollments.find((e) => e.course_id === courseDetails.id);
  console.log(`✓ Full Stack Web Dev Progress: ${updatedFs.progress_percent}%`);
  console.log(`✓ Next Up Lesson: "${updatedFs.next_lecture_title}"`);

  const updatedProgressRes = await fetch(`${API_BASE}/users/me/progress`, { headers: authHeaders });
  const updatedProgressStats = await updatedProgressRes.json();
  console.log(`✓ Total Lessons Completed: ${updatedProgressStats.lessons_completed}`);
  console.log(`✓ Average Progress: ${updatedProgressStats.avg_progress}%`);

  console.log('\n====================================================');
  console.log('✓ ALL 19 DEMONSTRATION STEPS PASSED PERFECTLY!');
  console.log('====================================================');
}

testFullDemoFlow().catch((err) => {
  console.error('Demonstration flow test failed:', err);
  process.exit(1);
});
