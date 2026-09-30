import { useEffect, useState, useRef, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import {
  BookOpen,
  CheckCircle2,
  Circle,
  PlayCircle,
  ChevronLeft,
  ChevronRight,
  Send,
  Sparkles,
  ArrowLeft,
  AlertCircle,
  Loader2,
  Star,
  Clock,
  User,
  Check,
} from 'lucide-react';

type Lecture = {
  id: string;
  title: string;
  video_url?: string;
  transcript?: string;
  duration_seconds?: number;
  order_index: number;
  moduleTitle?: string;
};

type Module = {
  id: string;
  course_id: string;
  title: string;
  order_index: number;
  lectures: Lecture[];
};

type Course = {
  id: string;
  instructor_id: string;
  title: string;
  description: string;
  category: string;
  difficulty: string;
  thumbnail_url?: string;
  price: string | number;
  status: string;
  rating: string | number;
  instructor: string;
  modules: Module[];
};

type ChatMessage = {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  sources?: Array<{ lecture_id: string; chunk_id: string }>;
  timestamp: string;
};

export default function CourseDetails() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();

  const [course, setCourse] = useState<Course | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedLecture, setSelectedLecture] = useState<Lecture | null>(null);
  const [completedLectures, setCompletedLectures] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem(`vertexlearn_completed_${id}`);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [isEnrolled, setIsEnrolled] = useState(false);
  const [progressPercent, setProgressPercent] = useState<number>(0);
  const [isEnrolling, setIsEnrolling] = useState(false);
  const [isUpdatingProgress, setIsUpdatingProgress] = useState(false);

  // AI Tutor chat states
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [question, setQuestion] = useState('');
  const [mode, setMode] = useState('intermediate');
  const [isAsking, setIsAsking] = useState(false);
  const [askError, setAskError] = useState<string | null>(null);

  const chatBoxRef = useRef<HTMLDivElement>(null);

  // Auto-scroll chat box when new messages arrive or loading state changes
  useEffect(() => {
    if (chatBoxRef.current) {
      chatBoxRef.current.scrollTop = chatBoxRef.current.scrollHeight;
    }
  }, [messages, isAsking]);

  // Load course details and enrollment status
  useEffect(() => {
    if (!id) return;
    setLoading(true);
    setError(null);

    api
      .get(`/courses/${id}`)
      .then((r) => {
        setCourse(r.data);
        // Default selected lecture to the first lecture of the first module
        if (r.data.modules?.length > 0 && r.data.modules[0].lectures?.length > 0) {
          const firstLecture = r.data.modules[0].lectures[0];
          setSelectedLecture({
            ...firstLecture,
            moduleTitle: r.data.modules[0].title,
          });
        }
      })
      .catch((err) => {
        console.error('Failed to load course', err);
        setError(
          err.response?.data?.error?.message ||
            'Unable to load course details. Please verify the URL and try again.'
        );
      })
      .finally(() => setLoading(false));

    // Check enrollment for student
    if (user?.role === 'student') {
      checkEnrollment();
    }
  }, [id, user]);

  const checkEnrollment = async () => {
    try {
      const res = await api.get('/enrollments/me');
      const enrollment = res.data?.find((e: any) => e.course_id === id);
      if (enrollment) {
        setIsEnrolled(true);
        setProgressPercent(Number(enrollment.progress_percent || 0));
      } else {
        setIsEnrolled(false);
      }
    } catch (err) {
      console.error('Failed to fetch enrollment status', err);
    }
  };

  // Flatten all lectures across all modules for sequential navigation
  const allLectures: Lecture[] = useMemo(() => {
    if (!course?.modules) return [];
    return course.modules.flatMap((m) =>
      m.lectures.map((l) => ({
        ...l,
        moduleTitle: m.title,
      }))
    );
  }, [course]);

  const currentIndex = useMemo(() => {
    if (!selectedLecture) return -1;
    return allLectures.findIndex((l) => l.id === selectedLecture.id);
  }, [allLectures, selectedLecture]);

  const prevLecture = currentIndex > 0 ? allLectures[currentIndex - 1] : null;
  const nextLecture =
    currentIndex >= 0 && currentIndex < allLectures.length - 1
      ? allLectures[currentIndex + 1]
      : null;

  // Handle Enrollment
  const handleEnroll = async () => {
    if (!id || isEnrolling) return;
    setIsEnrolling(true);
    try {
      await api.post(`/courses/${id}/enroll`);
      setIsEnrolled(true);
      await checkEnrollment();
    } catch (err: any) {
      alert(err.response?.data?.error?.message || 'Enrollment failed. Please try again.');
    } finally {
      setIsEnrolling(false);
    }
  };

  // Toggle lecture completion
  const handleToggleComplete = async () => {
    if (!selectedLecture || isUpdatingProgress) return;
    const isCompleted = completedLectures.includes(selectedLecture.id);
    const nextCompleted = !isCompleted;
    setIsUpdatingProgress(true);

    try {
      await api.post(`/lectures/${selectedLecture.id}/progress`, {
        watched_seconds: selectedLecture.duration_seconds || 0,
        completed: nextCompleted,
      });

      const updated = nextCompleted
        ? [...completedLectures, selectedLecture.id]
        : completedLectures.filter((cid) => cid !== selectedLecture.id);

      setCompletedLectures(updated);
      try {
        localStorage.setItem(`vertexlearn_completed_${id}`, JSON.stringify(updated));
      } catch {
        // Ignore storage errors
      }

      // Refresh enrollment progress
      if (user?.role === 'student') {
        await checkEnrollment();
      }
    } catch (err) {
      console.error('Failed to update lecture progress', err);
      // Even if offline or not enrolled yet, update locally for interactive feel
      const updated = nextCompleted
        ? [...completedLectures, selectedLecture.id]
        : completedLectures.filter((cid) => cid !== selectedLecture.id);
      setCompletedLectures(updated);
    } finally {
      setIsUpdatingProgress(false);
    }
  };

  // Handle AI Tutor chat question
  async function ask(queryText?: string) {
    const textToSend = (queryText || question).trim();
    if (!textToSend || isAsking || !id) return;

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      text: textToSend,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setQuestion('');
    setIsAsking(true);
    setAskError(null);

    try {
      const r = await api.post('/ai/chat', {
        course_id: id,
        question: textToSend,
        mode,
      });

      const aiMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        text: r.data?.reply || 'No reply generated.',
        sources: r.data?.sources || [],
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages((prev) => [...prev, aiMsg]);
    } catch (err: any) {
      console.error('AI Tutor request failed', err);
      const errMsg =
        err.response?.data?.error?.message ||
        err.response?.data?.detail ||
        'Unable to reach AI Tutor. Please verify your connection or try again later.';
      setAskError(errMsg);
      setMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          text: `I encountered an issue retrieving an answer: ${errMsg}`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
    } finally {
      setIsAsking(false);
    }
  }

  // Quick suggestion chips
  const promptSuggestions = [
    'Summarize this course',
    'Explain key concepts simply',
    'What should I know before starting?',
    'Give me a practice quiz question',
  ];

  if (loading) {
    return <div className="loading">Loading course…</div>;
  }

  if (error || !course) {
    return (
      <section>
        <Link to="/courses" className="back-link">
          <ArrowLeft size={16} /> Back to Catalog
        </Link>
        <div className="error-card">
          <AlertCircle size={44} color="#b42f2f" style={{ margin: '0 auto' }} />
          <h2>Course Not Available</h2>
          <p>{error || 'The requested course could not be found.'}</p>
          <Link to="/courses" className="primary">
            Browse All Courses
          </Link>
        </div>
      </section>
    );
  }

  const isLectureCompleted = selectedLecture
    ? completedLectures.includes(selectedLecture.id)
    : false;

  return (
    <section>
      {/* Top Breadcrumb */}
      <Link to="/courses" className="back-link">
        <ArrowLeft size={16} /> Back to Courses
      </Link>

      {/* Course Header */}
      <header className="top">
        <div>
          <span className="eyebrow">COURSE PLAYER</span>
          <h1>{course.title}</h1>
          <p className="muted">{course.description}</p>
          <div className="course-header-meta">
            <span>
              <User size={14} /> {course.instructor || 'Instructor'}
            </span>
            <span>
              <Star size={14} fill="currentColor" color="#d28a00" /> {course.rating}
            </span>
            <span className="tag">{course.category}</span>
            <span className="tag">{course.difficulty}</span>
            <span>
              <Clock size={14} /> {allLectures.length} lessons
            </span>
          </div>
        </div>
      </header>

      {/* Enrollment & Progress Banner */}
      {user?.role === 'student' && (
        <div className="enroll-bar">
          <div className="enroll-bar-content">
            {isEnrolled ? (
              <>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <b>Your Learning Progress</b>
                  <span className="enroll-badge">
                    <Check size={14} /> Enrolled
                  </span>
                </div>
                <div className="progress">
                  <i style={{ width: `${progressPercent}%` }} />
                </div>
                <p>{progressPercent}% course completed</p>
              </>
            ) : (
              <>
                <b>Ready to start learning?</b>
                <p>Enroll now to track your progress, bookmark lectures, and complete quizzes.</p>
              </>
            )}
          </div>
          {!isEnrolled && (
            <button
              className="primary"
              onClick={handleEnroll}
              disabled={isEnrolling}
            >
              {isEnrolling ? 'Enrolling...' : 'Enroll in Course'}
            </button>
          )}
        </div>
      )}

      {/* Main 2-Column Course Layout */}
      <div className="course-layout">
        {/* Left Column: Player & Curriculum */}
        <div>
          {/* Active Lecture Player Card */}
          {selectedLecture && (
            <div className="lecture-player-card">
              <div className="player-screen">
                {selectedLecture.video_url ? (
                  selectedLecture.video_url.includes('youtube.com') ||
                  selectedLecture.video_url.includes('youtu.be') ? (
                    <iframe
                      className="video-frame"
                      src={
                        selectedLecture.video_url.includes('watch?v=')
                          ? selectedLecture.video_url.replace('watch?v=', 'embed/')
                          : selectedLecture.video_url
                      }
                      title={selectedLecture.title}
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                    />
                  ) : (
                    <video
                      className="video-frame"
                      controls
                      src={selectedLecture.video_url}
                    />
                  )
                ) : (
                  <div className="lesson-screen-placeholder">
                    <PlayCircle size={46} opacity={0.85} />
                    <h3>{selectedLecture.title}</h3>
                    <p>
                      {selectedLecture.moduleTitle
                        ? `${selectedLecture.moduleTitle} · `
                        : ''}
                      Interactive lesson content. Follow along with course notes and query the AI
                      Tutor for explanations on this material.
                    </p>
                  </div>
                )}
              </div>

              {/* Lecture Title & Controls */}
              <div className="player-toolbar">
                <div>
                  <h3 style={{ margin: '0 0 4px', fontSize: '17px' }}>
                    {selectedLecture.title}
                  </h3>
                  <small style={{ color: '#78859b' }}>
                    {selectedLecture.moduleTitle && `${selectedLecture.moduleTitle} • `}
                    {Math.round((selectedLecture.duration_seconds || 0) / 60)} min
                  </small>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <button
                    className={`btn-complete ${isLectureCompleted ? 'completed' : ''}`}
                    onClick={handleToggleComplete}
                    disabled={isUpdatingProgress}
                    title="Toggle lecture completion"
                  >
                    {isLectureCompleted ? (
                      <>
                        <Check size={14} /> Completed
                      </>
                    ) : (
                      <>
                        <Circle size={14} /> Mark as Complete
                      </>
                    )}
                  </button>

                  <div className="player-nav-btns">
                    <button
                      className="secondary"
                      onClick={() => prevLecture && setSelectedLecture(prevLecture)}
                      disabled={!prevLecture}
                      title="Previous lecture"
                    >
                      <ChevronLeft size={16} /> Prev
                    </button>
                    <button
                      className="secondary"
                      onClick={() => nextLecture && setSelectedLecture(nextLecture)}
                      disabled={!nextLecture}
                      title="Next lecture"
                    >
                      Next <ChevronRight size={16} />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Curriculum Panel */}
          <div className="panel">
            <div className="panel-head">
              <h2>
                <BookOpen size={18} /> Curriculum
              </h2>
              <span>
                {course.modules?.length || 0} modules • {allLectures.length} lessons
              </span>
            </div>

            {course.modules?.map((m) => (
              <div key={m.id} className="module">
                <b style={{ display: 'block', marginBottom: '8px' }}>{m.title}</b>
                {m.lectures?.map((l) => {
                  const isSelected = selectedLecture?.id === l.id;
                  const isDone = completedLectures.includes(l.id);
                  return (
                    <div
                      className={`lecture ${isSelected ? 'active' : ''}`}
                      key={l.id}
                      onClick={() =>
                        setSelectedLecture({
                          ...l,
                          moduleTitle: m.title,
                        })
                      }
                    >
                      {isDone ? (
                        <CheckCircle2 size={17} className="lecture-icon-completed" />
                      ) : (
                        <Circle size={17} className="lecture-icon-pending" />
                      )}
                      <span>{l.title}</span>
                      <small>{Math.round((l.duration_seconds || 0) / 60)} min</small>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>

        {/* Right Column: AI Tutor Panel */}
        <div className="panel tutor">
          <div className="panel-head">
            <div>
              <span className="eyebrow">AI TUTOR</span>
              <h2>
                <Sparkles size={18} /> Ask about this course
              </h2>
            </div>
            <select
              value={mode}
              onChange={(e) => setMode(e.target.value)}
              aria-label="Tutor explanation mode"
            >
              <option value="beginner">beginner</option>
              <option value="intermediate">intermediate</option>
              <option value="advanced">advanced</option>
            </select>
          </div>

          {/* Chat message stream */}
          <div className="chat-box" ref={chatBoxRef}>
            {messages.length === 0 ? (
              <div className="chat-empty">
                <Sparkles size={32} color="#1758a7" />
                <b>Course-grounded AI Tutor</b>
                <span>
                  Ask any question about this course. VertexLearn AI retrieves relevant course
                  material and provides sourced explanations.
                </span>

                {/* Prompt suggestion chips */}
                <div className="prompt-chips">
                  {promptSuggestions.map((promptText, i) => (
                    <button
                      key={i}
                      className="prompt-chip"
                      onClick={() => ask(promptText)}
                      disabled={isAsking}
                    >
                      {promptText}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <>
                {messages.map((m) => (
                  <div key={m.id} className={m.role === 'user' ? 'user-msg' : 'ai-msg'}>
                    <div>{m.text}</div>

                    {/* Sources citations */}
                    {m.sources && m.sources.length > 0 && (
                      <div className="sources" style={{ marginTop: '8px' }}>
                        <b>Sources:</b>
                        {m.sources.map((s, idx) => {
                          const matchedLecture = allLectures.find((l) => l.id === s.lecture_id);
                          return (
                            <span
                              key={idx}
                              className="source-tag"
                              title={
                                matchedLecture
                                  ? `Jump to ${matchedLecture.title}`
                                  : 'Referenced course material'
                              }
                              onClick={() => {
                                if (matchedLecture) {
                                  setSelectedLecture(matchedLecture);
                                }
                              }}
                            >
                              <BookOpen size={10} />
                              {matchedLecture
                                ? matchedLecture.title
                                : `Lecture ${s.lecture_id.slice(0, 8)}…`}
                            </span>
                          );
                        })}
                      </div>
                    )}
                    <span className="chat-timestamp">{m.timestamp}</span>
                  </div>
                ))}

                {/* Loading indicator */}
                {isAsking && (
                  <div className="chat-loading">
                    <Loader2 size={16} />
                    <span>VertexLearn AI is generating an answer…</span>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Question input form */}
          <div className="ask">
            <input
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && ask()}
              placeholder="e.g. Explain REST APIs and HTTP methods simply..."
              disabled={isAsking}
            />
            <button
              className="primary"
              onClick={() => ask()}
              disabled={isAsking || !question.trim()}
              title="Send question"
            >
              {isAsking ? <Loader2 size={16} className="chat-loading" /> : <Send size={16} />}
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
