import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Clock,
  Calendar,
  CheckCircle2,
  Circle,
  Sparkles,
  BookOpen,
  ArrowRight,
  TrendingUp,
  Target,
  Layers,
  Award,
  Zap,
  Loader2,
  RotateCcw,
  Check,
  AlertCircle,
  ListFilter,
} from 'lucide-react';
import { coursesApi, studyPlansApi } from '../services/api';

interface PlanTask {
  id: string;
  day: number;
  title: string;
  type: 'lecture' | 'quiz' | 'revision' | 'flashcard';
  duration_minutes: number;
  completed: boolean;
  lecture_id?: string;
  quiz_id?: string;
  course_id?: string;
}

interface StudyPlanData {
  id: string;
  course_id: string;
  course_title: string;
  target_date?: string;
  hours_per_day: number;
  total_days: number;
  total_tasks: number;
  completed_count: number;
  progress_percentage: number;
  tasks: PlanTask[];
  generated_at?: string;
}

export default function StudyPlan() {
  const [courses, setCourses] = useState<any[]>([]);
  const [selectedCourseId, setSelectedCourseId] = useState<string>('');
  const [hoursPerDay, setHoursPerDay] = useState<number>(2);
  const [targetDate, setTargetDate] = useState<string>('');
  const [plan, setPlan] = useState<StudyPlanData | null>(null);

  const [loading, setLoading] = useState<boolean>(true);
  const [generating, setGenerating] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<'today' | 'upcoming' | 'completed' | 'all'>('today');
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  // 1. Load course catalog
  useEffect(() => {
    coursesApi
      .getAll()
      .then((res) => {
        const list = res.data || [];
        setCourses(list);
        if (list.length > 0) {
          setSelectedCourseId(list[0].id);
        }
      })
      .catch((err) => console.error('Failed to load courses', err));
  }, []);

  // 2. Fetch existing plan when course changes
  useEffect(() => {
    if (!selectedCourseId) return;
    setLoading(true);
    studyPlansApi
      .get(selectedCourseId)
      .then((res) => {
        if (res.data?.plan) {
          setPlan(res.data.plan);
          if (res.data.plan.hours_per_day) {
            setHoursPerDay(res.data.plan.hours_per_day);
          }
          if (res.data.plan.target_date) {
            setTargetDate(res.data.plan.target_date);
          }
        } else {
          setPlan(null);
        }
      })
      .catch((err) => console.error('Failed to fetch study plan', err))
      .finally(() => setLoading(false));
  }, [selectedCourseId]);

  // 3. Generate or regenerate study plan via AI
  const handleGeneratePlan = async () => {
    if (!selectedCourseId || generating) return;
    setGenerating(true);
    setStatusMessage('AI is analyzing curriculum, progress, and pacing to generate your study plan...');
    try {
      const res = await studyPlansApi.generate({
        course_id: selectedCourseId,
        target_date: targetDate || undefined,
        hours_per_day: hoursPerDay,
      });

      if (res.data?.plan) {
        setPlan(res.data.plan);
        setStatusMessage('✓ Smart Study Plan generated successfully!');
      }
    } catch (err: any) {
      console.error('Failed to generate study plan', err);
      setStatusMessage('Unable to generate study plan at this time.');
    } finally {
      setGenerating(false);
      setTimeout(() => setStatusMessage(null), 3000);
    }
  };

  // 4. Toggle task completion
  const handleToggleTask = async (taskId: string, currentCompleted: boolean) => {
    if (!plan) return;
    const nextCompleted = !currentCompleted;

    // Optimistic UI update
    setPlan((prev) => {
      if (!prev) return null;
      const updatedTasks = prev.tasks.map((t) => (t.id === taskId ? { ...t, completed: nextCompleted } : t));
      const newCompletedCount = updatedTasks.filter((t) => t.completed).length;
      const newProgressPercent = Math.round((newCompletedCount / updatedTasks.length) * 100);
      return {
        ...prev,
        completed_count: newCompletedCount,
        progress_percentage: newProgressPercent,
        tasks: updatedTasks,
      };
    });

    try {
      await studyPlansApi.toggleTask(plan.id, taskId, nextCompleted);
    } catch (err: any) {
      console.error('Failed to update task state', err);
    }
  };

  // Filter tasks into Today, Upcoming, Completed, and All
  const tasks = plan?.tasks || [];
  const completedTasks = tasks.filter((t) => t.completed);
  const pendingTasks = tasks.filter((t) => !t.completed);

  // Today's tasks: Day 1 tasks or lowest pending day's tasks
  const todayDay = pendingTasks.length > 0 ? pendingTasks[0].day : 1;
  const todayTasks = tasks.filter((t) => t.day === todayDay);
  const upcomingTasks = tasks.filter((t) => t.day > todayDay && !t.completed);

  let displayedTasks: PlanTask[] = [];
  if (activeTab === 'today') displayedTasks = todayTasks;
  else if (activeTab === 'upcoming') displayedTasks = upcomingTasks;
  else if (activeTab === 'completed') displayedTasks = completedTasks;
  else displayedTasks = tasks;

  const progressPercent = plan?.progress_percentage || 0;
  const completedCount = plan?.completed_count || completedTasks.length;

  const getTaskActionLink = (task: PlanTask) => {
    if (task.type === 'lecture' && task.lecture_id) {
      return `/courses/${task.course_id || selectedCourseId}?lecture=${task.lecture_id}`;
    }
    if (task.type === 'quiz') {
      return `/quizzes`;
    }
    if (task.type === 'flashcard') {
      return `/flashcards?course_id=${task.course_id || selectedCourseId}`;
    }
    return `/courses/${task.course_id || selectedCourseId}`;
  };

  const getTaskBadgeStyle = (type: string) => {
    switch (type) {
      case 'lecture':
        return { background: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe' };
      case 'quiz':
        return { background: '#fdf2f8', color: '#be185d', border: '1px solid #fbcfe8' };
      case 'flashcard':
        return { background: '#f0fdf4', color: '#15803d', border: '1px solid #bbf7d0' };
      case 'revision':
        return { background: '#fffbeb', color: '#b45309', border: '1px solid #fde68a' };
      default:
        return { background: '#f1f5f9', color: '#475569', border: '1px solid #e2e8f0' };
    }
  };

  return (
    <section>
      {/* Header */}
      <header className="top" style={{ marginBottom: '24px' }}>
        <div>
          <span className="eyebrow" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Calendar size={14} color="#2563eb" /> INTELLIGENT TIMETABLING
          </span>
          <h1>Smart Study Plans</h1>
          <p className="muted">
            Personalized daily learning roadmaps calculated from syllabus volume, available study hours, and knowledge retention pacing.
          </p>
        </div>
      </header>

      {/* Plan Configuration Toolbar */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '16px',
          alignItems: 'center',
          background: '#ffffff',
          border: '1px solid #e2e8f0',
          borderRadius: '16px',
          padding: '18px 22px',
          marginBottom: '24px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.02)',
        }}
      >
        {/* Course Dropdown */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <label style={{ fontSize: '13px', fontWeight: 700, color: '#334155' }}>Target Course:</label>
          <select
            value={selectedCourseId}
            onChange={(e) => setSelectedCourseId(e.target.value)}
            style={{
              padding: '8px 12px',
              borderRadius: '8px',
              border: '1px solid #cbd5e1',
              fontSize: '13px',
              background: '#fff',
              fontWeight: 500,
              maxWidth: '240px',
            }}
          >
            {courses.map((c) => (
              <option key={c.id} value={c.id}>
                {c.title}
              </option>
            ))}
          </select>
        </div>

        {/* Study Hours Dropdown */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <label style={{ fontSize: '13px', fontWeight: 700, color: '#334155' }}>Available Pace:</label>
          <select
            value={hoursPerDay}
            onChange={(e) => setHoursPerDay(Number(e.target.value))}
            style={{
              padding: '8px 12px',
              borderRadius: '8px',
              border: '1px solid #cbd5e1',
              fontSize: '13px',
              background: '#fff',
              fontWeight: 500,
            }}
          >
            <option value={1}>1 hour / day (Relaxed)</option>
            <option value={2}>2 hours / day (Recommended)</option>
            <option value={3}>3 hours / day (Accelerated)</option>
            <option value={4}>4 hours / day (Intensive)</option>
          </select>
        </div>

        {/* Target Date Input */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <label style={{ fontSize: '13px', fontWeight: 700, color: '#334155' }}>Target Date:</label>
          <input
            type="date"
            value={targetDate}
            onChange={(e) => setTargetDate(e.target.value)}
            style={{
              padding: '7px 12px',
              borderRadius: '8px',
              border: '1px solid #cbd5e1',
              fontSize: '13px',
              background: '#fff',
            }}
          />
        </div>

        {/* Generate / Regenerate Action Button */}
        <button
          className="btn btn-primary btn-sm"
          onClick={handleGeneratePlan}
          disabled={generating}
          style={{
            marginLeft: 'auto',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            background: 'linear-gradient(135deg, #2563eb, #7c3aed)',
            border: 'none',
            boxShadow: '0 4px 12px rgba(37, 99, 235, 0.2)',
          }}
        >
          {generating ? <Loader2 size={14} className="chat-loading" /> : <Sparkles size={14} />}
          {plan ? (generating ? 'Regenerating...' : 'Regenerate Plan') : generating ? 'Generating...' : 'Generate Smart Plan'}
        </button>
      </div>

      {/* Status Alert Banner */}
      {statusMessage && (
        <div
          style={{
            padding: '12px 18px',
            borderRadius: '12px',
            background: '#eff6ff',
            border: '1px solid #bfdbfe',
            color: '#1d4ed8',
            fontSize: '13px',
            fontWeight: 500,
            marginBottom: '20px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <Sparkles size={16} /> {statusMessage}
        </div>
      )}

      {/* Main Content Area */}
      {loading ? (
        <div className="panel" style={{ padding: '80px', textAlign: 'center', color: '#64748b' }}>
          <Loader2 size={36} className="chat-loading" style={{ margin: '0 auto 16px auto', display: 'block' }} />
          Loading your personalized study plan...
        </div>
      ) : !plan ? (
        <div
          className="panel"
          style={{
            padding: '60px 24px',
            textAlign: 'center',
            background: '#ffffff',
            borderRadius: '16px',
            border: '1px solid #e2e8f0',
          }}
        >
          <Calendar size={44} color="#94a3b8" style={{ margin: '0 auto 14px auto' }} />
          <h3 style={{ fontSize: '18px', fontWeight: 700, color: '#0f172a', marginBottom: '8px' }}>
            No Active Study Plan for this Course Yet
          </h3>
          <p style={{ color: '#64748b', fontSize: '14px', maxWidth: '440px', margin: '0 auto 24px auto' }}>
            Click "Generate Smart Plan" above to create an automated daily roadmap balancing video lectures, knowledge quizzes, and spaced repetition flashcards.
          </p>
          <button
            className="btn btn-primary"
            onClick={handleGeneratePlan}
            disabled={generating}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}
          >
            {generating ? <Loader2 size={16} className="chat-loading" /> : <Sparkles size={16} />}
            {generating ? 'Generating Smart Plan...' : 'Generate Smart Study Plan'}
          </button>
        </div>
      ) : (
        <div>
          {/* Progress Overview Banner */}
          <div
            className="panel"
            style={{
              background: 'linear-gradient(135deg, #eff6ff 0%, #f0fdf4 100%)',
              border: '1px solid #bfdbfe',
              borderRadius: '18px',
              padding: '24px 28px',
              marginBottom: '24px',
              boxShadow: '0 4px 15px -5px rgba(37, 99, 235, 0.08)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px', marginBottom: '14px' }}>
              <div>
                <span style={{ fontSize: '11px', fontWeight: 700, color: '#2563eb', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  STUDY ROADMAP PROGRESS
                </span>
                <h3 style={{ fontSize: '20px', fontWeight: 800, margin: '4px 0 0', color: '#0f172a' }}>
                  {completedCount} of {tasks.length} tasks completed ({plan.total_days} Total Days)
                </h3>
                <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#64748b' }}>
                  Course: <b>{plan.course_title}</b> • Pace: <b>{plan.hours_per_day} hours/day</b>
                  {plan.target_date ? ` • Target: ${new Date(plan.target_date).toLocaleDateString()}` : ''}
                </p>
              </div>

              <div style={{ textAlign: 'right' }}>
                <span style={{ fontSize: '28px', fontWeight: 800, color: '#0d9488' }}>
                  {progressPercent}%
                </span>
              </div>
            </div>

            {/* Progress bar */}
            <div style={{ width: '100%', height: '8px', background: '#dbeafe', borderRadius: '999px', overflow: 'hidden' }}>
              <div
                style={{
                  width: `${progressPercent}%`,
                  height: '100%',
                  background: 'linear-gradient(90deg, #2563eb, #0d9488)',
                  transition: 'width 0.3s ease',
                }}
              />
            </div>
          </div>

          {/* Task Category Tabs */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '12px',
              marginBottom: '20px',
            }}
          >
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                className={`btn btn-sm ${activeTab === 'today' ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setActiveTab('today')}
              >
                Today's Tasks (Day {todayDay}) • {todayTasks.length}
              </button>
              <button
                className={`btn btn-sm ${activeTab === 'upcoming' ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setActiveTab('upcoming')}
              >
                Upcoming Tasks • {upcomingTasks.length}
              </button>
              <button
                className={`btn btn-sm ${activeTab === 'completed' ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setActiveTab('completed')}
              >
                Completed • {completedTasks.length}
              </button>
              <button
                className={`btn btn-sm ${activeTab === 'all' ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setActiveTab('all')}
              >
                All Tasks ({tasks.length})
              </button>
            </div>

            <span style={{ fontSize: '13px', color: '#64748b' }}>
              Click task to toggle completion state
            </span>
          </div>

          {/* Tasks List */}
          <div
            className="panel"
            style={{
              borderRadius: '16px',
              border: '1px solid #e2e8f0',
              background: '#ffffff',
              padding: '24px',
            }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {displayedTasks.length > 0 ? (
                displayedTasks.map((task) => {
                  const badgeStyle = getTaskBadgeStyle(task.type);
                  const actionLink = getTaskActionLink(task);

                  return (
                    <div
                      key={task.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '16px 20px',
                        borderRadius: '14px',
                        background: task.completed ? '#f0fdf4' : '#ffffff',
                        border: task.completed ? '1px solid #bbf7d0' : '1px solid #e2e8f0',
                        gap: '16px',
                        transition: 'all 0.15s ease',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
                      }}
                    >
                      {/* Left: Checkbox & Task details */}
                      <div
                        onClick={() => handleToggleTask(task.id, task.completed)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '16px',
                          cursor: 'pointer',
                          flex: 1,
                        }}
                      >
                        <div>
                          {task.completed ? (
                            <CheckCircle2 size={22} color="#16a34a" />
                          ) : (
                            <Circle size={22} color="#94a3b8" />
                          )}
                        </div>

                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '2px' }}>
                            <span
                              style={{
                                fontSize: '10px',
                                fontWeight: 700,
                                textTransform: 'uppercase',
                                padding: '2px 8px',
                                borderRadius: '4px',
                                ...badgeStyle,
                              }}
                            >
                              Day {task.day} • {task.type}
                            </span>
                            <span style={{ fontSize: '12px', color: '#64748b', display: 'flex', alignItems: 'center', gap: '4px' }}>
                              <Clock size={12} /> {task.duration_minutes} min
                            </span>
                          </div>

                          <h4
                            style={{
                              fontSize: '14px',
                              fontWeight: 600,
                              margin: 0,
                              color: task.completed ? '#64748b' : '#0f172a',
                              textDecoration: task.completed ? 'line-through' : 'none',
                            }}
                          >
                            {task.title}
                          </h4>
                        </div>
                      </div>

                      {/* Right: Direct action link */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <Link
                          to={actionLink}
                          className="btn btn-secondary btn-sm"
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            fontSize: '12px',
                            padding: '6px 12px',
                          }}
                        >
                          {task.type === 'quiz'
                            ? 'Take Quiz'
                            : task.type === 'flashcard'
                            ? 'Flashcards'
                            : task.completed
                            ? 'Review'
                            : 'Start'}{' '}
                          <ArrowRight size={13} />
                        </Link>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>
                  No tasks found in "{activeTab}" category.
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
