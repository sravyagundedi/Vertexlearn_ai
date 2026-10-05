import { useState, useMemo } from 'react';
import {
  Play,
  CheckCircle2,
  Circle,
  ChevronLeft,
  ChevronRight,
  Maximize2,
  Video,
  Clock,
  Sparkles,
} from 'lucide-react';

interface VideoPlayerProps {
  title: string;
  videoUrl?: string;
  durationSeconds?: number;
  moduleTitle?: string;
  isCompleted: boolean;
  isUpdatingProgress?: boolean;
  onToggleComplete: () => void;
  onPrev?: () => void;
  onNext?: () => void;
  hasPrev?: boolean;
  hasNext?: boolean;
}

export default function VideoPlayer({
  title,
  videoUrl,
  durationSeconds = 0,
  moduleTitle,
  isCompleted,
  isUpdatingProgress = false,
  onToggleComplete,
  onPrev,
  onNext,
  hasPrev = false,
  hasNext = false,
}: VideoPlayerProps) {
  const [isPlaying, setIsPlaying] = useState(false);

  // Extract YouTube ID cleanly
  const youtubeId = useMemo(() => {
    if (!videoUrl) return null;
    const match = videoUrl.match(
      /(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([\w-]{11})/
    );
    return match ? match[1] : null;
  }, [videoUrl]);

  const durationMin = Math.round(durationSeconds / 60);

  return (
    <div className="video-player-container" style={{ borderRadius: '16px', overflow: 'hidden', background: '#0b1329', border: '1px solid #1e293b', marginBottom: '24px', boxShadow: '0 10px 25px -5px rgba(0,0,0,0.3)' }}>
      {/* 16:9 Video Canvas Area */}
      <div style={{ position: 'relative', width: '100%', paddingTop: '56.25%', background: '#020617' }}>
        {youtubeId ? (
          <iframe
            src={`https://www.youtube-nocookie.com/embed/${youtubeId}?rel=0&modestbranding=1&enablejsapi=1`}
            title={title}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
              border: 0,
            }}
          />
        ) : videoUrl && (videoUrl.endsWith('.mp4') || videoUrl.endsWith('.webm')) ? (
          <video
            controls
            src={videoUrl}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
            }}
          />
        ) : (
          <div
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '32px',
              textAlign: 'center',
              background: 'linear-gradient(135deg, #091e42 0%, #0d2847 50%, #06152b 100%)',
              color: '#ffffff',
            }}
          >
            <div
              style={{
                width: '64px',
                height: '64px',
                borderRadius: '50%',
                background: 'rgba(37, 99, 235, 0.2)',
                border: '1px solid rgba(59, 130, 246, 0.4)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: '16px',
                color: '#60a5fa',
              }}
            >
              <Video size={30} />
            </div>
            <span style={{ fontSize: '12px', fontWeight: 700, color: '#38bdf8', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '6px' }}>
              Interactive Class Lecture
            </span>
            <h2 style={{ fontSize: '20px', fontWeight: 800, margin: '0 0 10px', maxWidth: '600px' }}>
              {title}
            </h2>
            <p style={{ color: '#94a3b8', fontSize: '13px', maxWidth: '520px', lineHeight: 1.5 }}>
              Follow along with the comprehensive lesson notes, test your retention with Quick Check, and query your AI Tutor for sourced explanations.
            </p>
          </div>
        )}
      </div>

      {/* Control Bar & Navigation Toolbar */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '12px',
          padding: '16px 20px',
          background: '#0f172a',
          borderTop: '1px solid #1e293b',
          color: '#ffffff',
        }}
      >
        {/* Lesson Title & Module Meta */}
        <div style={{ flex: '1 1 300px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
            {moduleTitle && (
              <span style={{ fontSize: '11px', fontWeight: 700, color: '#38bdf8', background: 'rgba(56, 189, 248, 0.1)', padding: '2px 8px', borderRadius: '4px' }}>
                {moduleTitle}
              </span>
            )}
            {durationMin > 0 && (
              <span style={{ fontSize: '12px', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <Clock size={13} /> {durationMin} min
              </span>
            )}
          </div>
          <h3 style={{ fontSize: '16px', fontWeight: 700, margin: 0, color: '#f8fafc' }}>
            {title}
          </h3>
        </div>

        {/* Action Buttons: Mark Complete & Nav */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button
            type="button"
            onClick={onToggleComplete}
            disabled={isUpdatingProgress}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '9px 16px',
              borderRadius: '8px',
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer',
              border: isCompleted ? '1px solid #059669' : '1px solid #334155',
              background: isCompleted ? '#059669' : '#1e293b',
              color: '#ffffff',
              transition: 'all 0.15s ease',
            }}
          >
            {isCompleted ? (
              <>
                <CheckCircle2 size={16} /> Completed
              </>
            ) : (
              <>
                <Circle size={16} /> Mark as Complete
              </>
            )}
          </button>

          <div style={{ display: 'inline-flex', gap: '6px' }}>
            <button
              type="button"
              onClick={onPrev}
              disabled={!hasPrev}
              title="Previous lesson"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                padding: '9px 12px',
                borderRadius: '8px',
                fontSize: '13px',
                fontWeight: 600,
                background: hasPrev ? '#1e293b' : 'rgba(30, 41, 59, 0.5)',
                color: hasPrev ? '#ffffff' : '#64748b',
                border: '1px solid #334155',
                cursor: hasPrev ? 'pointer' : 'not-allowed',
              }}
            >
              <ChevronLeft size={16} /> Prev
            </button>

            <button
              type="button"
              onClick={onNext}
              disabled={!hasNext}
              title="Next lesson"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                padding: '9px 14px',
                borderRadius: '8px',
                fontSize: '13px',
                fontWeight: 600,
                background: hasNext ? '#2563eb' : 'rgba(30, 41, 59, 0.5)',
                color: hasNext ? '#ffffff' : '#64748b',
                border: hasNext ? '1px solid #3b82f6' : '1px solid #334155',
                cursor: hasNext ? 'pointer' : 'not-allowed',
              }}
            >
              Next <ChevronRight size={16} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
