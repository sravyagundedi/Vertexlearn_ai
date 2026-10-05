import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Target,
  Sparkles,
  Award,
  BookOpen,
  ArrowRight,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  Compass,
  Clock,
  Flame,
  Layers,
  RotateCcw,
  Loader2,
  Check,
  Zap,
} from 'lucide-react';
import { learningApi } from '../services/api';

interface ActionRecommendation {
  type: 'quiz' | 'lecture' | 'flashcard';
  title: string;
  actionText: string;
  link: string;
  priority: 'high' | 'medium';
}

interface RecommendedLesson {
  course_id: string;
  course_title: string;
  lecture_id: string;
  lecture_title: string;
  next_lecture_id?: string;
  next_lecture_title?: string;
  module_title?: string;
  duration_minutes?: number;
  reason?: string;
}

interface LearningProfile {
  difficultyLevel: string;
  strengths: string[];
  weaknesses: string[];
  recommendedTopics: string[];
  recommendedLessons: RecommendedLesson[];
  actionRecommendations?: ActionRecommendation[];
  progress: {
    courses_enrolled: number;
    lessons_completed: number;
    avg_quiz_score: number;
    quiz_attempts_count: number;
    flashcards_reviewed_count: number;
    flashcards_known_count: number;
    flashcards_difficult_count: number;
    learning_streak_days: number;
    study_time_seconds: number;
  };
}

