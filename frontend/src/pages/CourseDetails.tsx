import { useEffect, useState, useRef, useMemo } from 'react';
import { useParams, Link, useSearchParams } from 'react-router-dom';
import { api, coursesApi, lecturesApi, aiApi } from '../services/api';
import { useAuth } from '../context/AuthContext';
import VideoPlayer from '../components/VideoPlayer';
import QuizPlayer from '../components/QuizPlayer';
import { DifficultyBadge } from '../components/Badge';
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
  ArrowRight,
  AlertCircle,
  Loader2,
  RefreshCw,
  Star,
  Clock,
  User,
  Check,
  Award,
  HelpCircle,
  ListChecks,
  FileText,
  Lightbulb,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Layers,
} from 'lucide-react';

export type QuickCheckItem = {
  question: string;
  options: string[];
  answer: number;
  explanation: string;
};

export type Lecture = {
  id: string;
  module_id: string;
  title: string;
  video_url?: string;
  transcript?: string;
  duration_seconds?: number;
  order_index: number;
  moduleTitle?: string;
  description?: string;
  learning_objectives?: string[];
  notes?: string;
  key_concepts?: string[];
  quick_check?: QuickCheckItem[];
  completed?: boolean;
};

export type QuizSummary = {
  id: string;
  title: string;
  description?: string;
  difficulty?: string;
  passing_score?: number;
  total_questions?: number;
};

export type Module = {
  id: string;
  course_id: string;
  title: string;
  order_index: number;
  lectures: Lecture[];
  quizzes?: QuizSummary[];
};

