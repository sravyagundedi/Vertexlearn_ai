import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Zap,
  Award,
  BookOpen,
  ArrowRight,
  CheckCircle2,
  Clock,
  Sparkles,
  HelpCircle,
  Loader2,
  AlertCircle,
  PlusCircle,
  Layers,
} from 'lucide-react';
import { api, coursesApi, usersApi, aiApi } from '../services/api';
import QuizPlayer from '../components/QuizPlayer';
import { DifficultyBadge } from '../components/Badge';

export default function Quizzes() {
  const [courses, setCourses] = useState<any[]>([]);
  const [quizzes, setQuizzes] = useState<any[]>([]);
  const [quizResults, setQuizResults] = useState<any[]>([]);
  const [activeQuizId, setActiveQuizId] = useState<string | null>(null);
  const [activeQuizTitle, setActiveQuizTitle] = useState<string>('');
  const [loading, setLoading] = useState(true);

  // AI Quiz Generation Form State
  const [selectedCourseId, setSelectedCourseId] = useState<string>('');
  const [selectedLectureId, setSelectedLectureId] = useState<string>('');
  const [courseLectures, setCourseLectures] = useState<any[]>([]);
  const [numQuestions, setNumQuestions] = useState<number>(5);
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [generateError, setGenerateError] = useState<string | null>(null);

  const fetchQuizzesAndResults = async () => {
    try {
      const [enrollRes, catalogRes, quizRes] = await Promise.all([
        api.get('/enrollments/me').catch(() => ({ data: [] })),
        coursesApi.getAll().catch(() => ({ data: [] })),
        usersApi.getQuizResults().catch(() => ({ data: [] })),
      ]);

      const enrolled = enrollRes.data || [];
      const catalog = catalogRes.data || [];
      const courseList = enrolled.length > 0 ? enrolled : catalog;
      setCourses(courseList);

      if (courseList.length > 0 && !selectedCourseId) {
        setSelectedCourseId(courseList[0].course_id || courseList[0].id);
      }

      setQuizResults(quizRes.data || []);

      const collectedQuizzes: any[] = [];
      for (const c of courseList) {
        const cId = c.course_id || c.id;
        try {
          const qList = await api.get(`/courses/${cId}/quizzes`);
          (qList.data || []).forEach((q: any) => {
            collectedQuizzes.push({
              ...q,
              course_id: cId,
              course_title: c.title,
            });
          });
        } catch {}
      }

      setQuizzes(collectedQuizzes);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchQuizzesAndResults();
  }, []);

  // Update lectures dropdown when selected course changes for AI Quiz generation
  useEffect(() => {
    if (!selectedCourseId) {
      setCourseLectures([]);
      setSelectedLectureId('');
      return;
    }

    coursesApi.getById(selectedCourseId).then((res) => {
      const allL: any[] = [];
      res.data?.modules?.forEach((m: any) => {
        m.lectures?.forEach((l: any) => {
          allL.push({ ...l, moduleTitle: m.title });
        });
      });
      setCourseLectures(allL);
      setSelectedLectureId(''); // default to whole course
    }).catch(() => setCourseLectures([]));
  }, [selectedCourseId]);

  // Handle AI Quiz Generation
  const handleGenerateAiQuiz = async () => {
    if (!selectedCourseId || isGenerating) return;
    setIsGenerating(true);
    setGenerateError(null);

    try {
      const res = await aiApi.generateQuiz({
        course_id: selectedCourseId,
        lecture_id: selectedLectureId || undefined,
        number_of_questions: numQuestions,
      });

      const newQuizId = res.data?.quiz_id;
      const newTitle = res.data?.title || 'AI Assessment';

      await fetchQuizzesAndResults();

      // Launch newly generated quiz immediately!
      if (newQuizId) {
        setActiveQuizId(newQuizId);
        setActiveQuizTitle(newTitle);
      }
    } catch (err: any) {
      console.error('Quiz generation failed:', err);
      const errMsg =
        err.response?.data?.error?.message ||
        err.response?.data?.detail ||
        (err.response?.status === 503
          ? 'AI service is not configured. Add the required AI provider API key to the environment configuration.'
          : 'Failed to generate quiz. Please try again.');
      setGenerateError(errMsg);
    } finally {
      setIsGenerating(false);
    }
  };

  if (activeQuizId) {
    return (
      <section>
        <button
          className="btn btn-secondary btn-sm"
          style={{ marginBottom: '16px' }}
          onClick={() => setActiveQuizId(null)}
        >
          ← Back to All Quizzes
        </button>
        <QuizPlayer
          quizId={activeQuizId}
          quizTitle={activeQuizTitle}
          onComplete={() => fetchQuizzesAndResults()}
          onClose={() => setActiveQuizId(null)}
        />
      </section>
    );
  }

  return (
    <section>
      <header className="top" style={{ marginBottom: '24px' }}>
        <div>
          <span className="eyebrow">AUTOMATED AI ASSESSMENT</span>
          <h1>Interactive Quizzes & Mastery</h1>
          <p className="muted">
            Test concept comprehension with AI-generated questions grounded strictly in course transcripts.
          </p>
        </div>
      </header>

      {/* AI Quiz Generator Card */}
      <div
        className="panel"
        style={{
          borderRadius: '16px',
          border: '1px solid #c7d2fe',
          background: 'linear-gradient(135deg, #ffffff, #f5f3ff)',
          padding: '24px 28px',
          marginBottom: '28px',
          boxShadow: '0 4px 12px rgba(124, 58, 237, 0.04)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
          <div
            style={{
              width: '40px',
              height: '40px',
              borderRadius: '50%',
              background: '#7c3aed',
              color: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Sparkles size={20} />
          </div>
          <div>
            <h2 style={{ fontSize: '18px', fontWeight: 800, margin: 0, color: '#0f172a' }}>
              Generate Custom AI Quiz
            </h2>
            <p style={{ margin: 0, fontSize: '13px', color: '#64748b' }}>
              Dynamically synthesizes 4-option multiple-choice questions grounded in verified syllabus content.
            </p>
          </div>
        </div>

        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '16px',
            alignItems: 'flex-end',
          }}
        >
          <div style={{ flex: '1 1 220px' }}>
            <label style={{ fontSize: '12px', fontWeight: 700, color: '#334155', display: 'block', marginBottom: '6px' }}>
              Target Course:
            </label>
            <select
              value={selectedCourseId}
              onChange={(e) => setSelectedCourseId(e.target.value)}
              disabled={isGenerating || courses.length === 0}
              style={{
                width: '100%',
                padding: '9px 12px',
                borderRadius: '8px',
                border: '1px solid #cbd5e1',
                fontSize: '13px',
                background: '#fff',
              }}
            >
              {courses.map((c) => (
                <option key={c.course_id || c.id} value={c.course_id || c.id}>
                  {c.title}
                </option>
              ))}
            </select>
          </div>

          <div style={{ flex: '1 1 240px' }}>
            <label style={{ fontSize: '12px', fontWeight: 700, color: '#334155', display: 'block', marginBottom: '6px' }}>
              Lecture Scope (Optional):
            </label>
            <select
              value={selectedLectureId}
              onChange={(e) => setSelectedLectureId(e.target.value)}
              disabled={isGenerating || courseLectures.length === 0}
              style={{
                width: '100%',
                padding: '9px 12px',
                borderRadius: '8px',
                border: '1px solid #cbd5e1',
                fontSize: '13px',
                background: '#fff',
              }}
            >
              <option value="">Full Course Curriculum (Comprehensive)</option>
              {courseLectures.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.title}
                </option>
              ))}
            </select>
          </div>

          <div style={{ width: '130px' }}>
            <label style={{ fontSize: '12px', fontWeight: 700, color: '#334155', display: 'block', marginBottom: '6px' }}>
              Questions:
            </label>
            <select
              value={numQuestions}
              onChange={(e) => setNumQuestions(Number(e.target.value))}
              disabled={isGenerating}
              style={{
                width: '100%',
                padding: '9px 12px',
                borderRadius: '8px',
                border: '1px solid #cbd5e1',
                fontSize: '13px',
                background: '#fff',
              }}
            >
              <option value={3}>3 Questions</option>
              <option value={5}>5 Questions</option>
              <option value={10}>10 Questions</option>
            </select>
          </div>

          <button
            className="btn btn-primary"
            onClick={handleGenerateAiQuiz}
            disabled={isGenerating || !selectedCourseId}
            style={{
              padding: '10px 22px',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              background: '#7c3aed',
              borderColor: '#7c3aed',
            }}
          >
            {isGenerating ? <Loader2 size={16} className="chat-loading" /> : <Sparkles size={16} />}
            {isGenerating ? 'Generating Quiz...' : 'Generate AI Quiz'}
          </button>
        </div>

        {generateError && (
          <div style={{ marginTop: '12px', color: '#dc2626', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <AlertCircle size={14} /> {generateError}
          </div>
        )}
      </div>

      {/* Available Quizzes List */}
      <div className="panel" style={{ borderRadius: '16px', border: '1px solid #e2e8f0', background: '#ffffff', padding: '24px', marginBottom: '28px' }}>
        <div className="panel-head" style={{ marginBottom: '16px' }}>
          <h2 style={{ fontSize: '16px', fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Zap size={18} color="#7c3aed" /> Available Quizzes
          </h2>
          <span style={{ fontSize: '12px', color: '#64748b' }}>
            {quizzes.length} quizzes available
          </span>
        </div>

        {loading ? (
          <div style={{ padding: '30px', textAlign: 'center', color: '#64748b' }}>
            <Loader2 size={24} className="chat-loading" style={{ margin: '0 auto 8px' }} />
            Loading course quizzes...
          </div>
        ) : quizzes.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {quizzes.map((q) => {
              const prevAttempt = quizResults.find((qr) => qr.quiz_id === q.id);

              return (
                <div
                  key={q.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '16px 20px',
                    borderRadius: '12px',
                    background: '#f8fafc',
                    border: '1px solid #e2e8f0',
                    flexWrap: 'wrap',
                    gap: '12px',
                  }}
                >
                  <div style={{ flex: '1 1 300px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                      <span style={{ fontSize: '11px', fontWeight: 700, color: '#2563eb', background: '#eff6ff', padding: '2px 8px', borderRadius: '4px' }}>
                        {q.course_title}
                      </span>
                      {q.is_ai_generated ? (
                        <span
                          style={{
                            fontSize: '11px',
                            fontWeight: 700,
                            color: '#7c3aed',
                            background: '#f5f3ff',
                            padding: '2px 8px',
                            borderRadius: '4px',
                            border: '1px solid #ddd6fe',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                          }}
                        >
                          <Sparkles size={11} /> AI Generated
                        </span>
                      ) : (
                        <DifficultyBadge difficulty={q.difficulty || 'intermediate'} />
                      )}
                    </div>
                    <h3 style={{ fontSize: '15px', fontWeight: 700, margin: '2px 0 4px', color: '#0f172a' }}>
                      {q.title}
                    </h3>
                    <p style={{ fontSize: '12px', color: '#64748b', margin: 0 }}>
                      {q.description || `Assessment covering ${q.module_title || 'module topics'}.`} ({q.total_questions || 5} questions • Pass: {q.passing_score || 70}%)
                    </p>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                    {prevAttempt && (
                      <span
                        style={{
                          fontSize: '12px',
                          fontWeight: 700,
                          padding: '4px 10px',
                          borderRadius: '6px',
                          background: prevAttempt.passed ? '#ecfdf5' : '#fff1f2',
                          color: prevAttempt.passed ? '#047857' : '#e11d48',
                          border: prevAttempt.passed ? '1px solid #a7f3d0' : '1px solid #fecdd3',
                        }}
                      >
                        {prevAttempt.score}% ({prevAttempt.passed ? 'Passed' : 'Needs Review'})
                      </span>
                    )}

                    <button
                      className="btn btn-primary btn-sm"
                      onClick={() => {
                        setActiveQuizId(q.id);
                        setActiveQuizTitle(q.title);
                      }}
                      style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                    >
                      {prevAttempt ? 'Retake Quiz' : 'Start Quiz'} <ArrowRight size={14} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>
            <p>Enroll in courses or use the AI Quiz Generator above to create your first assessment.</p>
          </div>
        )}
      </div>

      {/* Past Quiz Attempts Section */}
      {quizResults.length > 0 && (
        <div className="panel" style={{ borderRadius: '16px', border: '1px solid #e2e8f0', background: '#ffffff', padding: '24px' }}>
          <h2 style={{ fontSize: '16px', fontWeight: 700, margin: '0 0 16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Award size={18} color="#0d9488" /> Recent Attempt History
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {quizResults.map((r, i) => (
              <div
                key={i}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '12px 16px',
                  borderRadius: '10px',
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  fontSize: '13px',
                }}
              >
                <div>
                  <b style={{ color: '#0f172a' }}>{r.quiz_title}</b>
                  <p style={{ margin: 0, fontSize: '12px', color: '#64748b' }}>
                    {r.course_title} • {new Date(r.submitted_at).toLocaleDateString()} at {new Date(r.submitted_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <b style={{ fontSize: '15px', color: r.passed ? '#15803d' : '#e11d48' }}>
                    {r.score}%
                  </b>
                  <span
                    style={{
                      fontSize: '11px',
                      fontWeight: 700,
                      padding: '3px 8px',
                      borderRadius: '6px',
                      background: r.passed ? '#dcfce7' : '#fee2e2',
                      color: r.passed ? '#15803d' : '#b91c1c',
                    }}
                  >
                    {r.passed ? 'PASSED' : 'RETRY'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
