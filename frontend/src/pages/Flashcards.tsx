import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import {
  Sparkles,
  RotateCcw,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  AlertCircle,
  Shuffle,
  BookOpen,
  Layers,
  Loader2,
  RefreshCw,
  HelpCircle,
  Check,
  Flame,
} from 'lucide-react';
import { coursesApi, flashcardsApi } from '../services/api';

interface Flashcard {
  id: string;
  course_id?: string;
  module_id?: string;
  lecture_id?: string;
  question: string;
  answer: string;
  status: 'known' | 'difficult' | 'unreviewed';
  reviewed_at?: string;
  course_title?: string;
  lecture_title?: string;
}

interface Stats {
  total: number;
  known: number;
  difficult: number;
  unreviewed: number;
}

export default function Flashcards() {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialCourseId = searchParams.get('course_id') || '';
  const initialLectureId = searchParams.get('lecture_id') || '';

  const [courses, setCourses] = useState<any[]>([]);
  const [selectedCourseId, setSelectedCourseId] = useState<string>(initialCourseId);
  const [lectures, setLectures] = useState<any[]>([]);
  const [selectedLectureId, setSelectedLectureId] = useState<string>(initialLectureId);

  const [cards, setCards] = useState<Flashcard[]>([]);
  const [stats, setStats] = useState<Stats>({ total: 0, known: 0, difficult: 0, unreviewed: 0 });
  const [currentIdx, setCurrentIdx] = useState<number>(0);
  const [isFlipped, setIsFlipped] = useState<boolean>(false);
  const [filter, setFilter] = useState<'all' | 'unreviewed' | 'known' | 'difficult'>('all');

  const [loading, setLoading] = useState<boolean>(true);
  const [generating, setGenerating] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  // 1. Load initial courses list
  useEffect(() => {
    coursesApi
      .getAll()
      .then((res) => {
        const list = res.data || [];
        setCourses(list);
        if (!selectedCourseId && list.length > 0) {
          setSelectedCourseId(list[0].id);
        }
      })
      .catch((err) => console.error('Failed to load courses', err));
  }, []);

  // 2. When course changes, load its modules & lectures
  useEffect(() => {
    if (!selectedCourseId) return;

    coursesApi
      .getById(selectedCourseId)
      .then((res) => {
        const course = res.data;
        const allLecs: any[] = [];
        course.modules?.forEach((m: any) => {
          m.lectures?.forEach((l: any) => {
            allLecs.push({
              id: l.id,
              title: l.title,
              moduleTitle: m.title,
            });
          });
        });
        setLectures(allLecs);

        // Reset lecture selection if invalid
        if (selectedLectureId && !allLecs.find((l) => l.id === selectedLectureId)) {
          setSelectedLectureId('');
        }
      })
      .catch((err) => console.error('Failed to load course lectures', err));
  }, [selectedCourseId]);

  // 3. Fetch flashcards for the selected course / lecture
  const loadCards = useCallback(async () => {
    if (!selectedCourseId) return;
    setLoading(true);
    try {
      const res = await flashcardsApi.getAll({
        course_id: selectedCourseId,
        lecture_id: selectedLectureId || undefined,
      });

      const cardList: Flashcard[] = res.data?.cards || [];
      const statsData: Stats = res.data?.stats || {
        total: cardList.length,
        known: cardList.filter((c) => c.status === 'known').length,
        difficult: cardList.filter((c) => c.status === 'difficult').length,
        unreviewed: cardList.filter((c) => c.status === 'unreviewed').length,
      };

      setCards(cardList);
      setStats(statsData);
      setCurrentIdx(0);
      setIsFlipped(false);
    } catch (err: any) {
      console.error('Failed to fetch flashcards', err);
    } finally {
      setLoading(false);
    }
  }, [selectedCourseId, selectedLectureId]);

  useEffect(() => {
    loadCards();
  }, [loadCards]);

  // Sync URL search params
  useEffect(() => {
    const params: any = {};
    if (selectedCourseId) params.course_id = selectedCourseId;
    if (selectedLectureId) params.lecture_id = selectedLectureId;
    setSearchParams(params, { replace: true });
  }, [selectedCourseId, selectedLectureId, setSearchParams]);

  // Filtered cards
  const filteredCards = cards.filter((card) => {
    if (filter === 'all') return true;
    return card.status === filter;
  });

  const currentCard = filteredCards[currentIdx] || null;

  // Navigation handlers
  const handleNext = useCallback(() => {
    setIsFlipped(false);
    setCurrentIdx((prev) => (prev < filteredCards.length - 1 ? prev + 1 : 0));
  }, [filteredCards.length]);

  const handlePrev = useCallback(() => {
    setIsFlipped(false);
    setCurrentIdx((prev) => (prev > 0 ? prev - 1 : filteredCards.length - 1));
  }, [filteredCards.length]);

  const handleShuffle = () => {
    setIsFlipped(false);
    setCards((prev) => [...prev].sort(() => Math.random() - 0.5));
    setCurrentIdx(0);
    setStatusMessage('Deck shuffled!');
    setTimeout(() => setStatusMessage(null), 2000);
  };

  // Mark status (known or difficult)
  const handleMarkStatus = async (status: 'known' | 'difficult') => {
    if (!currentCard) return;
    const cardId = currentCard.id;

    // Optimistic UI update
    setCards((prev) =>
      prev.map((c) => (c.id === cardId ? { ...c, status, reviewed_at: new Date().toISOString() } : c))
    );

    setStats((prev) => {
      const oldStatus = currentCard.status;
      const newStats = { ...prev };
      if (oldStatus === 'known') newStats.known = Math.max(0, newStats.known - 1);
      if (oldStatus === 'difficult') newStats.difficult = Math.max(0, newStats.difficult - 1);
      if (oldStatus === 'unreviewed') newStats.unreviewed = Math.max(0, newStats.unreviewed - 1);

      if (status === 'known') newStats.known += 1;
      if (status === 'difficult') newStats.difficult += 1;
      return newStats;
    });

    try {
      await flashcardsApi.review(cardId, status);
      setStatusMessage(status === 'known' ? '✓ Marked as Known!' : '⚠️ Flagged for targeted review');
      setTimeout(() => setStatusMessage(null), 1800);
    } catch (err: any) {
      console.error('Failed to submit review', err);
    }

    handleNext();
  };

  // Generate AI Flashcards
  const handleGenerateAI = async () => {
    if (!selectedCourseId || generating) return;
    setGenerating(true);
    setStatusMessage('AI is analyzing course material to generate new flashcards...');
    try {
      const res = await flashcardsApi.generate({
        course_id: selectedCourseId,
        lecture_id: selectedLectureId || undefined,
        count: 8,
      });

      const newCards: Flashcard[] = res.data?.cards || [];
      if (newCards.length > 0) {
        setStatusMessage(`Successfully generated ${newCards.length} new flashcards!`);
        await loadCards();
      } else {
        setStatusMessage('Flashcards generated successfully.');
        await loadCards();
      }
    } catch (err: any) {
      console.error('Failed to generate flashcards', err);
      setStatusMessage('Unable to generate flashcards at this time.');
    } finally {
      setGenerating(false);
      setTimeout(() => setStatusMessage(null), 3000);
    }
  };

  // Keyboard controls listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if user is typing in a select or input
      const tag = (e.target as HTMLElement)?.tagName?.toLowerCase();
      if (tag === 'input' || tag === 'select' || tag === 'textarea') return;

      if (e.code === 'Space') {
        e.preventDefault();
        setIsFlipped((f) => !f);
      } else if (e.code === 'ArrowRight') {
        e.preventDefault();
        handleNext();
      } else if (e.code === 'ArrowLeft') {
        e.preventDefault();
        handlePrev();
      } else if (e.key === 'k' || e.key === 'K') {
        e.preventDefault();
        handleMarkStatus('known');
      } else if (e.key === 'd' || e.key === 'D') {
        e.preventDefault();
        handleMarkStatus('difficult');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleNext, handlePrev, currentCard]);

  // Current progress calculation
  const progressPercent =
    filteredCards.length > 0 ? Math.round(((currentIdx + 1) / filteredCards.length) * 100) : 0;

  return (
    <section>
      {/* Header */}
      <header className="top" style={{ marginBottom: '24px' }}>
        <div>
          <span className="eyebrow" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Layers size={14} color="#2563eb" /> SPACED REPETITION ENGINE
          </span>
          <h1>Interactive 3D Flashcards</h1>
          <p className="muted">
            Flip cards to test recall, mark difficult concepts for targeted review, and build long-term retention grounded in real course material.
          </p>
        </div>
      </header>

      {/* Course & Lecture Selector Bar */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '16px',
          background: '#ffffff',
          border: '1px solid #e2e8f0',
          borderRadius: '16px',
          padding: '16px 20px',
          marginBottom: '20px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.02)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '14px' }}>
          {/* Course Dropdown */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <label style={{ fontSize: '13px', fontWeight: 700, color: '#334155' }}>Course:</label>
            <select
              value={selectedCourseId}
              onChange={(e) => {
                setSelectedCourseId(e.target.value);
                setSelectedLectureId('');
              }}
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

          {/* Lecture Dropdown */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <label style={{ fontSize: '13px', fontWeight: 700, color: '#334155' }}>Lecture:</label>
            <select
              value={selectedLectureId}
              onChange={(e) => setSelectedLectureId(e.target.value)}
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
              <option value="">All Lectures in Course</option>
              {lectures.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.title}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Action Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button
            className="btn btn-secondary btn-sm"
            onClick={handleShuffle}
            disabled={filteredCards.length <= 1}
            title="Shuffle Deck"
          >
            <Shuffle size={14} /> Shuffle
          </button>
          <button
            className="btn btn-primary btn-sm"
            onClick={handleGenerateAI}
            disabled={generating}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              background: 'linear-gradient(135deg, #4f46e5, #7c3aed)',
              border: 'none',
              boxShadow: '0 4px 12px rgba(99, 102, 241, 0.25)',
            }}
          >
            {generating ? <Loader2 size={14} className="chat-loading" /> : <Sparkles size={14} />}
            {generating ? 'Generating Cards...' : 'Generate AI Flashcards'}
          </button>
        </div>
      </div>

      {/* Status Alert Banner */}
      {statusMessage && (
        <div
          style={{
            padding: '10px 16px',
            borderRadius: '10px',
            background: '#eff6ff',
            border: '1px solid #bfdbfe',
            color: '#1d4ed8',
            fontSize: '13px',
            fontWeight: 500,
            marginBottom: '16px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <Sparkles size={16} /> {statusMessage}
        </div>
      )}

      {/* Filter Tabs & Stats Bar */}
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
        {/* Filter Pills */}
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            className={`btn btn-sm ${filter === 'all' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => {
              setFilter('all');
              setCurrentIdx(0);
              setIsFlipped(false);
            }}
          >
            All ({stats.total})
          </button>
          <button
            className={`btn btn-sm ${filter === 'difficult' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => {
              setFilter('difficult');
              setCurrentIdx(0);
              setIsFlipped(false);
            }}
            style={{
              borderColor: filter === 'difficult' ? undefined : '#fca5a5',
              color: filter === 'difficult' ? undefined : '#b91c1c',
            }}
          >
            Needs Review ({stats.difficult})
          </button>
          <button
            className={`btn btn-sm ${filter === 'known' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => {
              setFilter('known');
              setCurrentIdx(0);
              setIsFlipped(false);
            }}
            style={{
              borderColor: filter === 'known' ? undefined : '#86efac',
              color: filter === 'known' ? undefined : '#15803d',
            }}
          >
            Known ({stats.known})
          </button>
          <button
            className={`btn btn-sm ${filter === 'unreviewed' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => {
              setFilter('unreviewed');
              setCurrentIdx(0);
              setIsFlipped(false);
            }}
          >
            Unreviewed ({stats.unreviewed})
          </button>
        </div>

        {/* Quick Stats Badges */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '12px', fontWeight: 600, color: '#16a34a', background: '#dcfce7', padding: '4px 10px', borderRadius: '6px' }}>
            ✓ {stats.known} Known
          </span>
          <span style={{ fontSize: '12px', fontWeight: 600, color: '#dc2626', background: '#fee2e2', padding: '4px 10px', borderRadius: '6px' }}>
            ⚠️ {stats.difficult} Needs Review
          </span>
          <span style={{ fontSize: '12px', fontWeight: 600, color: '#475569', background: '#f1f5f9', padding: '4px 10px', borderRadius: '6px' }}>
            • {stats.unreviewed} Unreviewed
          </span>
        </div>
      </div>

      {/* Main Flashcard Display */}
      {loading ? (
        <div className="panel" style={{ padding: '60px', textAlign: 'center', color: '#64748b' }}>
          <Loader2 size={32} className="chat-loading" style={{ margin: '0 auto 14px auto', display: 'block' }} />
          Loading flashcards...
        </div>
      ) : filteredCards.length > 0 && currentCard ? (
        <div style={{ maxWidth: '680px', margin: '0 auto', textAlign: 'center' }}>
          {/* Progress Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: '#64748b', fontSize: '13px', marginBottom: '8px' }}>
            <span style={{ fontWeight: 600 }}>
              Card <b>{currentIdx + 1}</b> of <b>{filteredCards.length}</b>
            </span>
            <span>
              {progressPercent}% Complete
            </span>
          </div>

          {/* Progress Bar */}
          <div style={{ width: '100%', height: '6px', background: '#e2e8f0', borderRadius: '999px', overflow: 'hidden', marginBottom: '20px' }}>
            <div
              style={{
                width: `${progressPercent}%`,
                height: '100%',
                background: 'linear-gradient(90deg, #2563eb, #38bdf8)',
                transition: 'width 0.3s ease',
              }}
            />
          </div>

          {/* 3D Flip Card Container with true CSS perspective */}
          <div
            style={{
              perspective: '1200px',
              minHeight: '320px',
              cursor: 'pointer',
              marginBottom: '24px',
            }}
            onClick={() => setIsFlipped((f) => !f)}
          >
            <div
              style={{
                position: 'relative',
                width: '100%',
                minHeight: '320px',
                textAlign: 'left',
                transition: 'transform 0.6s cubic-bezier(0.4, 0, 0.2, 1)',
                transformStyle: 'preserve-3d',
                transform: isFlipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
              }}
            >
              {/* FRONT OF CARD */}
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  width: '100%',
                  height: '100%',
                  backfaceVisibility: 'hidden',
                  WebkitBackfaceVisibility: 'hidden',
                  background: '#ffffff',
                  border: '2px solid #e2e8f0',
                  borderRadius: '24px',
                  padding: '36px 32px',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  boxShadow: '0 20px 35px -15px rgba(0,0,0,0.08), 0 0 1px rgba(0,0,0,0.1)',
                }}
              >
                {/* Front Top Metadata */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span
                    style={{
                      fontSize: '11px',
                      fontWeight: 700,
                      textTransform: 'uppercase',
                      letterSpacing: '0.08em',
                      color: '#2563eb',
                      background: '#eff6ff',
                      padding: '4px 10px',
                      borderRadius: '6px',
                    }}
                  >
                    QUESTION / CONCEPT
                  </span>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {currentCard.status === 'known' && (
                      <span style={{ fontSize: '11px', fontWeight: 700, background: '#dcfce7', color: '#15803d', padding: '3px 8px', borderRadius: '4px' }}>
                        ✓ Known
                      </span>
                    )}
                    {currentCard.status === 'difficult' && (
                      <span style={{ fontSize: '11px', fontWeight: 700, background: '#fee2e2', color: '#b91c1c', padding: '3px 8px', borderRadius: '4px' }}>
                        ⚠️ Needs Review
                      </span>
                    )}
                    {currentCard.lecture_title && (
                      <span style={{ fontSize: '12px', color: '#64748b' }}>
                        {currentCard.lecture_title}
                      </span>
                    )}
                  </div>
                </div>

                {/* Front Question Content */}
                <div style={{ margin: '24px 0' }}>
                  <h2
                    style={{
                      fontSize: '20px',
                      fontWeight: 700,
                      lineHeight: 1.5,
                      color: '#0f172a',
                      margin: 0,
                    }}
                  >
                    {currentCard.question}
                  </h2>
                </div>

                {/* Front Bottom Prompt */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #f1f5f9', paddingTop: '16px' }}>
                  <span style={{ fontSize: '12px', color: '#94a3b8' }}>
                    Click card or press <b>[Space]</b> to reveal answer
                  </span>
                  <RotateCcw size={16} color="#94a3b8" />
                </div>
              </div>

              {/* BACK OF CARD */}
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  width: '100%',
                  height: '100%',
                  backfaceVisibility: 'hidden',
                  WebkitBackfaceVisibility: 'hidden',
                  transform: 'rotateY(180deg)',
                  background: 'linear-gradient(145deg, #091e42, #1e293b)',
                  color: '#ffffff',
                  border: '2px solid #3b82f6',
                  borderRadius: '24px',
                  padding: '36px 32px',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  boxShadow: '0 20px 40px -15px rgba(37, 99, 235, 0.25)',
                }}
              >
                {/* Back Top Metadata */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span
                    style={{
                      fontSize: '11px',
                      fontWeight: 700,
                      textTransform: 'uppercase',
                      letterSpacing: '0.08em',
                      color: '#38bdf8',
                      background: 'rgba(56, 189, 248, 0.15)',
                      padding: '4px 10px',
                      borderRadius: '6px',
                    }}
                  >
                    ANSWER / EXPLANATION
                  </span>

                  {currentCard.lecture_title && (
                    <span style={{ fontSize: '12px', color: '#93c5fd' }}>
                      Source: {currentCard.lecture_title}
                    </span>
                  )}
                </div>

                {/* Back Answer Content */}
                <div style={{ margin: '24px 0' }}>
                  <p
                    style={{
                      fontSize: '17px',
                      lineHeight: 1.7,
                      color: '#f8fafc',
                      margin: 0,
                      fontWeight: 500,
                    }}
                  >
                    {currentCard.answer}
                  </p>
                </div>

                {/* Back Bottom Prompt */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '16px' }}>
                  <span style={{ fontSize: '12px', color: '#94a3b8' }}>
                    Click card or press <b>[Space]</b> to flip back
                  </span>
                  <RotateCcw size={16} color="#38bdf8" />
                </div>
              </div>
            </div>
          </div>

          {/* Feedback & Review Buttons */}
          <div style={{ display: 'flex', justifyContent: 'center', gap: '14px', marginBottom: '24px' }}>
            <button
              className="btn btn-outline"
              style={{
                borderColor: '#f87171',
                color: '#b91c1c',
                background: '#fff',
                padding: '10px 22px',
                fontSize: '14px',
                fontWeight: 600,
                borderRadius: '12px',
              }}
              onClick={() => handleMarkStatus('difficult')}
              title="Shortcut: Press 'D'"
            >
              <AlertCircle size={17} /> Mark Difficult [D]
            </button>
            <button
              className="btn btn-secondary"
              onClick={() => setIsFlipped((f) => !f)}
              style={{ padding: '10px 20px', borderRadius: '12px' }}
              title="Shortcut: Press Space"
            >
              <RotateCcw size={16} /> Flip Card [Space]
            </button>
            <button
              className="btn btn-teal"
              style={{
                padding: '10px 22px',
                fontSize: '14px',
                fontWeight: 600,
                borderRadius: '12px',
              }}
              onClick={() => handleMarkStatus('known')}
              title="Shortcut: Press 'K'"
            >
              <CheckCircle2 size={17} /> Mark Known [K]
            </button>
          </div>

          {/* Navigation Controls */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <button
              className="btn btn-secondary"
              onClick={handlePrev}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', borderRadius: '10px' }}
              title="Shortcut: Left Arrow"
            >
              <ChevronLeft size={16} /> Previous
            </button>

            <span style={{ fontSize: '12px', color: '#94a3b8' }}>
              Keyboard: <b>[Space]</b> Flip • <b>[← / →]</b> Navigate • <b>[K]</b> Known • <b>[D]</b> Review
            </span>

            <button
              className="btn btn-secondary"
              onClick={handleNext}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', borderRadius: '10px' }}
              title="Shortcut: Right Arrow"
            >
              Next <ChevronRight size={16} />
            </button>
          </div>
        </div>
      ) : (
        <div
          className="panel"
          style={{
            padding: '50px 24px',
            textAlign: 'center',
            background: '#ffffff',
            borderRadius: '16px',
            border: '1px solid #e2e8f0',
          }}
        >
          <BookOpen size={36} color="#94a3b8" style={{ margin: '0 auto 12px auto' }} />
          <h3 style={{ fontSize: '18px', fontWeight: 700, color: '#0f172a', marginBottom: '8px' }}>
            No flashcards matching the "{filter}" filter
          </h3>
          <p style={{ color: '#64748b', fontSize: '14px', maxWidth: '420px', margin: '0 auto 20px auto' }}>
            {filter === 'all'
              ? 'Click "Generate AI Flashcards" above to instantly extract key concepts from this course into an interactive spaced-repetition deck.'
              : `You have not marked any cards as "${filter}" in this deck yet.`}
          </p>
          <div style={{ display: 'flex', justifyContent: 'center', gap: '10px' }}>
            {filter !== 'all' && (
              <button className="btn btn-secondary" onClick={() => setFilter('all')}>
                View All Cards ({stats.total})
              </button>
            )}
            <button
              className="btn btn-primary"
              onClick={handleGenerateAI}
              disabled={generating}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
            >
              {generating ? <Loader2 size={16} className="chat-loading" /> : <Sparkles size={16} />}
              {generating ? 'Generating Cards...' : 'Generate AI Flashcards'}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
