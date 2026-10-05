import { useState, useEffect } from 'react';
import {
  HelpCircle,
  CheckCircle2,
  XCircle,
  RotateCcw,
  ArrowRight,
  ArrowLeft,
  Award,
  Loader2,
  Sparkles,
  BookOpen,
} from 'lucide-react';
import { quizzesApi } from '../services/api';
import { DifficultyBadge } from './Badge';

interface QuizQuestion {
  id: string;
  question_text: string;
  question_type: string;
  order_index: number;
  points?: number;
  options: Array<{ id: string; option_text: string }>;
}

interface QuizReviewItem {
  question_id: string;
  question_text: string;
  is_correct: boolean;
  explanation: string;
  selected_option_ids: string[];
  correct_option_ids: string[];
  options: Array<{ id: string; option_text: string; is_correct?: boolean }>;
}

interface QuizSubmitResult {
  attempt_id: string;
  score: number;
  percentage: number;
  correct: number;
  total: number;
  passed: boolean;
  passing_score: number;
  review: QuizReviewItem[];
}

interface QuizPlayerProps {
  quizId: string;
  quizTitle?: string;
  onComplete?: (result: QuizSubmitResult) => void;
  onClose?: () => void;
}

export default function QuizPlayer({ quizId, quizTitle, onComplete, onClose }: QuizPlayerProps) {
  const [loading, setLoading] = useState(true);
  const [quiz, setQuiz] = useState<any>(null);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({}); // question_id -> selected_option_id
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<QuizSubmitResult | null>(null);
  const [showReview, setShowReview] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    setResult(null);
    setShowReview(false);
    setCurrentIdx(0);
    setAnswers({});

    quizzesApi
      .getById(quizId)
      .then((res) => {
        setQuiz(res.data);
      })
      .catch((err) => {
        console.error('Failed to load quiz', err);
        setError('Unable to load quiz questions. Please try again.');
      })
      .finally(() => setLoading(false));
  }, [quizId]);

  const questions: QuizQuestion[] = quiz?.questions || [];
  const currentQ = questions[currentIdx];

  const handleSelectOption = (questionId: string, optionId: string) => {
    setAnswers((prev) => ({
      ...prev,
      [questionId]: optionId,
    }));
  };

  const handleSubmit = async () => {
    if (submitting) return;
    setSubmitting(true);
    setError(null);

    const payloadAnswers = questions.map((q) => ({
      question_id: q.id,
      selected_option_ids: answers[q.id] ? [answers[q.id]] : [],
    }));

    try {
      const res = await quizzesApi.submit(quizId, { answers: payloadAnswers });
      setResult(res.data);
      if (onComplete) onComplete(res.data);
    } catch (err: any) {
      console.error('Failed to submit quiz', err);
      setError(err.response?.data?.error?.message || 'Failed to submit quiz. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRetry = () => {
    setResult(null);
    setShowReview(false);
    setCurrentIdx(0);
    setAnswers({});
  };

  if (loading) {
    return (
      <div className="panel" style={{ padding: '40px', textAlign: 'center' }}>
        <Loader2 size={32} className="chat-loading" style={{ margin: '0 auto 12px' }} />
        <p style={{ color: '#64748b' }}>Loading quiz questions...</p>
      </div>
    );
  }

  if (error || !quiz || questions.length === 0) {
    return (
      <div className="panel" style={{ padding: '36px', textAlign: 'center' }}>
        <HelpCircle size={40} color="#f43f5e" style={{ margin: '0 auto 12px' }} />
        <h3>Quiz Unavailable</h3>
        <p style={{ color: '#64748b', fontSize: '13px', margin: '6px 0 16px' }}>
          {error || 'No questions found for this quiz.'}
        </p>
        {onClose && (
          <button className="btn btn-secondary" onClick={onClose}>
            Back to Lesson
          </button>
        )}
      </div>
    );
  }

  // --- RESULT VIEW ---
  if (result) {
    return (
      <div className="panel quiz-result-panel" style={{ border: '1px solid #bfdbfe', background: '#ffffff', borderRadius: '16px', padding: '32px' }}>
        {/* Score Header */}
        <div style={{ textAlign: 'center', marginBottom: '28px' }}>
          <div
            style={{
              width: '84px',
              height: '84px',
              borderRadius: '50%',
              margin: '0 auto 16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: result.passed ? 'linear-gradient(135deg, #10b981, #059669)' : 'linear-gradient(135deg, #f59e0b, #d97706)',
              color: '#ffffff',
              boxShadow: '0 8px 16px -4px rgba(16, 185, 129, 0.3)',
            }}
          >
            <Award size={44} />
          </div>

          <span
            style={{
              display: 'inline-block',
              padding: '4px 12px',
              borderRadius: '9999px',
              fontSize: '12px',
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              marginBottom: '8px',
              background: result.passed ? '#ecfdf5' : '#fffbeb',
              color: result.passed ? '#047857' : '#b45309',
              border: result.passed ? '1px solid #a7f3d0' : '1px solid #fde68a',
            }}
          >
            {result.passed ? '✓ Passing Score Achieved' : 'Needs Review'}
          </span>

          <h2 style={{ fontSize: '28px', fontWeight: 800, margin: '4px 0 6px', color: '#0f172a' }}>
            {result.percentage}%
          </h2>
          <p style={{ color: '#64748b', fontSize: '14px', margin: 0 }}>
            You answered <b>{result.correct}</b> out of <b>{result.total}</b> questions correctly.
            (Passing requirement: {result.passing_score}%)
          </p>
        </div>

        {/* Action Controls */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: '12px', marginBottom: '24px', flexWrap: 'wrap' }}>
          <button
            className={`btn ${showReview ? 'btn-primary' : 'btn-outline'}`}
            onClick={() => setShowReview(!showReview)}
          >
            <BookOpen size={16} /> {showReview ? 'Hide Explanations' : 'Review Answers & Explanations'}
          </button>
          <button className="btn btn-secondary" onClick={handleRetry}>
            <RotateCcw size={16} /> Retry Quiz
          </button>
          {onClose && (
            <button className="btn btn-teal" onClick={onClose}>
              Continue Course <ArrowRight size={16} />
            </button>
          )}
        </div>

        {/* Detailed Question Review with Explanations */}
        {showReview && (
          <div style={{ marginTop: '24px', borderTop: '1px solid #e2e8f0', paddingTop: '24px' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '16px', color: '#0f172a' }}>
              Detailed Question Review:
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
              {result.review.map((item, idx) => (
                <div
                  key={item.question_id}
                  style={{
                    padding: '16px 20px',
                    borderRadius: '12px',
                    background: item.is_correct ? '#f0fdf4' : '#fff1f2',
                    border: item.is_correct ? '1px solid #bbf7d0' : '1px solid #fecdd3',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', marginBottom: '10px' }}>
                    {item.is_correct ? (
                      <CheckCircle2 size={20} color="#16a34a" style={{ flexShrink: 0, marginTop: '2px' }} />
                    ) : (
                      <XCircle size={20} color="#e11d48" style={{ flexShrink: 0, marginTop: '2px' }} />
                    )}
                    <div>
                      <span style={{ fontSize: '11px', fontWeight: 700, color: item.is_correct ? '#16a34a' : '#e11d48', textTransform: 'uppercase' }}>
                        Question {idx + 1} • {item.is_correct ? 'Correct (+1)' : 'Incorrect (0)'}
                      </span>
                      <h4 style={{ fontSize: '14px', fontWeight: 700, margin: '4px 0 8px', color: '#0f172a' }}>
                        {item.question_text}
                      </h4>
                    </div>
                  </div>

                  {/* Options review */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginLeft: '30px' }}>
                    {item.options.map((opt) => {
                      const isSelected = item.selected_option_ids.includes(opt.id);
                      const isRight = item.correct_option_ids.includes(opt.id);

                      let bg = '#ffffff';
                      let borderColor = '#e2e8f0';
                      let label = '';

                      if (isRight) {
                        bg = '#dcfce7';
                        borderColor = '#86efac';
                        label = '✓ Correct Answer';
                      } else if (isSelected && !isRight) {
                        bg = '#fee2e2';
                        borderColor = '#fca5a5';
                        label = '✗ Your Choice';
                      }

                      return (
                        <div
                          key={opt.id}
                          style={{
                            padding: '8px 12px',
                            borderRadius: '8px',
                            background: bg,
                            border: `1px solid ${borderColor}`,
                            fontSize: '12px',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                          }}
                        >
                          <span style={{ fontWeight: isSelected || isRight ? 600 : 400 }}>
                            {opt.option_text}
                          </span>
                          {label && (
                            <span style={{ fontSize: '11px', fontWeight: 700, color: isRight ? '#15803d' : '#b91c1c' }}>
                              {label}
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* Explanation card */}
                  <div
                    style={{
                      marginTop: '12px',
                      marginLeft: '30px',
                      padding: '10px 14px',
                      background: '#ffffff',
                      border: '1px solid rgba(0,0,0,0.06)',
                      borderRadius: '8px',
                      fontSize: '12px',
                      color: '#334155',
                      lineHeight: 1.5,
                    }}
                  >
                    <b>💡 Explanation:</b> {item.explanation}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  // --- QUESTION BY QUESTION VIEW ---
  const answeredCount = Object.keys(answers).length;
  const progressPercent = Math.round(((currentIdx + 1) / questions.length) * 100);

  return (
    <div className="panel quiz-taking-panel" style={{ border: '1px solid #bfdbfe', background: '#ffffff', borderRadius: '16px', padding: '28px' }}>
      {/* Quiz Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '8px' }}>
        <div>
          <span style={{ fontSize: '11px', fontWeight: 700, color: '#2563eb', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Module Quiz
          </span>
          <h2 style={{ fontSize: '18px', fontWeight: 800, margin: '2px 0 0', color: '#0f172a' }}>
            {quiz.title || quizTitle || 'Knowledge Assessment'}
          </h2>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <DifficultyBadge difficulty={quiz.difficulty || 'intermediate'} />
          <span style={{ fontSize: '12px', color: '#64748b' }}>
            Passing: {quiz.passing_score || 70}%
          </span>
        </div>
      </div>

      {/* Progress Bar */}
      <div style={{ marginBottom: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#64748b', marginBottom: '6px' }}>
          <span>
            Question <b>{currentIdx + 1}</b> of <b>{questions.length}</b>
          </span>
          <span>{answeredCount} answered</span>
        </div>
        <div className="progress" style={{ height: '6px' }}>
          <i style={{ width: `${progressPercent}%`, backgroundColor: '#2563eb' }} />
        </div>
      </div>

      {/* Question Text */}
      <div style={{ marginBottom: '24px' }}>
        <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#0f172a', lineHeight: 1.5, margin: '0 0 16px' }}>
          {currentQ.question_text}
        </h3>

        {/* Options Radios */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {currentQ.options.map((opt, oIdx) => {
            const isSelected = answers[currentQ.id] === opt.id;
            const letter = String.fromCharCode(65 + oIdx); // A, B, C, D

            return (
              <div
                key={opt.id}
                onClick={() => handleSelectOption(currentQ.id, opt.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  padding: '12px 16px',
                  borderRadius: '10px',
                  border: isSelected ? '2px solid #2563eb' : '1px solid #cbd5e1',
                  background: isSelected ? '#eff6ff' : '#f8fafc',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >
                <div
                  style={{
                    width: '28px',
                    height: '28px',
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '12px',
                    fontWeight: 700,
                    background: isSelected ? '#2563eb' : '#ffffff',
                    color: isSelected ? '#ffffff' : '#64748b',
                    border: isSelected ? 'none' : '1px solid #cbd5e1',
                  }}
                >
                  {letter}
                </div>
                <span style={{ fontSize: '13px', fontWeight: isSelected ? 600 : 400, color: '#1e293b' }}>
                  {opt.option_text}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {error && (
        <div className="error" style={{ marginBottom: '16px' }}>
          {error}
        </div>
      )}

      {/* Navigation Footer */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '16px', borderTop: '1px solid #e2e8f0' }}>
        <button
          className="btn btn-secondary"
          onClick={() => setCurrentIdx((i) => Math.max(0, i - 1))}
          disabled={currentIdx === 0}
        >
          <ArrowLeft size={15} /> Previous
        </button>

        <div style={{ display: 'flex', gap: '10px' }}>
          {currentIdx < questions.length - 1 ? (
            <button
              className="btn btn-primary"
              onClick={() => setCurrentIdx((i) => Math.min(questions.length - 1, i + 1))}
            >
              Next Question <ArrowRight size={15} />
            </button>
          ) : (
            <button
              className="btn btn-teal"
              onClick={handleSubmit}
              disabled={submitting || answeredCount === 0}
            >
              {submitting ? (
                <>
                  <Loader2 size={16} className="chat-loading" /> Grading...
                </>
              ) : (
                <>
                  <CheckCircle2 size={16} /> Submit Quiz
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
