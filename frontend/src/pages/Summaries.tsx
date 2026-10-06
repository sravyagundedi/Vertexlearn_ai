import { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  FileText,
  Sparkles,
  BookOpen,
  Loader2,
  ArrowRight,
  CheckCircle2,
  RefreshCw,
  AlertCircle,
  Clock,
  Layers,
} from 'lucide-react';
import { coursesApi, lecturesApi } from '../services/api';

export default function Summaries() {
  const [searchParams] = useSearchParams();
  const [courses, setCourses] = useState<any[]>([]);
  const [selectedCourseId, setSelectedCourseId] = useState<string>('');
  const [selectedLecture, setSelectedLecture] = useState<any>(null);
  const [lectures, setLectures] = useState<any[]>([]);
  const [summary, setSummary] = useState<string>('');
  const [isCached, setIsCached] = useState<boolean>(false);
  const [loadingCatalog, setLoadingCatalog] = useState<boolean>(true);
  const [loadingSummary, setLoadingSummary] = useState<boolean>(false);
  const [generating, setGenerating] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // 1. Fetch courses catalog
  useEffect(() => {
    coursesApi
      .getAll()
      .then((res) => {
        const list = res.data || [];
        setCourses(list);
        const paramCourseId = searchParams.get('courseId');
        if (paramCourseId && list.some((c: any) => c.id === paramCourseId)) {
          setSelectedCourseId(paramCourseId);
        } else if (list.length > 0) {
          setSelectedCourseId(list[0].id);
        }
      })
      .finally(() => setLoadingCatalog(false));
  }, [searchParams]);

  // 2. Load lectures for selected course
  useEffect(() => {
    if (!selectedCourseId) return;
    coursesApi.getById(selectedCourseId).then((res) => {
      const allL: any[] = [];
      res.data?.modules?.forEach((m: any) => {
        m.lectures?.forEach((l: any) => {
          allL.push({ ...l, moduleTitle: m.title });
        });
      });
      setLectures(allL);

      const paramLectureId = searchParams.get('lectureId');
      if (paramLectureId && allL.some((l) => l.id === paramLectureId)) {
        setSelectedLecture(allL.find((l) => l.id === paramLectureId));
      } else if (allL.length > 0) {
        setSelectedLecture(allL[0]);
      } else {
        setSelectedLecture(null);
      }
    });
  }, [selectedCourseId, searchParams]);

  // 3. Fetch summary for the active lecture (cached or newly generated)
  useEffect(() => {
    if (!selectedLecture?.id) {
      setSummary('');
      return;
    }
    setLoadingSummary(true);
    setErrorMessage(null);
    lecturesApi
      .getSummary(selectedLecture.id)
      .then((res) => {
        setSummary(res.data?.summary || '');
        setIsCached(!!res.data?.cached);
      })
      .catch((err) => {
        console.error('Failed to load summary:', err);
        const errorMsg =
          err.response?.data?.error?.message ||
          err.response?.data?.detail ||
          (err.response?.status === 503
            ? 'AI service is not configured. Add the required AI provider API key to the environment configuration.'
            : 'No summary currently available. Click "Generate Summary" below.');
        setErrorMessage(errorMsg);
        setSummary('');
      })
      .finally(() => setLoadingSummary(false));
  }, [selectedLecture?.id]);

  // 4. Force generation / regeneration
  async function generateSummary(regenerate: boolean = false) {
    if (!selectedLecture?.id || generating) return;
    setGenerating(true);
    setErrorMessage(null);

    try {
      const res = await lecturesApi.getSummary(selectedLecture.id, regenerate);
      setSummary(res.data?.summary || '');
      setIsCached(!!res.data?.cached);
    } catch (err: any) {
      console.error('Generation error:', err);
      const errorMsg =
        err.response?.data?.error?.message ||
        err.response?.data?.detail ||
        (err.response?.status === 503
          ? 'AI service is not configured. Add the required AI provider API key to the environment configuration.'
          : 'Generating summary failed. Please try again.');
      setErrorMessage(errorMsg);
    } finally {
      setGenerating(false);
    }
  }

  return (
    <section>
      <header className="top" style={{ marginBottom: '24px' }}>
        <div>
          <span className="eyebrow">CONCISE AI SUMMARIES</span>
          <h1>Lecture Synthesis & Revision</h1>
          <p className="muted">
            Structured 5-part summaries grounded strictly in verified lecture transcripts and curriculum concepts.
          </p>
        </div>
      </header>

      {/* Selectors Bar */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '16px',
          alignItems: 'center',
          background: '#ffffff',
          border: '1px solid #e2e8f0',
          borderRadius: '14px',
          padding: '16px 20px',
          marginBottom: '24px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <label style={{ fontSize: '13px', fontWeight: 700, color: '#334155', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Layers size={16} color="#2563eb" /> Course:
          </label>
          <select
            value={selectedCourseId}
            onChange={(e) => setSelectedCourseId(e.target.value)}
            disabled={loadingCatalog}
            style={{
              padding: '8px 12px',
              borderRadius: '8px',
              border: '1px solid #cbd5e1',
              fontSize: '13px',
              background: '#fff',
              minWidth: '220px',
            }}
          >
            {courses.map((c) => (
              <option key={c.id} value={c.id}>
                {c.title}
              </option>
            ))}
          </select>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <label style={{ fontSize: '13px', fontWeight: 700, color: '#334155', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <BookOpen size={16} color="#0d9488" /> Lecture:
          </label>
          <select
            value={selectedLecture?.id || ''}
            onChange={(e) => {
              const found = lectures.find((l) => l.id === e.target.value);
              if (found) setSelectedLecture(found);
            }}
            disabled={lectures.length === 0}
            style={{
              padding: '8px 12px',
              borderRadius: '8px',
              border: '1px solid #cbd5e1',
              fontSize: '13px',
              background: '#fff',
              maxWidth: '360px',
            }}
          >
            {lectures.map((l) => (
              <option key={l.id} value={l.id}>
                {l.title}
              </option>
            ))}
          </select>
        </div>

        <div style={{ marginLeft: 'auto', display: 'flex', gap: '10px' }}>
          {summary ? (
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => generateSummary(true)}
              disabled={generating || !selectedLecture}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
            >
              <RefreshCw size={14} className={generating ? 'chat-loading' : ''} />
              {generating ? 'Regenerating...' : 'Regenerate'}
            </button>
          ) : (
            <button
              className="btn btn-primary btn-sm"
              onClick={() => generateSummary(false)}
              disabled={generating || !selectedLecture}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
            >
              {generating ? <Loader2 size={14} className="chat-loading" /> : <Sparkles size={14} />}
              {generating ? 'Generating summary...' : 'Generate Summary'}
            </button>
          )}
        </div>
      </div>

      {/* Summary Content Card */}
      <div
        className="panel"
        style={{
          borderRadius: '16px',
          border: '1px solid #e2e8f0',
          background: '#ffffff',
          padding: '32px',
          minHeight: '360px',
        }}
      >
        <div
          className="panel-head"
          style={{
            marginBottom: '20px',
            paddingBottom: '16px',
            borderBottom: '1px solid #f1f5f9',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            flexWrap: 'wrap',
            gap: '12px',
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
              <span style={{ fontSize: '11px', fontWeight: 800, color: '#d97706', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                Verified Lecture Synthesis
              </span>
              {isCached && (
                <span
                  style={{
                    fontSize: '11px',
                    fontWeight: 700,
                    background: '#f0fdf4',
                    color: '#15803d',
                    padding: '2px 8px',
                    borderRadius: '10px',
                    border: '1px solid #bbf7d0',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                  }}
                >
                  <CheckCircle2 size={12} /> Saved in Course
                </span>
              )}
            </div>
            <h2 style={{ fontSize: '22px', fontWeight: 800, margin: 0, color: '#0f172a' }}>
              {selectedLecture?.title || 'Select a Lecture'}
            </h2>
            {selectedLecture?.moduleTitle && (
              <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#64748b' }}>
                Module: <b>{selectedLecture.moduleTitle}</b>
              </p>
            )}
          </div>

          {selectedLecture && (
            <Link
              to={`/courses/${selectedCourseId}?lectureId=${selectedLecture.id}`}
              className="btn btn-secondary btn-sm"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
            >
              Open Full Lesson Video <ArrowRight size={14} />
            </Link>
          )}
        </div>

        {/* State Display: Loading, Error, Content, Empty */}
        {loadingSummary || generating ? (
          <div style={{ padding: '60px 20px', textAlign: 'center', color: '#0d9488' }}>
            <Loader2 size={36} className="chat-loading" style={{ margin: '0 auto 16px' }} />
            <h3 style={{ fontSize: '16px', fontWeight: 700, margin: '0 0 6px', color: '#0f172a' }}>
              Generating summary...
            </h3>
            <p style={{ fontSize: '13px', color: '#64748b', maxWidth: '440px', margin: '0 auto' }}>
              Analyzing lecture transcript, extracting core definitions, architectural patterns, and exam takeaways...
            </p>
          </div>
        ) : errorMessage ? (
          <div
            style={{
              padding: '24px',
              borderRadius: '12px',
              background: '#fef2f2',
              border: '1px solid #fee2e2',
              color: '#dc2626',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '12px',
              textAlign: 'center',
              margin: '20px 0',
            }}
          >
            <AlertCircle size={28} />
            <b style={{ fontSize: '14px' }}>{errorMessage}</b>
            <button className="btn btn-primary btn-sm" onClick={() => generateSummary(false)}>
              Retry Generating Summary
            </button>
          </div>
        ) : summary ? (
          <div
            style={{
              whiteSpace: 'pre-wrap',
              lineHeight: 1.7,
              fontSize: '14.5px',
              color: '#334155',
              background: '#f8fafc',
              padding: '24px 28px',
              borderRadius: '12px',
              border: '1px solid #e2e8f0',
            }}
          >
            {summary}
          </div>
        ) : (
          <div style={{ padding: '60px 20px', textAlign: 'center', color: '#64748b' }}>
            <FileText size={44} color="#94a3b8" style={{ margin: '0 auto 16px' }} />
            <h3 style={{ fontSize: '16px', fontWeight: 700, margin: '0 0 8px', color: '#0f172a' }}>
              No Summary Generated Yet
            </h3>
            <p style={{ fontSize: '13px', maxWidth: '420px', margin: '0 auto 20px', lineHeight: 1.6 }}>
              Click "Generate Summary" to run our AI summarizer over this lecture's verified transcript and notes.
            </p>
            <button
              className="btn btn-primary"
              onClick={() => generateSummary(false)}
              disabled={generating || !selectedLecture}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}
            >
              <Sparkles size={16} /> Generate Summary
            </button>
          </div>
        )}
      </div>
    </section>
  );
}