export default function PersonalizedLearning() {
  const [profile, setProfile] = useState<LearningProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchProfile = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await learningApi.getProfile();
      setProfile(res.data);
    } catch (err: any) {
      console.error('Failed to load personalized learning profile', err);
      setError('Unable to load learning profile. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProfile();
  }, []);

  const formatStudyTime = (totalSeconds: number) => {
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${Math.max(1, minutes)}m`;
  };

  if (loading) {
    return (
      <div className="panel" style={{ padding: '80px', textAlign: 'center', color: '#64748b' }}>
        <Loader2 size={36} className="chat-loading" style={{ margin: '0 auto 16px auto', display: 'block' }} />
        <h3 style={{ fontSize: '18px', fontWeight: 600, color: '#0f172a', marginBottom: '6px' }}>
          Generating Personalized Learning Profile...
        </h3>
        <p style={{ fontSize: '13px', color: '#64748b', margin: 0 }}>
          Synthesizing quiz attempts, completed lessons, and retention metrics.
        </p>
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="panel" style={{ padding: '60px', textAlign: 'center', color: '#64748b' }}>
        <AlertTriangle size={36} color="#d97706" style={{ margin: '0 auto 16px auto', display: 'block' }} />
        <h3 style={{ fontSize: '18px', fontWeight: 600, color: '#0f172a', marginBottom: '8px' }}>
          {error || 'Profile Unavailable'}
        </h3>
        <button className="btn btn-primary" onClick={fetchProfile}>
          Retry Diagnostic
        </button>
      </div>
    );
  }

  const { progress } = profile;

  return (
    <section>
      {/* Header */}
      <header className="top" style={{ marginBottom: '24px' }}>
        <div>
          <span className="eyebrow" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Compass size={14} color="#2563eb" /> ADAPTIVE LEARNING ENGINE
          </span>
          <h1>Personalized Learning Profile</h1>
          <p className="muted">
            Continuous diagnostic insights generated from your quiz evaluations, lesson engagement, and topic comprehension.
          </p>
        </div>
      </header>

      {/* Adaptive Standing & KPI Banner */}
      <div
        style={{
          background: 'linear-gradient(135deg, #ffffff, #f8fafc)',
          border: '1px solid #e2e8f0',
          borderRadius: '18px',
          padding: '24px 28px',
          marginBottom: '28px',
          boxShadow: '0 4px 20px -8px rgba(0,0,0,0.05)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px', marginBottom: '20px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
              <span style={{ fontSize: '13px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#64748b' }}>
                Calibrated Level:
              </span>
              <span
                style={{
                  fontSize: '12px',
                  fontWeight: 800,
                  textTransform: 'uppercase',
                  padding: '4px 12px',
                  borderRadius: '999px',
                  background:
                    profile.difficultyLevel === 'Advanced'
                      ? '#dbeafe'
                      : profile.difficultyLevel === 'Intermediate'
                      ? '#e0e7ff'
                      : '#f1f5f9',
                  color:
                    profile.difficultyLevel === 'Advanced'
                      ? '#1d4ed8'
                      : profile.difficultyLevel === 'Intermediate'
                      ? '#4338ca'
                      : '#334155',
                }}
              >
                ✦ {profile.difficultyLevel}
              </span>
            </div>
            <p style={{ margin: 0, fontSize: '14px', color: '#334155', maxWidth: '680px', lineHeight: 1.5 }}>
              Diagnostic synthesis based on <b>{progress.quiz_attempts_count}</b> quiz attempts,{' '}
              <b>{progress.lessons_completed}</b> completed lessons, and{' '}
              <b>{progress.flashcards_reviewed_count}</b> flashcards reviewed. Your average assessment score is{' '}
              <b>{progress.avg_quiz_score}%</b>.
            </p>
          </div>

          <button
            className="btn btn-secondary btn-sm"
            onClick={fetchProfile}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
          >
            <RotateCcw size={13} /> Refresh Diagnostic
          </button>
        </div>

        {/* 4 Quick KPI Badges */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
            gap: '14px',
            borderTop: '1px solid #f1f5f9',
            paddingTop: '20px',
          }}
        >
          <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '14px 16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#d97706', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>
              <Flame size={15} /> Learning Streak
            </div>
            <div style={{ fontSize: '20px', fontWeight: 800, color: '#0f172a' }}>
              {progress.learning_streak_days} {progress.learning_streak_days === 1 ? 'Day' : 'Days'}
            </div>
          </div>

          <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '14px 16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#16a34a', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>
              <Award size={15} /> Quiz Average
            </div>
            <div style={{ fontSize: '20px', fontWeight: 800, color: '#0f172a' }}>
              {progress.avg_quiz_score}%
            </div>
          </div>

          <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '14px 16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#2563eb', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>
              <Layers size={15} /> Flashcards Known
            </div>
            <div style={{ fontSize: '20px', fontWeight: 800, color: '#0f172a' }}>
              {progress.flashcards_known_count} / {progress.flashcards_reviewed_count || 0}
            </div>
          </div>

          <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '14px 16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#7c3aed', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>
              <Clock size={15} /> Study Time
            </div>
            <div style={{ fontSize: '20px', fontWeight: 800, color: '#0f172a' }}>
              {formatStudyTime(progress.study_time_seconds)}
            </div>
          </div>
        </div>
      </div>

      {/* Grid: Strengths & Weaknesses vs Actionable Recommendations */}
      <div className="grid2" style={{ marginBottom: '28px' }}>
        {/* Left Column: Strengths & Weaknesses */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Verified Strengths */}
          <div className="panel" style={{ borderRadius: '16px', border: '1px solid #e2e8f0', background: '#ffffff', padding: '24px' }}>
            <div className="panel-head" style={{ marginBottom: '16px' }}>
              <h2 style={{ fontSize: '16px', fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Award size={18} color="#0d9488" /> Verified Strengths
              </h2>
              <span style={{ fontSize: '11px', fontWeight: 700, background: '#dcfce7', color: '#15803d', padding: '3px 8px', borderRadius: '4px' }}>
                High Accuracy
              </span>
            </div>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {profile.strengths && profile.strengths.length > 0 ? (
                profile.strengths.map((str, i) => (
                  <li key={i} style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13px', color: '#1e293b' }}>
                    <CheckCircle2 size={16} color="#16a34a" style={{ flexShrink: 0 }} />
                    <span style={{ fontWeight: 500 }}>{str}</span>
                  </li>
                ))
              ) : (
                <li style={{ fontSize: '13px', color: '#64748b' }}>Complete lesson quizzes to establish verified strengths.</li>
              )}
            </ul>
          </div>

          {/* Areas for Improvement */}
          <div className="panel" style={{ borderRadius: '16px', border: '1px solid #e2e8f0', background: '#ffffff', padding: '24px' }}>
            <div className="panel-head" style={{ marginBottom: '16px' }}>
              <h2 style={{ fontSize: '16px', fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <AlertTriangle size={18} color="#d97706" /> Areas for Targeted Improvement
              </h2>
              <span style={{ fontSize: '11px', fontWeight: 700, background: '#fef3c7', color: '#b45309', padding: '3px 8px', borderRadius: '4px' }}>
                Revision Suggested
              </span>
            </div>
            <p style={{ fontSize: '13px', color: '#64748b', marginBottom: '14px', lineHeight: 1.5 }}>
              Topics flagged due to quiz scores under 70% or flashcards marked difficult:
            </p>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {profile.weaknesses && profile.weaknesses.length > 0 ? (
                profile.weaknesses.map((weak, i) => (
                  <li key={i} style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13px', color: '#1e293b' }}>
                    <AlertTriangle size={16} color="#d97706" style={{ flexShrink: 0 }} />
                    <span style={{ fontWeight: 500 }}>{weak}</span>
                  </li>
                ))
              ) : (
                <li style={{ fontSize: '13px', color: '#16a34a' }}>
                  ✓ Outstanding work! No critical knowledge gaps detected across your quizzes.
                </li>
              )}
            </ul>
          </div>
        </div>

        {/* Right Column: Tailored Action Recommendations & Next Lessons */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Actionable Recommendations */}
          <div className="panel" style={{ borderRadius: '16px', border: '1px solid #e2e8f0', background: '#ffffff', padding: '24px' }}>
            <div className="panel-head" style={{ marginBottom: '16px' }}>
              <h2 style={{ fontSize: '16px', fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Target size={18} color="#2563eb" /> High-Impact Action Items
              </h2>
              <span style={{ fontSize: '11px', fontWeight: 700, background: '#eff6ff', color: '#1d4ed8', padding: '3px 8px', borderRadius: '4px' }}>
                Priority Queue
              </span>
            </div>

            {profile.actionRecommendations && profile.actionRecommendations.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '20px' }}>
                {profile.actionRecommendations.map((act, i) => (
                  <div
                    key={i}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '12px 16px',
                      borderRadius: '12px',
                      background: '#f8fafc',
                      border: '1px solid #e2e8f0',
                      gap: '12px',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <Zap size={16} color="#2563eb" />
                      <span style={{ fontSize: '13px', fontWeight: 600, color: '#0f172a' }}>{act.title}</span>
                    </div>
                    <Link to={act.link} className="btn btn-secondary btn-sm" style={{ flexShrink: 0 }}>
                      {act.actionText} <ArrowRight size={13} />
                    </Link>
                  </div>
                ))}
              </div>
            ) : null}

            {/* Core Recommended Topics */}
            <h3 style={{ fontSize: '13px', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '10px' }}>
              Recommended Study Topics:
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {profile.recommendedTopics?.map((topic, i) => (
                <div
                  key={i}
                  style={{
                    padding: '10px 14px',
                    borderRadius: '8px',
                    background: '#f1f5f9',
                    fontSize: '13px',
                    fontWeight: 500,
                    color: '#1e293b',
                  }}
                >
                  📌 {topic}
                </div>
              ))}
            </div>
          </div>

          {/* Next Recommended Lessons */}
          <div className="panel" style={{ borderRadius: '16px', border: '1px solid #e2e8f0', background: '#ffffff', padding: '24px' }}>
            <div className="panel-head" style={{ marginBottom: '16px' }}>
              <h2 style={{ fontSize: '16px', fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <BookOpen size={18} color="#7c3aed" /> Next Recommended Lessons
              </h2>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {profile.recommendedLessons && profile.recommendedLessons.length > 0 ? (
                profile.recommendedLessons.map((rec, idx) => (
                  <div
                    key={idx}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '12px 16px',
                      borderRadius: '12px',
                      background: '#faf5ff',
                      border: '1px solid #e9d5ff',
                      gap: '12px',
                    }}
                  >
                    <div>
                      <b style={{ fontSize: '13px', color: '#581c87', display: 'block' }}>
                        {rec.lecture_title || rec.next_lecture_title}
                      </b>
                      <span style={{ fontSize: '11px', color: '#7e22ce' }}>
                        {rec.course_title} • {rec.reason || `${rec.duration_minutes || 10} min`}
                      </span>
                    </div>
                    <Link
                      to={`/courses/${rec.course_id}${rec.lecture_id || rec.next_lecture_id ? `?lecture=${rec.lecture_id || rec.next_lecture_id}` : ''}`}
                      className="btn btn-primary btn-sm"
                      style={{ flexShrink: 0, background: '#7c3aed', borderColor: '#7c3aed' }}
                    >
                      Start Lesson <ArrowRight size={14} />
                    </Link>
                  </div>
                ))
              ) : (
                <p style={{ fontSize: '13px', color: '#64748b', margin: 0 }}>
                  No pending lessons. Explore the course catalog to enroll in new subjects!
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