export type Course = {
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

export type ChatMessage = {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  sources?: Array<{ lecture_id: string; chunk_id: string }>;
  timestamp: string;
};

export default function CourseDetails() {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();

  const [course, setCourse] = useState<Course | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Active view: 'lesson' | 'quiz'
  const [activeView, setActiveView] = useState<'lesson' | 'quiz'>('lesson');
  const [activeQuizId, setActiveQuizId] = useState<string | null>(null);
  const [activeQuizTitle, setActiveQuizTitle] = useState<string>('');

  const [selectedLecture, setSelectedLecture] = useState<Lecture | null>(null);
  const [completedLectures, setCompletedLectures] = useState<Set<string>>(new Set());

  const [isEnrolled, setIsEnrolled] = useState(false);
  const [progressPercent, setProgressPercent] = useState<number>(0);
  const [isEnrolling, setIsEnrolling] = useState(false);
  const [isUpdatingProgress, setIsUpdatingProgress] = useState(false);

  // Quick check state for active lecture: index -> selected option index
  const [quickCheckAnswers, setQuickCheckAnswers] = useState<Record<number, number>>({});
  const [showQuickCheckExpl, setShowQuickCheckExpl] = useState<Record<number, boolean>>({});

  // AI Tutor chat states
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [question, setQuestion] = useState('');
  const [mode, setMode] = useState('intermediate');
  const [isAsking, setIsAsking] = useState(false);

  const chatBoxRef = useRef<HTMLDivElement>(null);

  // Summary state for active lecture
  const [lectureSummary, setLectureSummary] = useState<string>('');
  const [isSummaryCached, setIsSummaryCached] = useState<boolean>(false);
  const [isLoadingSummary, setIsLoadingSummary] = useState<boolean>(false);
  const [summaryError, setSummaryError] = useState<string | null>(null);
  const [showSummary, setShowSummary] = useState<boolean>(false);

  useEffect(() => {
    setLectureSummary('');
    setShowSummary(false);
    setSummaryError(null);
  }, [selectedLecture?.id]);

  const handleFetchOrGenerateSummary = async (regenerate: boolean = false) => {
    if (!selectedLecture?.id || isLoadingSummary) return;
    setIsLoadingSummary(true);
    setSummaryError(null);
    setShowSummary(true);
    try {
      const res = await lecturesApi.getSummary(selectedLecture.id, regenerate);
      setLectureSummary(res.data?.summary || '');
      setIsSummaryCached(!!res.data?.cached);
    } catch (err: any) {
      console.error('[AI Summary] Generation failed:', err.response?.status, err.response?.data || err.message);
      const serverMessage = err.response?.data?.error?.message || err.response?.data?.detail;
      const errorMsg =
        serverMessage ||
        (err.response?.status === 503
          ? 'AI service is not configured. Add the required AI provider API key (ANTHROPIC_API_KEY) to the environment configuration.'
          : err.response?.status === 400
          ? 'This lecture does not have transcript content available for summarization.'
          : 'Failed to generate summary. Please try again.');
      setSummaryError(errorMsg);
    } finally {
      setIsLoadingSummary(false);
    }
  };

  const [isGeneratingLectureQuiz, setIsGeneratingLectureQuiz] = useState<boolean>(false);
  const [quizGenError, setQuizGenError] = useState<string | null>(null);
  const handleGenerateLectureQuiz = async () => {
    if (!selectedLecture?.id || isGeneratingLectureQuiz) return;
    setIsGeneratingLectureQuiz(true);
    setQuizGenError(null);
    try {
      const res = await aiApi.generateQuiz({
        course_id: id,
        lecture_id: selectedLecture.id,
        number_of_questions: 5,
      });
      const generatedQuizId = res.data?.quiz_id;
      const generatedTitle = res.data?.title || `AI Quiz: ${selectedLecture.title}`;
      if (generatedQuizId) {
        handleOpenQuiz(generatedQuizId, generatedTitle);
      }
    } catch (err: any) {
      console.error('[AI Quiz] Generation failed:', err.response?.status, err.response?.data || err.message);
      const serverMessage = err.response?.data?.error?.message || err.response?.data?.detail;
      const errorMsg =
        serverMessage ||
        (err.response?.status === 503
          ? 'AI service is not configured. Add the required AI provider API key (ANTHROPIC_API_KEY) to the environment configuration.'
          : 'Failed to generate quiz. Please try again.');
      setQuizGenError(errorMsg);
    } finally {
      setIsGeneratingLectureQuiz(false);
    }
  };

  // Auto-scroll chat box when new messages arrive
  useEffect(() => {
    if (chatBoxRef.current) {
      chatBoxRef.current.scrollTop = chatBoxRef.current.scrollHeight;
    }
  }, [messages, isAsking]);

  // Load course details
  const fetchCourseData = async () => {
    if (!id) return;
    try {
      const res = await api.get(`/courses/${id}`);
      const courseData: Course = res.data;
      setCourse(courseData);

      // Collect completed lectures from lectures data
      const completedSet = new Set<string>();
      courseData.modules?.forEach((m) => {
        m.lectures?.forEach((l) => {
          if (l.completed) completedSet.add(l.id);
        });
      });
      setCompletedLectures(completedSet);

      // Handle default selected lecture
      const allL = courseData.modules?.flatMap((m) =>
        m.lectures.map((l) => ({ ...l, moduleTitle: m.title }))
      ) || [];

      const queryLectureId = searchParams.get('lecture');
      if (queryLectureId) {
        const found = allL.find((l) => l.id === queryLectureId);
        if (found) {
          setSelectedLecture(found);
        } else if (allL.length > 0) {
          setSelectedLecture(allL[0]);
        }
      } else if (!selectedLecture && allL.length > 0) {
        // Try to pick first uncompleted lecture or first lecture
        const firstUncompleted = allL.find((l) => !completedSet.has(l.id)) || allL[0];
        setSelectedLecture(firstUncompleted);
      }
    } catch (err: any) {
      console.error('Failed to load course', err);
      setError(err.response?.data?.error?.message || 'Unable to load course details.');
    } finally {
      setLoading(false);
    }
  };

  const checkEnrollmentStatus = async () => {
    try {
      const res = await api.get('/enrollments/me');
      const enrollment = res.data?.find((e: any) => e.course_id === id);
      if (enrollment) {
        setIsEnrolled(true);
        setProgressPercent(Number(enrollment.progress_percent || 0));
      } else {
        setIsEnrolled(false);
      }
    } catch {
      // Ignore auth or network errors on check
    }
  };

  useEffect(() => {
    setLoading(true);
    setError(null);
    fetchCourseData();
    if (user?.role === 'student') {
      checkEnrollmentStatus();
    }
  }, [id, user]);

  // Reset quick check answers when lecture changes
  useEffect(() => {
    setQuickCheckAnswers({});
    setShowQuickCheckExpl({});
  }, [selectedLecture?.id]);

  // Flatten all lectures for sequential navigation
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

  // Find module for active lecture to check if module has a quiz
  const currentModule = useMemo(() => {
    if (!course?.modules || !selectedLecture) return null;
    return course.modules.find((m) => m.id === selectedLecture.module_id) || null;
  }, [course, selectedLecture]);

  // Handle Enrollment
  const handleEnroll = async () => {
    if (!id || isEnrolling) return;
    setIsEnrolling(true);
    try {
      await coursesApi.enroll(id);
      setIsEnrolled(true);
      await checkEnrollmentStatus();
      await fetchCourseData();
    } catch (err: any) {
      alert(err.response?.data?.error?.message || 'Enrollment failed. Please try again.');
    } finally {
      setIsEnrolling(false);
    }
  };

  // Toggle lecture completion
  const handleToggleComplete = async () => {
    if (!selectedLecture || isUpdatingProgress) return;
    const isCompleted = completedLectures.has(selectedLecture.id);
    const nextCompleted = !isCompleted;
    setIsUpdatingProgress(true);

    try {
      const res = await api.post(`/lectures/${selectedLecture.id}/progress`, {
        watched_seconds: selectedLecture.duration_seconds || 0,
        completed: nextCompleted,
      });

      // Update state immediately
      setCompletedLectures((prev) => {
        const next = new Set(prev);
        if (nextCompleted) next.add(selectedLecture.id);
        else next.delete(selectedLecture.id);
        return next;
      });

      if (res.data?.progress_percent !== undefined) {
        setProgressPercent(res.data.progress_percent);
      } else {
        await checkEnrollmentStatus();
      }
    } catch (err: any) {
      console.error('Failed to update lecture progress', err);
      // Fallback local update
      setCompletedLectures((prev) => {
        const next = new Set(prev);
        if (nextCompleted) next.add(selectedLecture.id);
        else next.delete(selectedLecture.id);
        return next;
      });
    } finally {
      setIsUpdatingProgress(false);
    }
  };

  // Handle AI Tutor question
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

    try {
      const r = await api.post('/ai/chat', {
        course_id: id,
        question: textToSend,
        mode,
      });

      const aiMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        text: r.data?.reply || 'No answer generated.',
        sources: r.data?.sources || [],
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages((prev) => [...prev, aiMsg]);
    } catch (err: any) {
      console.error('[AI Tutor] Request failed:', err.response?.status, err.response?.data || err.message);
      const serverMessage = err.response?.data?.error?.message || err.response?.data?.detail;
      const errorMsg =
        serverMessage ||
        (err.response?.status === 503
          ? 'AI service is not configured. Add the required AI provider API key to the environment configuration.'
          : err.response?.status === 401
          ? 'Please log in to chat with the AI Tutor.'
          : 'AI Tutor is temporarily unavailable. Please verify your connection or try again in a moment.');
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

  // Quick action suggestions
  const handleQuickAction = (action: string) => {
    const lectureTitle = selectedLecture?.title || course?.title || 'this topic';
    switch (action) {
      case 'explain':
        ask(`Explain ${lectureTitle} simply with an everyday analogy.`);
        break;
      case 'example':
        ask(`Give me a practical code example for ${lectureTitle}.`);
        break;
      case 'summarize':
        ask(`Summarize the core takeaways of ${lectureTitle}.`);
        break;
      case 'quiz_me':
        ask(`Quiz me on ${lectureTitle} with a multiple-choice question.`);
        break;
      case 'interview':
        ask(`What is a common technical interview question regarding ${lectureTitle}?`);
        break;
      default:
        ask(action);
    }
  };

  const handleOpenQuiz = (quizId: string, quizTitle: string) => {
    setActiveQuizId(quizId);
    setActiveQuizTitle(quizTitle);
    setActiveView('quiz');
  };

  if (loading) {
    return <div className="loading">Loading VertexLearn Course...</div>;
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
    ? completedLectures.has(selectedLecture.id)
    : false;

  return (
    <section>
      {/* Top Breadcrumb & Course Header */}
      <Link to="/courses" className="back-link" style={{ marginBottom: '14px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
        <ArrowLeft size={16} /> Back to Courses Catalog
      </Link>

      <header className="top" style={{ marginBottom: '20px' }}>
        <div>
          <span className="eyebrow">COURSE LEARNING EXPERIENCE</span>
          <h1 style={{ margin: '4px 0 8px' }}>{course.title}</h1>
          <p className="muted" style={{ margin: '0 0 12px', maxWidth: '800px', lineHeight: 1.5 }}>
            {course.description}
          </p>
          <div className="course-header-meta" style={{ display: 'flex', flexWrap: 'wrap', gap: '14px', alignItems: 'center' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
              <User size={14} /> {course.instructor || 'Instructor'}
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
              <Star size={14} fill="currentColor" color="#d97706" /> {course.rating}
            </span>
            <span className="tag">{course.category}</span>
            <DifficultyBadge difficulty={course.difficulty} />
            <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
              <Clock size={14} /> {allLectures.length} lessons
            </span>
          </div>
        </div>
      </header>

      {/* Student Enrollment Progress Banner */}
      {user?.role === 'student' && (
        <div
          className="enroll-bar"
          style={{
            background: isEnrolled ? '#ffffff' : '#f0f9ff',
            border: isEnrolled ? '1px solid #e2e8f0' : '1px solid #bae6fd',
            borderRadius: '14px',
            padding: '16px 20px',
            marginBottom: '24px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '16px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
          }}
        >
          <div style={{ flex: '1 1 300px' }}>
            {isEnrolled ? (
              <>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '13px', fontWeight: 700, color: '#0f172a' }}>
                      Your Course Progress
                    </span>
                    <span style={{ fontSize: '11px', fontWeight: 700, background: '#dcfce7', color: '#15803d', padding: '2px 8px', borderRadius: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <Check size={12} /> Enrolled
                    </span>
                  </div>
                  <span style={{ fontSize: '13px', fontWeight: 800, color: '#0d9488' }}>
                    {progressPercent}% Complete ({completedLectures.size} / {allLectures.length} lessons)
                  </span>
                </div>
                <div className="progress" style={{ height: '8px' }}>
                  <i style={{ width: `${progressPercent}%`, backgroundColor: '#0d9488' }} />
                </div>
              </>
            ) : (
              <div>
                <b style={{ fontSize: '14px', color: '#0369a1' }}>Ready to start learning?</b>
                <p style={{ fontSize: '12px', color: '#64748b', margin: '4px 0 0' }}>
                  Enroll now to track lesson completions, take module quizzes, and view progress on your dashboard.
                </p>
              </div>
            )}
          </div>

          {!isEnrolled && (
            <button
              className="btn btn-primary"
              onClick={handleEnroll}
              disabled={isEnrolling}
            >
              {isEnrolling ? 'Enrolling...' : 'Enroll Free in Course'}
            </button>
          )}
        </div>
      )}

      {/* Main 3-Column Responsive Course Player Grid */}
      <div className="course-layout" style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: '24px', alignItems: 'start' }}>
        {/* Left / Center Area: Video Player, Quiz Player & Structured Learning Materials */}
        <div>
          {activeView === 'quiz' && activeQuizId ? (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={() => setActiveView('lesson')}
                >
                  <ArrowLeft size={14} /> Back to Lesson
                </button>
                <span style={{ fontSize: '13px', color: '#64748b' }}>
                  Taking Quiz: <b>{activeQuizTitle}</b>
                </span>
              </div>
              <QuizPlayer
                quizId={activeQuizId}
                quizTitle={activeQuizTitle}
                onComplete={() => {
                  fetchCourseData();
                  checkEnrollmentStatus();
                }}
                onClose={() => setActiveView('lesson')}
              />
            </div>
          ) : selectedLecture ? (
            <div>
              {/* Reusable Video Player */}
              <VideoPlayer
                title={selectedLecture.title}
                videoUrl={selectedLecture.video_url}
                durationSeconds={selectedLecture.duration_seconds}
                moduleTitle={selectedLecture.moduleTitle}
                isCompleted={isLectureCompleted}
                isUpdatingProgress={isUpdatingProgress}
                onToggleComplete={handleToggleComplete}
                onPrev={() => prevLecture && setSelectedLecture(prevLecture)}
                onNext={() => nextLecture && setSelectedLecture(nextLecture)}
                hasPrev={!!prevLecture}
                hasNext={!!nextLecture}
              />

              {/* Module Quiz Shortcut if module has a quiz */}
              {currentModule?.quizzes && currentModule.quizzes.length > 0 ? (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '14px 20px',
                    borderRadius: '12px',
                    background: 'linear-gradient(135deg, #eff6ff, #f0fdf4)',
                    border: '1px solid #bfdbfe',
                    marginBottom: '24px',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: '#2563eb', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Award size={18} />
                    </div>
                    <div>
                      <b style={{ fontSize: '14px', color: '#0f172a' }}>
                        {currentModule.quizzes[0].title}
                      </b>
                      <p style={{ margin: 0, fontSize: '12px', color: '#64748b' }}>
                        Test your retention of {currentModule.title}. ({currentModule.quizzes[0].total_questions || 3} questions)
                      </p>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Link
                      to={`/flashcards?course_id=${course.id}&lecture_id=${selectedLecture.id}`}
                      className="btn btn-secondary btn-sm"
                      style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                    >
                      <Layers size={13} /> Flashcards
                    </Link>
                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={handleGenerateLectureQuiz}
                      disabled={isGeneratingLectureQuiz}
                      style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                    >
                      {isGeneratingLectureQuiz ? <Loader2 size={13} className="chat-loading" /> : <Sparkles size={13} />}
                      {isGeneratingLectureQuiz ? 'Generating AI Quiz...' : 'Generate AI Quiz'}
                    </button>
                    <button
                      className="btn btn-primary btn-sm"
                      onClick={() => handleOpenQuiz(currentModule.quizzes![0].id, currentModule.quizzes![0].title)}
                    >
                      Take Quiz <ArrowRight size={14} />
                    </button>
                  </div>
                </div>
              ) : (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '12px 20px',
                    borderRadius: '12px',
                    background: '#f5f3ff',
                    border: '1px solid #ddd6fe',
                    marginBottom: '24px',
                    flexWrap: 'wrap',
                    gap: '12px',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <Sparkles size={18} color="#7c3aed" />
                    <div>
                      <b style={{ fontSize: '13px', color: '#0f172a' }}>Test your retention of this lesson</b>
                      <p style={{ margin: 0, fontSize: '11px', color: '#64748b' }}>
                        Generate a 5-question AI quiz or practice interactive 3D flashcards.
                      </p>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Link
                      to={`/flashcards?course_id=${course.id}&lecture_id=${selectedLecture.id}`}
                      className="btn btn-secondary btn-sm"
                      style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                    >
                      <Layers size={13} /> Flashcards
                    </Link>
                    <button
                      className="btn btn-primary btn-sm"
                      onClick={handleGenerateLectureQuiz}
                      disabled={isGeneratingLectureQuiz}
                      style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: '#7c3aed', borderColor: '#7c3aed' }}
                    >
                      {isGeneratingLectureQuiz ? <Loader2 size={13} className="chat-loading" /> : <Sparkles size={13} />}
                      {isGeneratingLectureQuiz ? 'Generating AI Quiz...' : 'Generate AI Quiz'}
                    </button>
                  </div>
                  {quizGenError && (
                    <div style={{ width: '100%', marginTop: '8px', padding: '8px 12px', background: '#fef2f2', border: '1px solid #fee2e2', borderRadius: '8px', color: '#dc2626', fontSize: '12px' }}>
                      {quizGenError}
                    </div>
                  )}
                </div>
              )}

              {/* Concise AI Summary Section */}
              <div
                style={{
                  borderRadius: '14px',
                  border: '1px solid #e2e8f0',
                  background: '#ffffff',
                  padding: '18px 22px',
                  marginBottom: '24px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: '#fef3c7', color: '#d97706', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Sparkles size={18} />
                    </div>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <b style={{ fontSize: '15px', color: '#0f172a' }}>Concise AI Summary</b>
                        {isSummaryCached && showSummary && (
                          <span style={{ fontSize: '10px', fontWeight: 700, background: '#f0fdf4', color: '#16a34a', padding: '1px 6px', borderRadius: '8px', border: '1px solid #bbf7d0' }}>
                            Saved in Course
                          </span>
                        )}
                      </div>
                      <p style={{ margin: 0, fontSize: '12px', color: '#64748b' }}>
                        5-point synthesis: Overview, Key Concepts, Important Points, Definitions & Revision.
                      </p>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {showSummary && lectureSummary ? (
                      <>
                        <button
                          className="btn btn-secondary btn-sm"
                          onClick={() => handleFetchOrGenerateSummary(true)}
                          disabled={isLoadingSummary}
                          style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                        >
                          <RefreshCw size={13} className={isLoadingSummary ? 'chat-loading' : ''} />
                          {isLoadingSummary ? 'Regenerating...' : 'Regenerate'}
                        </button>
                        <button
                          className="btn btn-secondary btn-sm"
                          onClick={() => setShowSummary(false)}
                        >
                          Hide
                        </button>
                      </>
                    ) : (
                      <button
                        className="btn btn-teal btn-sm"
                        onClick={() => handleFetchOrGenerateSummary(false)}
                        disabled={isLoadingSummary}
                        style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                      >
                        {isLoadingSummary ? <Loader2 size={14} className="chat-loading" /> : <Sparkles size={14} />}
                        {isLoadingSummary ? 'Generating summary...' : 'Generate Summary'}
                      </button>
                    )}
                  </div>
                </div>

                {showSummary && (
                  <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid #f1f5f9' }}>
                    {isLoadingSummary ? (
                      <div style={{ padding: '24px', textAlign: 'center', color: '#0d9488' }}>
                        <Loader2 size={24} className="chat-loading" style={{ margin: '0 auto 8px' }} />
                        <p style={{ fontSize: '13px', fontWeight: 600 }}>Generating summary...</p>
                        <span style={{ fontSize: '12px', color: '#64748b' }}>
                          Extracting key concepts, definitions, and exam takeaways from transcript...
                        </span>
                      </div>
                    ) : summaryError ? (
                      <div style={{ padding: '14px 18px', background: '#fef2f2', border: '1px solid #fee2e2', borderRadius: '10px', color: '#dc2626', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span style={{ fontSize: '13px' }}>{summaryError}</span>
                        <button className="btn btn-primary btn-sm" onClick={() => handleFetchOrGenerateSummary(false)}>
                          Retry
                        </button>
                      </div>
                    ) : lectureSummary ? (
                      <div
                        style={{
                          whiteSpace: 'pre-wrap',
                          lineHeight: 1.7,
                          fontSize: '14px',
                          color: '#334155',
                          background: '#f8fafc',
                          padding: '18px 20px',
                          borderRadius: '10px',
                          border: '1px solid #e2e8f0',
                        }}
                      >
                        {lectureSummary}
                      </div>
                    ) : null}
                  </div>
                )}
              </div>

              {/* Comprehensive Structured Learning Materials Section */}
              <div className="panel" style={{ borderRadius: '16px', border: '1px solid #e2e8f0', background: '#ffffff', padding: '28px', marginBottom: '24px' }}>
                {/* 1. ABOUT THIS LESSON */}
                <section style={{ marginBottom: '28px' }}>
                  <h3 style={{ fontSize: '13px', fontWeight: 800, color: '#2563eb', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <FileText size={16} /> About This Lesson
                  </h3>
                  <p style={{ fontSize: '14px', color: '#334155', lineHeight: 1.6, margin: 0 }}>
                    {selectedLecture.description ||
                      'In this class, you will explore core design principles, practical implementation workflows, and architectural best practices.'}
                  </p>
                </section>

                {/* 2. LEARNING OBJECTIVES */}
                {selectedLecture.learning_objectives && selectedLecture.learning_objectives.length > 0 && (
                  <section style={{ marginBottom: '28px', background: '#f8fafc', padding: '18px 20px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                    <h3 style={{ fontSize: '13px', fontWeight: 800, color: '#0f172a', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <ListChecks size={16} color="#0d9488" /> Learning Objectives
                    </h3>
                    <p style={{ fontSize: '12px', color: '#64748b', marginBottom: '10px' }}>
                      By the end of this lesson, you will be able to:
                    </p>
                    <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {selectedLecture.learning_objectives.map((obj, i) => (
                        <li key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', fontSize: '13px', color: '#334155' }}>
                          <CheckCircle2 size={16} color="#0d9488" style={{ flexShrink: 0, marginTop: '2px' }} />
                          <span>{obj}</span>
                        </li>
                      ))}
                    </ul>
                  </section>
                )}

                {/* 3. LESSON NOTES */}
                <section style={{ marginBottom: '28px' }}>
                  <h3 style={{ fontSize: '13px', fontWeight: 800, color: '#0f172a', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <BookOpen size={16} color="#2563eb" /> Lesson Notes & Deep Dive
                  </h3>
                  <div
                    style={{
                      fontSize: '14px',
                      color: '#334155',
                      lineHeight: 1.7,
                      whiteSpace: 'pre-wrap',
                      background: '#ffffff',
                    }}
                  >
                    {selectedLecture.notes || selectedLecture.transcript || 'Review the lecture video and query the AI Tutor for in-depth explanations on this topic.'}
                  </div>
                </section>

                {/* 4. KEY CONCEPTS */}
                {selectedLecture.key_concepts && selectedLecture.key_concepts.length > 0 && (
                  <section style={{ marginBottom: '28px' }}>
                    <h3 style={{ fontSize: '13px', fontWeight: 800, color: '#0f172a', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Lightbulb size={16} color="#f59e0b" /> Key Concepts
                    </h3>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                      {selectedLecture.key_concepts.map((concept, idx) => (
                        <span
                          key={idx}
                          style={{
                            padding: '6px 12px',
                            borderRadius: '8px',
                            background: '#f1f5f9',
                            border: '1px solid #cbd5e1',
                            fontSize: '12px',
                            fontWeight: 600,
                            color: '#1e293b',
                          }}
                        >
                          {concept}
                        </span>
                      ))}
                    </div>
                  </section>
                )}

                {/* 5. QUICK CHECK */}
                {selectedLecture.quick_check && selectedLecture.quick_check.length > 0 && (
                  <section style={{ marginBottom: '28px', borderTop: '1px solid #e2e8f0', paddingTop: '24px' }}>
                    <h3 style={{ fontSize: '13px', fontWeight: 800, color: '#0d9488', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <CheckCircle2 size={16} /> Quick Understanding Check
                    </h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                      {selectedLecture.quick_check.map((qc, qIdx) => {
                        const userChoice = quickCheckAnswers[qIdx];
                        const hasAnswered = userChoice !== undefined;
                        const isCorrect = userChoice === qc.answer;

                        return (
                          <div
                            key={qIdx}
                            style={{
                              padding: '16px 20px',
                              borderRadius: '12px',
                              background: '#f8fafc',
                              border: '1px solid #e2e8f0',
                            }}
                          >
                            <p style={{ fontWeight: 700, fontSize: '14px', margin: '0 0 12px', color: '#0f172a' }}>
                              {qIdx + 1}. {qc.question}
                            </p>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                              {qc.options.map((optText, oIdx) => {
                                const isSelected = userChoice === oIdx;
                                let optBg = '#ffffff';
                                let optBorder = '#cbd5e1';

                                if (hasAnswered) {
                                  if (oIdx === qc.answer) {
                                    optBg = '#dcfce7';
                                    optBorder = '#86efac';
                                  } else if (isSelected && !isCorrect) {
                                    optBg = '#fee2e2';
                                    optBorder = '#fca5a5';
                                  }
                                }

                                return (
                                  <button
                                    key={oIdx}
                                    type="button"
                                    onClick={() => {
                                      setQuickCheckAnswers((p) => ({ ...p, [qIdx]: oIdx }));
                                      setShowQuickCheckExpl((p) => ({ ...p, [qIdx]: true }));
                                    }}
                                    style={{
                                      textAlign: 'left',
                                      padding: '10px 14px',
                                      borderRadius: '8px',
                                      background: optBg,
                                      border: `1px solid ${optBorder}`,
                                      fontSize: '13px',
                                      fontWeight: isSelected ? 600 : 400,
                                      cursor: 'pointer',
                                      transition: 'all 0.15s ease',
                                    }}
                                  >
                                    {String.fromCharCode(65 + oIdx)}. {optText}
                                  </button>
                                );
                              })}
                            </div>

                            {/* Explanation reveal */}
                            {showQuickCheckExpl[qIdx] && (
                              <div
                                style={{
                                  marginTop: '12px',
                                  padding: '10px 14px',
                                  borderRadius: '8px',
                                  background: isCorrect ? '#ecfdf5' : '#fffbeb',
                                  border: isCorrect ? '1px solid #a7f3d0' : '1px solid #fde68a',
                                  fontSize: '12px',
                                  color: '#334155',
                                }}
                              >
                                <b>{isCorrect ? '✓ Correct!' : '✗ Not quite.'}</b> {qc.explanation}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </section>
                )}

                {/* Lesson Navigation Footer */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #e2e8f0', paddingTop: '20px', flexWrap: 'wrap', gap: '10px' }}>
                  <button
                    className="btn btn-secondary"
                    onClick={() => prevLecture && setSelectedLecture(prevLecture)}
                    disabled={!prevLecture}
                  >
                    <ChevronLeft size={16} /> Previous Lesson
                  </button>

                  <button
                    className={`btn ${isLectureCompleted ? 'btn-teal' : 'btn-primary'}`}
                    onClick={handleToggleComplete}
                    disabled={isUpdatingProgress}
                  >
                    {isLectureCompleted ? <Check size={16} /> : <Circle size={16} />}
                    {isLectureCompleted ? 'Completed — Click to Reopen' : 'Mark Lesson Complete'}
                  </button>

                  <button
                    className="btn btn-secondary"
                    onClick={() => nextLecture && setSelectedLecture(nextLecture)}
                    disabled={!nextLecture}
                  >
                    Next Lesson <ChevronRight size={16} />
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="panel" style={{ padding: '40px', textAlign: 'center' }}>
              <PlayCircle size={44} color="#94a3b8" style={{ margin: '0 auto 12px' }} />
              <h3>Select a lesson from the curriculum</h3>
              <p style={{ color: '#64748b', fontSize: '13px' }}>
                Choose any lesson from the sidebar to start streaming classes and reviewing material.
              </p>
            </div>
          )}

          {/* Curriculum Accordion Panel */}
          <div className="panel" style={{ borderRadius: '16px', border: '1px solid #e2e8f0', background: '#ffffff', padding: '24px' }}>
            <div className="panel-head" style={{ marginBottom: '16px' }}>
              <h2 style={{ fontSize: '16px', fontWeight: 700, margin: 0 }}>
                <BookOpen size={18} /> Course Curriculum
              </h2>
              <span style={{ fontSize: '12px', color: '#64748b' }}>
                {course.modules?.length || 0} modules • {allLectures.length} lessons
              </span>
            </div>

            {course.modules?.map((m, mIdx) => (
              <div key={m.id} style={{ marginBottom: '18px', border: '1px solid #f1f5f9', borderRadius: '12px', padding: '14px', background: '#fafbfc' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                  <b style={{ fontSize: '14px', color: '#0f172a' }}>
                    {m.title}
                  </b>
                  <span style={{ fontSize: '11px', color: '#64748b' }}>
                    {m.lectures?.length || 0} lessons
                  </span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {m.lectures?.map((l) => {
                    const isSelected = selectedLecture?.id === l.id && activeView === 'lesson';
                    const isDone = completedLectures.has(l.id);

                    return (
                      <div
                        key={l.id}
                        className={`lecture ${isSelected ? 'active' : ''}`}
                        onClick={() => {
                          setSelectedLecture({
                            ...l,
                            moduleTitle: m.title,
                          });
                          setActiveView('lesson');
                        }}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '10px',
                          padding: '10px 12px',
                          borderRadius: '8px',
                          background: isSelected ? '#eff6ff' : '#ffffff',
                          border: isSelected ? '1px solid #3b82f6' : '1px solid #e2e8f0',
                          cursor: 'pointer',
                          transition: 'all 0.15s ease',
                        }}
                      >
                        {isDone ? (
                          <CheckCircle2 size={16} color="#16a34a" style={{ flexShrink: 0 }} />
                        ) : (
                          <Circle size={16} color="#94a3b8" style={{ flexShrink: 0 }} />
                        )}
                        <span style={{ flexGrow: 1, fontSize: '13px', fontWeight: isSelected ? 600 : 400, color: '#1e293b' }}>
                          {l.title}
                        </span>
                        <small style={{ color: '#64748b', fontSize: '11px' }}>
                          {Math.round((l.duration_seconds || 0) / 60)} min
                        </small>
                      </div>
                    );
                  })}

                  {/* Quizzes attached to module */}
                  {m.quizzes?.map((qz) => (
                    <div
                      key={qz.id}
                      onClick={() => handleOpenQuiz(qz.id, qz.title)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px',
                        padding: '10px 12px',
                        borderRadius: '8px',
                        background: activeView === 'quiz' && activeQuizId === qz.id ? '#f0fdf4' : '#fffbeb',
                        border: activeView === 'quiz' && activeQuizId === qz.id ? '1px solid #10b981' : '1px solid #fde68a',
                        cursor: 'pointer',
                        marginTop: '4px',
                      }}
                    >
                      <Award size={16} color="#d97706" style={{ flexShrink: 0 }} />
                      <span style={{ flexGrow: 1, fontSize: '13px', fontWeight: 600, color: '#92400e' }}>
                        {qz.title}
                      </span>
                      <span style={{ fontSize: '11px', background: '#fef3c7', color: '#b45309', padding: '2px 6px', borderRadius: '4px' }}>
                        Quiz ({qz.total_questions || 3} Qs)
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right Column: AI Tutor Panel */}
        <div
          className="panel tutor"
          style={{
            position: 'sticky',
            top: '80px',
            borderRadius: '16px',
            border: '1px solid #e2e8f0',
            background: '#ffffff',
            display: 'flex',
            flexDirection: 'column',
            height: 'calc(100vh - 100px)',
            maxHeight: '800px',
            padding: 0,
            overflow: 'hidden',
          }}
        >
          {/* AI Header */}
          <div
            style={{
              padding: '16px 20px',
              borderBottom: '1px solid #e2e8f0',
              background: '#091e42',
              color: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Sparkles size={16} color="#2dd4bf" />
                <span style={{ fontSize: '11px', fontWeight: 700, color: '#2dd4bf', letterSpacing: '0.05em' }}>
                  VERTEXLEARN AI
                </span>
              </div>
              <h3 style={{ fontSize: '15px', fontWeight: 800, margin: '2px 0 0', color: '#ffffff' }}>
                AI Learning Copilot
              </h3>
            </div>

            {/* Mode Selector */}
            <select
              value={mode}
              onChange={(e) => setMode(e.target.value)}
              style={{
                fontSize: '11px',
                padding: '4px 8px',
                borderRadius: '6px',
                background: '#132e5d',
                color: '#ffffff',
                border: '1px solid rgba(255,255,255,0.2)',
                fontWeight: 600,
              }}
              aria-label="Tutor explanation mode"
            >
              <option value="beginner">Beginner</option>
              <option value="intermediate">Intermediate</option>
              <option value="advanced">Advanced</option>
            </select>
          </div>

          {/* Quick Action Chips Bar */}
          <div
            style={{
              display: 'flex',
              gap: '6px',
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
              style={{ fontSize: '11px', padding: '4px 8px' }}
              onClick={() => handleQuickAction('explain')}
              disabled={isAsking}
            >
              💡 Explain Simply
            </button>
            <button
              type="button"
              className="prompt-chip"
              style={{ fontSize: '11px', padding: '4px 8px' }}
              onClick={() => handleQuickAction('example')}
              disabled={isAsking}
            >
              💻 Example
            </button>
            <button
              type="button"
              className="prompt-chip"
              style={{ fontSize: '11px', padding: '4px 8px' }}
              onClick={() => handleQuickAction('summarize')}
              disabled={isAsking}
            >
              📝 Summarize
            </button>
            <button
              type="button"
              className="prompt-chip"
              style={{ fontSize: '11px', padding: '4px 8px' }}
              onClick={() => handleQuickAction('quiz_me')}
              disabled={isAsking}
            >
              🎯 Quiz Me
            </button>
            <button
              type="button"
              className="prompt-chip"
              style={{ fontSize: '11px', padding: '4px 8px' }}
              onClick={() => handleQuickAction('interview')}
              disabled={isAsking}
            >
              💼 Interview Q
            </button>
          </div>

          {/* Chat message stream */}
          <div
            className="chat-box"
            ref={chatBoxRef}
            style={{
              flexGrow: 1,
              overflowY: 'auto',
              padding: '16px',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
            }}
          >
            {messages.length === 0 ? (
              <div className="chat-empty" style={{ textAlign: 'center', padding: '32px 16px', color: '#64748b' }}>
                <Sparkles size={36} color="#0d9488" style={{ margin: '0 auto 10px' }} />
                <b style={{ display: 'block', fontSize: '14px', color: '#0f172a', marginBottom: '6px' }}>
                  Grounded AI Tutor Ready
                </b>
                <span style={{ fontSize: '12px', lineHeight: 1.5, display: 'block', marginBottom: '16px' }}>
                  Ask questions about this lecture or click a prompt below. VertexLearn AI searches course transcripts and notes to formulate sourced responses.
                </span>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <button
                    className="prompt-chip"
                    onClick={() => ask('What is REST API? Explain it simply.')}
                    disabled={isAsking}
                    style={{ textAlign: 'left', fontSize: '12px' }}
                  >
                    "What is REST API? Explain it simply."
                  </button>
                  <button
                    className="prompt-chip"
                    onClick={() => ask('What is the difference between GET and POST?')}
                    disabled={isAsking}
                    style={{ textAlign: 'left', fontSize: '12px' }}
                  >
                    "What is the difference between GET and POST?"
                  </button>
                  <button
                    className="prompt-chip"
                    onClick={() => ask('Give me an interview question on this topic.')}
                    disabled={isAsking}
                    style={{ textAlign: 'left', fontSize: '12px' }}
                  >
                    "Give me an interview question on this topic."
                  </button>
                </div>
              </div>
            ) : (
              <>
                {messages.map((m) => (
                  <div key={m.id} className={m.role === 'user' ? 'user-msg' : 'ai-msg'}>
                    <div style={{ whiteSpace: 'pre-wrap', lineHeight: 1.5, fontSize: '13px' }}>
                      {m.text}
                    </div>

                    {/* Sourced citations */}
                    {m.sources && m.sources.length > 0 && (
                      <div className="sources" style={{ marginTop: '10px', paddingTop: '8px', borderTop: '1px solid rgba(0,0,0,0.06)' }}>
                        <b style={{ fontSize: '11px', color: '#64748b', display: 'block', marginBottom: '4px' }}>
                          Verified Course Sources:
                        </b>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                          {m.sources.map((s, idx) => {
                            const matchedLecture = allLectures.find((l) => l.id === s.lecture_id);
                            return (
                              <span
                                key={idx}
                                className="source-tag"
                                title="Click to jump to lecture"
                                onClick={() => {
                                  if (matchedLecture) {
                                    setSelectedLecture(matchedLecture);
                                    setActiveView('lesson');
                                  }
                                }}
                                style={{ cursor: 'pointer', fontSize: '11px' }}
                              >
                                <BookOpen size={10} />
                                {matchedLecture ? matchedLecture.title : `Lecture ${s.lecture_id.slice(0, 8)}`}
                              </span>
                            );
                          })}
                        </div>
                      </div>
                    )}
                    <span className="chat-timestamp" style={{ fontSize: '10px', marginTop: '4px', display: 'block', opacity: 0.7 }}>
                      {m.timestamp}
                    </span>
                  </div>
                ))}

                {isAsking && (
                  <div className="chat-loading" style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: '#0d9488' }}>
                    <Loader2 size={16} className="chat-loading" />
                    <span>VertexLearn AI is generating an answer...</span>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Question Input Form */}
          <div
            className="ask"
            style={{
              padding: '12px 16px',
              borderTop: '1px solid #e2e8f0',
              background: '#f8fafc',
              display: 'flex',
              gap: '8px',
            }}
          >
            <input
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && ask()}
              placeholder="Ask AI Tutor a question..."
              disabled={isAsking}
              style={{
                flexGrow: 1,
                padding: '10px 14px',
                borderRadius: '8px',
                border: '1px solid #cbd5e1',
                fontSize: '13px',
                background: '#ffffff',
              }}
            />
            <button
              className="btn btn-primary"
              onClick={() => ask()}
              disabled={isAsking || !question.trim()}
              title="Send question"
              style={{ padding: '10px 14px' }}
            >
              {isAsking ? <Loader2 size={16} className="chat-loading" /> : <Send size={16} />}
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
