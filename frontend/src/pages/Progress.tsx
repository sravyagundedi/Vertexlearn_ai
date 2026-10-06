import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  TrendingUp,
  Award,
  BookOpen,
  Flame,
  CheckCircle2,
  Clock,
  ArrowRight,
  Target,
  BarChart3,
  AlertTriangle,
  Zap,
} from 'lucide-react';
import { api, usersApi } from '../services/api';
import StatCard from '../components/StatCard';

export default function Progress() {
  const [stats, setStats] = useState<any>(null);
  const [mastery, setMastery] = useState<any>(null);
  const [enrollments, setEnrollments] = useState<any[]>([]);
  const [quizResults, setQuizResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      usersApi.getProgress().catch(() => ({ data: null })),
      usersApi.getMastery().catch(() => ({ data: null })),
      api.get('/enrollments/me').catch(() => ({ data: [] })),
      usersApi.getQuizResults().catch(() => ({ data: [] })),
    ])
      .then(([progRes, masteryRes, enrollRes, quizRes]) => {
        setStats(progRes.data);
        setMastery(masteryRes.data);
        setEnrollments(enrollRes.data || []);
        setQuizResults(quizRes.data || []);
      })
      .finally(() => setLoading(false));
  }, []);

  const totalEnrolled = stats?.courses_enrolled ?? enrollments.length;
  const lessonsCompleted = stats?.lessons_completed ?? 0;
  const totalLessons = stats?.total_lessons_available ?? enrollments.reduce((acc, curr) => acc + Number(curr.total_lectures || 0), 0);
  const avgQuizScore = stats?.avg_quiz_score ?? 0;
  const avgProgress = stats?.avg_progress ?? 0;
  const streak = stats?.learning_streak_days ?? 0;

  const studyTimeMin = Math.round((stats?.study_time_seconds || mastery?.total_study_time_seconds || 0) / 60);
  const studyHours = (studyTimeMin / 60).toFixed(1);

  const strongTopics: string[] = stats?.strong_topics || mastery?.strong_topics || [];
  const weakTopics: string[] = stats?.weak_topics || mastery?.weak_topics || [];
  const categories = mastery?.categories || [];

  return (
    <section>
      <header className="top" style={{ marginBottom: '24px' }}>
        <div>
          <span className="eyebrow">ANALYTICS & TOPIC MASTERY</span>
          <h1>Progress & Mastery Dashboard</h1>
          <p className="muted">
            Live student tracking calculated from completed lectures, verified quiz performance, and active study consistency.
          </p>
        </div>
      </header>

      {/* KPI Overview Cards */}
      <div className="stats" style={{ marginBottom: '28px' }}>
        <StatCard
          label="Course Progress"
          value={loading ? '...' : `${avgProgress}%`}
          detail="Average across curricula"
          icon={TrendingUp}
        />
        <StatCard
          label="Quiz Average"
          value={loading ? '...' : `${avgQuizScore}%`}
          detail="Across evaluated quizzes"
          icon={Award}
        />
        <StatCard
          label="Lectures Completed"
          value={loading ? '...' : `${lessonsCompleted} / ${totalLessons || '—'}`}
          detail="Verified lessons finished"
          icon={CheckCircle2}
        />
        <StatCard
          label="Study Time"
          value={loading ? '...' : `${studyHours} hrs`}
          detail={`${studyTimeMin} active minutes`}
          icon={Clock}
        />
        <StatCard
          label="Learning Streak"
          value={loading ? '...' : `${streak} days`}
          detail="Consecutive study"
          icon={Flame}
        />
      </div>

      {/* Topic Mastery Overview: Strong vs Weak Topics */}
      <div className="grid2" style={{ marginBottom: '24px' }}>
        {/* Strong Topics Card */}
        <div className="panel" style={{ borderRadius: '16px', border: '1px solid #e2e8f0', background: '#ffffff', padding: '24px' }}>
          <div className="panel-head" style={{ marginBottom: '16px' }}>
            <h2 style={{ fontSize: '16px', fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <CheckCircle2 size={18} color="#16a34a" /> Strong Topics
            </h2>
            <span style={{ fontSize: '11px', fontWeight: 700, background: '#dcfce7', color: '#15803d', padding: '2px 8px', borderRadius: '4px' }}>
              ≥70% Mastery
            </span>
          </div>
          <p style={{ fontSize: '13px', color: '#64748b', margin: '0 0 14px' }}>
            Demonstrated high accuracy on evaluations and completed curriculum modules:
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            {strongTopics.length > 0 ? (
              strongTopics.map((topic, i) => (
                <span
                  key={i}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '8px 14px',
                    borderRadius: '8px',
                    background: '#f0fdf4',
                    border: '1px solid #bbf7d0',
                    color: '#15803d',
                    fontSize: '13px',
                    fontWeight: 600,
                  }}
                >
                  ✓ {topic}
                </span>
              ))
            ) : (
              <span style={{ color: '#64748b', fontSize: '13px' }}>Complete lessons and quizzes to establish topic strengths.</span>
            )}
          </div>
        </div>

        {/* Weak Topics Card */}
        <div className="panel" style={{ borderRadius: '16px', border: '1px solid #e2e8f0', background: '#ffffff', padding: '24px' }}>
          <div className="panel-head" style={{ marginBottom: '16px' }}>
            <h2 style={{ fontSize: '16px', fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <AlertTriangle size={18} color="#d97706" /> Weak Topics / Needs Review
            </h2>
            <span style={{ fontSize: '11px', fontWeight: 700, background: '#fef3c7', color: '#b45309', padding: '2px 8px', borderRadius: '4px' }}>
              Targeted Revision
            </span>
          </div>
          <p style={{ fontSize: '13px', color: '#64748b', margin: '0 0 14px' }}>
            Topics where quiz answers or comprehension checks fell below the passing threshold:
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            {weakTopics.length > 0 ? (
              weakTopics.map((topic, i) => (
                <span
                  key={i}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '8px 14px',
                    borderRadius: '8px',
                    background: '#fffbeb',
                    border: '1px solid #fde68a',
                    color: '#b45309',
                    fontSize: '13px',
                    fontWeight: 600,
                  }}
                >
                  ⚠️ {topic}
                </span>
              ))
            ) : (
              <span style={{ color: '#64748b', fontSize: '13px' }}>No critical weak topics flagged! Keep reviewing lessons.</span>
            )}
          </div>
        </div>
      </div>

      {/* Category Mastery Breakdown */}
      {categories.length > 0 && (
        <div className="panel" style={{ borderRadius: '16px', border: '1px solid #e2e8f0', background: '#ffffff', padding: '24px', marginBottom: '24px' }}>
          <div className="panel-head" style={{ marginBottom: '18px' }}>
            <h2 style={{ fontSize: '16px', fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Target size={18} color="#2563eb" /> Category Mastery Breakdown
            </h2>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {categories.map((c: any, i: number) => (
              <div key={i} style={{ padding: '14px 18px', borderRadius: '10px', background: '#f8fafc', border: '1px solid #e2e8f0' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <b style={{ fontSize: '14px', color: '#0f172a' }}>{c.category}</b>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ fontSize: '12px', color: '#64748b' }}>
                      {c.completed_lectures} / {c.total_lectures} lessons • Quiz Avg: {c.avg_quiz_score}%
                    </span>
                    <b style={{ fontSize: '14px', color: '#0d9488' }}>{c.mastery_percent}%</b>
                  </div>
                </div>
                <div className="progress" style={{ height: '7px' }}>
                  <i style={{ width: `${c.mastery_percent}%`, backgroundColor: '#0d9488' }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Course Completion Breakdown */}
      <div className="panel" style={{ borderRadius: '16px', border: '1px solid #e2e8f0', background: '#ffffff', padding: '24px', marginBottom: '24px' }}>
        <div className="panel-head" style={{ marginBottom: '18px' }}>
          <h2 style={{ fontSize: '16px', fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <BarChart3 size={18} color="#2563eb" /> Course Completion & Milestones
          </h2>
        </div>

        {enrollments.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {enrollments.map((e) => (
              <div
                key={e.id}
                style={{
                  padding: '16px 20px',
                  borderRadius: '12px',
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <b style={{ fontSize: '15px', color: '#0f172a' }}>{e.title}</b>
                  <span style={{ fontSize: '14px', fontWeight: 800, color: '#0d9488' }}>
                    {e.progress_percent}% Complete
                  </span>
                </div>
                <div className="progress" style={{ height: '8px', marginBottom: '12px' }}>
                  <i style={{ width: `${e.progress_percent}%`, backgroundColor: '#0d9488' }} />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px', color: '#64748b' }}>
                  <span>{e.completed_lectures || 0} of {e.total_lectures || 0} lessons completed</span>
                  <Link to={`/courses/${e.course_id}`} className="btn btn-secondary btn-sm">
                    Open Course <ArrowRight size={13} />
                  </Link>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ padding: '30px', textAlign: 'center', color: '#64748b' }}>
            No enrolled courses found.
          </div>
        )}
      </div>

      {/* Quiz Attempt History */}
      <div className="panel" style={{ borderRadius: '16px', border: '1px solid #e2e8f0', background: '#ffffff', padding: '24px' }}>
        <div className="panel-head" style={{ marginBottom: '18px' }}>
          <h2 style={{ fontSize: '16px', fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Award size={18} color="#d97706" /> Evaluated Quiz Attempts
          </h2>
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
                  padding: '14px 18px',
                  borderRadius: '10px',
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  flexWrap: 'wrap',
                  gap: '8px',
                }}
              >
                <div>
                  <b style={{ fontSize: '14px', color: '#0f172a', display: 'block' }}>
                    {qr.quiz_title}
                  </b>
                  <span style={{ fontSize: '11px', color: '#64748b' }}>
                    {qr.course_title} • Submitted {new Date(qr.submitted_at).toLocaleDateString()}
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
                  <b style={{ fontSize: '16px', color: qr.passed ? '#047857' : '#0f172a' }}>
                    {qr.percentage}%
                  </b>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ padding: '30px', textAlign: 'center', color: '#64748b' }}>
            No quizzes evaluated yet.
          </div>
        )}
      </div>
    </section>
  );
}
