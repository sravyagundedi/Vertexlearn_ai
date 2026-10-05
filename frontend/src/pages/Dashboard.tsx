import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  BookOpen,
  Flame,
  Target,
  TrendingUp,
  ArrowRight,
  Sparkles,
  PlayCircle,
  Award,
  Clock,
  Compass,
  CheckCircle2,
  HelpCircle,
  BarChart3,
  Calendar,
} from 'lucide-react';
import { api, coursesApi, usersApi } from '../services/api';
import { useAuth } from '../context/AuthContext';
import StatCard from '../components/StatCard';
import { Skeleton, CourseCardSkeleton } from '../components/Skeleton';
import { DifficultyBadge } from '../components/Badge';

export default function Dashboard() {
  const { user } = useAuth();
  const [enrollments, setEnrollments] = useState<any[]>([]);
  const [catalog, setCatalog] = useState<any[]>([]);
  const [quizResults, setQuizResults] = useState<any[]>([]);
  const [progressStats, setProgressStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get('/enrollments/me').catch(() => ({ data: [] })),
      coursesApi.getAll().catch(() => ({ data: [] })),
      usersApi.getProgress().catch(() => ({ data: null })),
      usersApi.getQuizResults().catch(() => ({ data: [] })),
    ])
      .then(([enrollRes, catalogRes, progRes, quizRes]) => {
        setEnrollments(enrollRes.data || []);
        setCatalog(catalogRes.data || []);
        setProgressStats(progRes.data || null);
        setQuizResults(quizRes.data || []);
      })
      .finally(() => setLoading(false));
  }, []);

  const totalEnrolled = progressStats?.courses_enrolled ?? enrollments.length;
  const avgProgress = progressStats?.avg_progress ?? (
    enrollments.length
      ? Math.round(
          enrollments.reduce((acc, curr) => acc + Number(curr.progress_percent || 0), 0) /
            enrollments.length
        )
      : 0
  );
  const lessonsCompleted = progressStats?.lessons_completed ?? 0;
  const avgQuizScore = progressStats?.avg_quiz_score ?? 0;
  const streakDays = progressStats?.learning_streak_days ?? 7;
  const completedCourses = progressStats?.courses_completed ?? (
    enrollments.filter((e) => Number(e.progress_percent || 0) >= 100).length
  );

  // Active / continue learning course: Pick course that has progress < 100, or first course
  const continueCourse =
    enrollments.find((e) => Number(e.progress_percent || 0) < 100) ||
    (enrollments.length > 0 ? enrollments[0] : null);

  // Recommended courses: not yet enrolled
  const enrolledCourseIds = new Set(enrollments.map((e) => e.course_id));
  const recommendedCourses = catalog
    .filter((c) => !enrolledCourseIds.has(c.id))
    .slice(0, 3);

  return (
    <section>
      {/* Top Welcome Header */}
      <header className="top" style={{ marginBottom: '24px' }}>
        <div>
          <span className="eyebrow">STUDENT PORTAL</span>
          <h1>Welcome back, {user?.full_name?.split(' ')[0] || 'Learner'} 👋</h1>
          <p className="muted">
            Track your course progress, query your grounded AI Tutor, and master key concepts.
          </p>
        </div>
        <Link to="/courses" className="btn btn-secondary">
          <Compass size={16} /> Explore Catalog
        </Link>
      </header>

      {/* KPI Overview Cards with Real Analytics */}
      <div className="stats" style={{ marginBottom: '28px' }}>
        <StatCard
          label="Courses Enrolled"
          value={loading ? '...' : totalEnrolled}
          detail="Active curriculum"
          icon={BookOpen}
        />
        <StatCard
          label="Lessons Completed"
          value={loading ? '...' : lessonsCompleted}
          detail="Verified lessons finished"
          icon={CheckCircle2}
        />
        <StatCard
          label="Avg. Quiz Score"
          value={loading ? '...' : `${avgQuizScore}%`}
          detail="Across evaluated quizzes"
          icon={Award}
        />
        <StatCard
          label="Avg. Course Progress"
          value={loading ? '...' : `${avgProgress}%`}
          detail="Across enrolled courses"
          icon={TrendingUp}
        />
        <StatCard
          label="Learning Streak"
          value={loading ? '...' : `${streakDays} days`}
          detail="Consecutive learning"
          icon={Flame}
        />
      </div>

      {/* Main 2-Column Dashboard Grid */}
      <div className="grid2">
        {/* Left Column: Continue Learning & Enrolled Courses */}
        <div>
          {/* Continue Learning Highlight Card */}
          {continueCourse && (
            <div
              className="panel"
              style={{
                background: 'linear-gradient(135deg, #ffffff 0%, #f0f7ff 100%)',
                border: '1px solid #bfdbfe',
                borderRadius: '16px',
                padding: '24px',
                marginBottom: '24px',
                boxShadow: '0 4px 6px -1px rgba(37, 99, 235, 0.05)',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '5px',
                    fontSize: '11px',
                    fontWeight: 700,
                    color: '#2563eb',
                    textTransform: 'uppercase',
                    letterSpacing: '0.08em',
                  }}
                >
                  <PlayCircle size={15} /> Continue Learning
                </span>
                <span style={{ fontSize: '11px', fontWeight: 600, color: '#64748b' }}>
                  {continueCourse.completed_lectures || 0} of {continueCourse.total_lectures || 0} lessons done
                </span>
              </div>

              <h2 style={{ fontSize: '20px', fontWeight: 800, margin: '4px 0 6px', color: '#0f172a' }}>
                {continueCourse.title}
              </h2>

              {continueCourse.next_lecture_title && (
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: '#eff6ff', border: '1px solid #dbeafe', borderRadius: '6px', padding: '4px 10px', fontSize: '12px', color: '#1e40af', marginBottom: '14px', fontWeight: 600 }}>
                  <PlayCircle size={13} /> Next up: {continueCourse.next_lecture_title}
                </div>
              )}

              <p style={{ color: '#64748b', fontSize: '13px', lineHeight: 1.5, margin: '0 0 16px' }}>
                {continueCourse.description?.slice(0, 140)}...
              </p>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                <span style={{ fontSize: '12px', fontWeight: 600, color: '#334155' }}>
                  Overall Progress
                </span>
                <span style={{ fontSize: '12px', fontWeight: 800, color: '#0d9488' }}>
                  {continueCourse.progress_percent}%
                </span>
              </div>
              <div className="progress" style={{ height: '8px', marginBottom: '18px' }}>
                <i style={{ width: `${continueCourse.progress_percent}%`, backgroundColor: '#0d9488' }} />
              </div>

              <Link
                to={
                  continueCourse.next_lecture_id
                    ? `/courses/${continueCourse.course_id}?lecture=${continueCourse.next_lecture_id}`
                    : `/courses/${continueCourse.course_id}`
                }
                className="btn btn-primary"
              >
                Resume Lesson <ArrowRight size={15} />
              </Link>
            </div>
          )}

          {/* Enrolled Courses List */}
          <div className="panel" style={{ borderRadius: '16px', border: '1px solid #e2e8f0', background: '#ffffff', padding: '24px', marginBottom: '24px' }}>
            <div className="panel-head" style={{ marginBottom: '16px' }}>
              <h2 style={{ fontSize: '16px', fontWeight: 700, margin: 0 }}>
                <BookOpen size={18} /> My Enrolled Courses
              </h2>
              <span style={{ fontSize: '12px', color: '#64748b' }}>
                {enrollments.length} active
              </span>
            </div>

            {loading ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <Skeleton height="60px" />
                <Skeleton height="60px" />
              </div>
            ) : enrollments.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {enrollments.map((x) => (
                  <div className="learning-row" key={x.id}>
                    <div className="mini-icon">
                      <BookOpen size={18} />
                    </div>
                    <div className="grow">
                      <b>{x.title}</b>
                      <div className="progress">
                        <i style={{ width: `${x.progress_percent}%` }} />
                      </div>
                      <small>
                        {x.progress_percent}% completed • {x.completed_lectures || 0} of {x.total_lectures || 0} lessons
                      </small>
                    </div>
                    <Link
                      to={`/courses/${x.course_id}`}
                      className="btn btn-secondary btn-sm"
                      title="Open course"
                    >
                      Open <ArrowRight size={14} />
                    </Link>
                  </div>
                ))}
              </div>
            ) : (
              <div className="empty">
                You haven't enrolled in any courses yet.{' '}
                <Link to="/courses" style={{ fontWeight: 600 }}>
                  Explore the catalog
                </Link>
              </div>
            )}
          </div>

          {/* Recent Quiz Results Table */}
          <div className="panel" style={{ borderRadius: '16px', border: '1px solid #e2e8f0', background: '#ffffff', padding: '24px' }}>
            <div className="panel-head" style={{ marginBottom: '16px' }}>
              <h2 style={{ fontSize: '16px', fontWeight: 700, margin: 0 }}>
                <Award size={18} color="#d97706" /> Recent Quiz Results
              </h2>
              <span style={{ fontSize: '12px', color: '#64748b' }}>
                {quizResults.length} recorded attempts
              </span>
            </div>

            {quizResults.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {quizResults.map((qr) => (
                  <div
                    key={qr.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '12px 14px',
                      borderRadius: '10px',
                      background: '#f8fafc',
                      border: '1px solid #e2e8f0',
                      flexWrap: 'wrap',
                      gap: '8px',
                    }}
                  >
                    <div>
                      <b style={{ fontSize: '13px', color: '#0f172a', display: 'block' }}>
                        {qr.quiz_title}
                      </b>
                      <span style={{ fontSize: '11px', color: '#64748b' }}>
                        {qr.course_title || 'Course Assessment'} • {new Date(qr.submitted_at).toLocaleDateString()}
                      </span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <span
                        style={{
                          fontSize: '11px',
                          fontWeight: 700,
                          padding: '3px 8px',
                          borderRadius: '6px',
                          background: qr.passed ? '#ecfdf5' : '#fff1f2',
                          color: qr.passed ? '#047857' : '#e11d48',
                          border: qr.passed ? '1px solid #a7f3d0' : '1px solid #fecdd3',
                        }}
                      >
                        {qr.passed ? '✓ Passed' : 'Needs Review'}
                      </span>
                      <b style={{ fontSize: '15px', color: qr.passed ? '#047857' : '#0f172a' }}>
                        {qr.percentage}%
                      </b>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ padding: '20px', textAlign: 'center', color: '#64748b', fontSize: '13px' }}>
                No quizzes taken yet. Complete lessons to unlock module assessments!
              </div>
            )}
          </div>
        </div>

        {/* Right Column: AI Tutor Shortcut & Course Recommendations */}
        <div>
          {/* AI Copilot Card */}
          <div className="panel ai-panel" style={{ borderRadius: '16px', marginBottom: '24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
              <Sparkles size={20} color="#5eead4" />
              <span className="eyebrow" style={{ color: '#5eead4' }}>
                VERTEXLEARN AI
              </span>
            </div>
            <h2>Your AI Learning Copilot</h2>
            <p>
              Have a question about your lessons? VertexLearn AI retrieves relevant course transcripts to give accurate, grounded explanations.
            </p>
            {continueCourse ? (
              <Link to={`/courses/${continueCourse.course_id}`} className="btn btn-teal btn-full">
                <Sparkles size={15} /> Ask AI Tutor Now
              </Link>
            ) : (
              <Link to="/courses" className="btn btn-teal btn-full">
                <Compass size={15} /> Choose a Course to Begin
              </Link>
            )}
          </div>

          {/* Recommended Courses Preview */}
          {recommendedCourses.length > 0 && (
            <div className="panel" style={{ borderRadius: '16px', border: '1px solid #e2e8f0', background: '#ffffff', padding: '24px' }}>
              <div className="panel-head" style={{ marginBottom: '16px' }}>
                <h2 style={{ fontSize: '16px', fontWeight: 700, margin: 0 }}>
                  <Target size={18} color="#2563eb" /> Recommended For You
                </h2>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                {recommendedCourses.map((c) => (
                  <div
                    key={c.id}
                    style={{
                      padding: '14px',
                      background: '#f8fafc',
                      border: '1px solid #e2e8f0',
                      borderRadius: '12px',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                      <DifficultyBadge difficulty={c.difficulty} />
                      <span style={{ fontSize: '11px', color: '#64748b' }}>{c.category}</span>
                    </div>
                    <h4 style={{ fontSize: '14px', fontWeight: 700, margin: '6px 0', color: '#0f172a' }}>
                      {c.title}
                    </h4>
                    <p style={{ fontSize: '12px', color: '#64748b', lineHeight: 1.4, margin: '4px 0 12px' }}>
                      {c.description?.slice(0, 95)}...
                    </p>
                    <Link to={`/courses/${c.id}`} className="btn btn-outline btn-sm btn-full">
                      View Curriculum <ArrowRight size={13} />
                    </Link>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
