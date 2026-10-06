import { useState, useEffect, useRef } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  BrainCircuit,
  Sparkles,
  Send,
  BookOpen,
  Loader2,
  Trash2,
  ExternalLink,
  Info,
  AlertCircle,
} from 'lucide-react';
import { api, coursesApi, aiApi } from '../services/api';

interface ChatSource {
  lecture_id?: string;
  chunk_id?: string | null;
  title?: string;
}

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  sources?: ChatSource[];
  timestamp: string;
}

export default function AiTutor() {
  const [searchParams] = useSearchParams();
  const [courses, setCourses] = useState<any[]>([]);
  const [selectedCourseId, setSelectedCourseId] = useState<string>('');
  const [mode, setMode] = useState<string>('intermediate');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [question, setQuestion] = useState<string>('');
  const [loadingCourses, setLoadingCourses] = useState<boolean>(true);
  const [loadingHistory, setLoadingHistory] = useState<boolean>(false);
  const [isAsking, setIsAsking] = useState<boolean>(false);
  const [isClearing, setIsClearing] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const chatBoxRef = useRef<HTMLDivElement>(null);

  // Load courses
  useEffect(() => {
    Promise.all([
      api.get('/enrollments/me').catch(() => ({ data: [] })),
      coursesApi.getAll().catch(() => ({ data: [] })),
    ])
      .then(([enrollRes, catalogRes]) => {
        const enrolled = enrollRes.data || [];
        const catalog = catalogRes.data || [];
        const list = enrolled.length > 0 ? enrolled : catalog;
        setCourses(list);

        const paramCourseId = searchParams.get('courseId');
        if (paramCourseId) {
          setSelectedCourseId(paramCourseId);
        } else if (list.length > 0) {
          setSelectedCourseId(list[0].course_id || list[0].id);
        }
      })
      .finally(() => setLoadingCourses(false));
  }, [searchParams]);

  // Load chat history whenever selected course changes
  useEffect(() => {
    if (!selectedCourseId) {
      setMessages([]);
      return;
    }
    setLoadingHistory(true);
    setErrorMessage(null);
    aiApi
      .getHistory(selectedCourseId)
      .then((res) => {
        setMessages(res.data?.messages || []);
      })
      .catch(() => {
        setMessages([]);
      })
      .finally(() => setLoadingHistory(false));
  }, [selectedCourseId]);

  // Scroll to bottom on updates
  useEffect(() => {
    if (chatBoxRef.current) {
      chatBoxRef.current.scrollTop = chatBoxRef.current.scrollHeight;
    }
  }, [messages, isAsking, loadingHistory]);

  const activeCourse = courses.find(
    (c) => (c.course_id || c.id) === selectedCourseId
  );

  async function clearHistory() {
    if (!selectedCourseId || isClearing) return;
    if (!window.confirm('Are you sure you want to clear your conversation history for this course?')) return;
    setIsClearing(true);
    try {
      await aiApi.clearHistory(selectedCourseId);
      setMessages([]);
    } catch (err: any) {
      console.error('Failed to clear history:', err);
    } finally {
      setIsClearing(false);
    }
  }

  async function askQuestion(textToAsk?: string) {
    const q = (textToAsk || question).trim();
    if (!q || isAsking || !selectedCourseId) return;

    setErrorMessage(null);
    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      text: q,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setQuestion('');
    setIsAsking(true);

    try {
      const res = await aiApi.chat({
        course_id: selectedCourseId,
        question: q,
        mode,
      });

      const aiMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        text: res.data?.reply || 'No answer generated.',
        sources: res.data?.sources || [],
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages((prev) => [...prev, aiMsg]);
    } catch (err: any) {
      const errorMsg =
        err.response?.data?.error?.message ||
        err.response?.data?.detail ||
        (err.response?.status === 503
          ? 'AI service is not configured. Add the required AI provider API key to the environment configuration.'
          : 'AI Tutor is temporarily unavailable. Please try again.');
      setErrorMessage(errorMsg);
      setMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          text: errorMsg,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
    } finally {
      setIsAsking(false);
    }
  }

  const isInsufficientContext = (text: string) =>
    text.includes("couldn't find enough information") || text.includes('insufficient context');

  return (
    <section>
      <header className="top" style={{ marginBottom: '20px' }}>
        <div>
          <span className="eyebrow">COURSE-GROUNDED AI TUTOR</span>
          <h1>AI Learning Copilot</h1>
          <p className="muted">
            Ask targeted questions grounded strictly in verified curriculum transcripts and lecture materials.
          </p>
        </div>
      </header>

      {/* Course Selection & Controls Bar */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '16px',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: '#ffffff',
          border: '1px solid #e2e8f0',
          borderRadius: '14px',
          padding: '16px 20px',
          marginBottom: '20px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          <label style={{ fontSize: '13px', fontWeight: 700, color: '#334155', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <BookOpen size={16} color="#2563eb" /> Active Course:
          </label>
          <select
            value={selectedCourseId}
            onChange={(e) => setSelectedCourseId(e.target.value)}
            disabled={loadingCourses}
            style={{
              padding: '8px 12px',
              borderRadius: '8px',
              border: '1px solid #cbd5e1',
              fontSize: '13px',
              background: '#fff',
              minWidth: '240px',
            }}
          >
            {courses.map((c) => (
              <option key={c.course_id || c.id} value={c.course_id || c.id}>
                {c.title}
              </option>
            ))}
          </select>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '13px', fontWeight: 600, color: '#64748b' }}>Mode:</span>
            <select
              value={mode}
              onChange={(e) => setMode(e.target.value)}
              style={{
                padding: '8px 12px',
                borderRadius: '8px',
                border: '1px solid #cbd5e1',
                fontSize: '13px',
                background: '#fff',
              }}
            >
              <option value="beginner">Beginner (Intuitive & Analogies)</option>
              <option value="intermediate">Intermediate (Standard Curriculum)</option>
              <option value="advanced">Advanced (Deep Technical / Architecture)</option>
            </select>
          </div>

          {messages.length > 0 && (
            <button
              type="button"
              onClick={clearHistory}
              disabled={isClearing}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '8px 14px',
                borderRadius: '8px',
                border: '1px solid #fee2e2',
                background: '#fef2f2',
                color: '#dc2626',
                fontSize: '12px',
                fontWeight: 600,
                cursor: 'pointer',
              }}
              title="Clear session conversation"
            >
              {isClearing ? <Loader2 size={14} className="chat-loading" /> : <Trash2 size={14} />}
              Clear History
            </button>
          )}
        </div>
      </div>

      {/* Main Chat Interface */}
      <div
        className="panel tutor"
        style={{
          borderRadius: '16px',
          border: '1px solid #e2e8f0',
          background: '#ffffff',
          display: 'flex',
          flexDirection: 'column',
          minHeight: '520px',
          height: 'calc(100vh - 280px)',
          maxHeight: '750px',
          padding: 0,
          overflow: 'hidden',
        }}
      >
        {/* Quick prompt chips */}
        <div
          style={{
            display: 'flex',
            gap: '8px',
            padding: '10px 16px',
            background: '#f8fafc',
            borderBottom: '1px solid #e2e8f0',
            overflowX: 'auto',
            whiteSpace: 'nowrap',
          }}
        >
          <button
            type="button"
            className="prompt-chip"
            onClick={() => askQuestion(`What is a REST API and how does it work?`)}
            disabled={isAsking || !selectedCourseId}
          >
            💡 Explain REST APIs
          </button>
          <button
            type="button"
            className="prompt-chip"
            onClick={() => askQuestion(`What is the difference between GET and POST?`)}
            disabled={isAsking || !selectedCourseId}
          >
            ⚖️ Difference GET vs POST
          </button>
          <button
            type="button"
            className="prompt-chip"
            onClick={() => askQuestion(`What is supervised learning?`)}
            disabled={isAsking || !selectedCourseId}
          >
            🤖 Supervised Learning
          </button>
          <button
            type="button"
            className="prompt-chip"
            onClick={() => askQuestion(`Summarize the core architectural concepts covered in this curriculum.`)}
            disabled={isAsking || !selectedCourseId}
          >
            📝 Lesson Summary
          </button>
          <button
            type="button"
            className="prompt-chip"
            onClick={() => askQuestion(`Give me a common technical interview question on this course.`)}
            disabled={isAsking || !selectedCourseId}
          >
            💼 Interview Question
          </button>
        </div>

        {/* Message Stream */}
        <div
          className="chat-box"
          ref={chatBoxRef}
          style={{
            flexGrow: 1,
            overflowY: 'auto',
            padding: '20px',
            display: 'flex',
            flexDirection: 'column',
            gap: '14px',
          }}
        >
          {loadingHistory ? (
            <div style={{ textAlign: 'center', margin: 'auto', color: '#64748b' }}>
              <Loader2 size={24} className="chat-loading" style={{ margin: '0 auto 8px' }} />
              <p style={{ fontSize: '13px' }}>Loading session history...</p>
            </div>
          ) : messages.length === 0 ? (
            <div style={{ textAlign: 'center', margin: 'auto', maxWidth: '520px', color: '#64748b' }}>
              <div
                style={{
                  width: '56px',
                  height: '56px',
                  borderRadius: '50%',
                  background: '#eff6ff',
                  color: '#2563eb',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 16px',
                }}
              >
                <BrainCircuit size={28} />
              </div>
              <h3 style={{ fontSize: '18px', fontWeight: 800, color: '#0f172a', margin: '0 0 8px' }}>
                Course-Grounded AI Tutor
              </h3>
              <p style={{ fontSize: '13px', lineHeight: 1.6, margin: '0 0 20px' }}>
                Ask any question about <b>{activeCourse?.title || 'your course'}</b>. The tutor uses pgvector retrieval to locate the exact lecture transcripts and explain concepts with verified citations.
              </p>
              <div
                style={{
                  fontSize: '12px',
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: '8px',
                  padding: '10px 14px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  color: '#475569',
                  textAlign: 'left',
                }}
              >
                <Sparkles size={16} color="#0284c7" />
                <span>
                  <b>Strictly Grounded:</b> If a question asks about topics not in this course's syllabus, the tutor will inform you rather than hallucinate answers.
                </span>
              </div>
            </div>
          ) : (
            <>
              {messages.map((m) => {
                const insufficient = isInsufficientContext(m.text);
                return (
                  <div key={m.id} className={m.role === 'user' ? 'user-msg' : 'ai-msg'}>
                    {insufficient && (
                      <div
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          background: '#fffbeb',
                          border: '1px solid #fef3c7',
                          color: '#b45309',
                          padding: '4px 8px',
                          borderRadius: '6px',
                          fontSize: '11px',
                          fontWeight: 700,
                          marginBottom: '8px',
                        }}
                      >
                        <Info size={12} /> Out of Course Scope
                      </div>
                    )}

                    <div style={{ whiteSpace: 'pre-wrap', lineHeight: 1.6, fontSize: '14px' }}>
                      {m.text}
                    </div>

                    {m.sources && m.sources.length > 0 && (
                      <div className="sources" style={{ marginTop: '12px', paddingTop: '8px', borderTop: '1px solid rgba(0,0,0,0.06)' }}>
                        <b style={{ fontSize: '11px', color: '#64748b', display: 'block', marginBottom: '6px' }}>
                          Verified Curriculum Sources:
                        </b>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                          {m.sources.map((s, idx) => {
                            const title = s.title || `Lecture Source ${idx + 1}`;
                            return s.lecture_id ? (
                              <Link
                                key={idx}
                                to={`/courses/${selectedCourseId}?lectureId=${s.lecture_id}`}
                                className="source-tag"
                                style={{
                                  textDecoration: 'none',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '5px',
                                }}
                                title="Click to open this lecture"
                              >
                                <BookOpen size={11} />
                                <span>{title}</span>
                                <ExternalLink size={10} style={{ opacity: 0.6 }} />
                              </Link>
                            ) : (
                              <span key={idx} className="source-tag">
                                <BookOpen size={11} /> {title}
                              </span>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    <span className="chat-timestamp" style={{ fontSize: '10px', marginTop: '6px', display: 'block', opacity: 0.7 }}>
                      {m.timestamp}
                    </span>
                  </div>
                );
              })}

              {isAsking && (
                <div
                  className="chat-loading"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    fontSize: '13px',
                    color: '#0d9488',
                    padding: '8px 12px',
                    background: '#f0fdfa',
                    borderRadius: '8px',
                    width: 'fit-content',
                  }}
                >
                  <Loader2 size={16} className="chat-loading" />
                  <span>Searching course transcripts via pgvector & synthesizing answer...</span>
                </div>
              )}
            </>
          )}
        </div>

        {errorMessage && (
          <div
            style={{
              padding: '8px 16px',
              background: '#fef2f2',
              borderTop: '1px solid #fee2e2',
              color: '#dc2626',
              fontSize: '12px',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <AlertCircle size={14} />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Input Field */}
        <div
          className="ask"
          style={{
            padding: '16px 20px',
            borderTop: '1px solid #e2e8f0',
            background: '#f8fafc',
            display: 'flex',
            gap: '10px',
          }}
        >
          <input
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && askQuestion()}
            placeholder={`Ask a question about ${activeCourse?.title || 'the selected course'}...`}
            disabled={isAsking || !selectedCourseId}
            style={{
              flexGrow: 1,
              padding: '12px 16px',
              borderRadius: '10px',
              border: '1px solid #cbd5e1',
              fontSize: '14px',
              background: '#ffffff',
            }}
          />
          <button
            className="btn btn-primary"
            onClick={() => askQuestion()}
            disabled={isAsking || !question.trim() || !selectedCourseId}
            style={{ padding: '12px 20px', display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            {isAsking ? <Loader2 size={18} className="chat-loading" /> : <Send size={18} />}
          </button>
        </div>
      </div>
    </section>
  );
}
