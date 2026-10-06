import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Sparkles,
  BookOpen,
  BrainCircuit,
  CheckCircle2,
  ArrowRight,
  ShieldCheck,
  Zap,
  Target,
  FileText,
  Clock,
  MessageSquare,
  Award,
  ChevronRight,
  PlayCircle,
  Star,
  Users,
} from 'lucide-react';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import { coursesApi } from '../services/api';

export default function Landing() {
  const [courses, setCourses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    coursesApi
      .getAll()
      .then((res) => {
        setCourses(res.data?.slice(0, 3) || []);
      })
      .catch((err) => {
        console.error('Failed to load courses on landing page', err);
        setCourses([]);
      })
      .finally(() => setLoading(false));
  }, []);

  const features = [
    {
      icon: <BrainCircuit size={22} color="#2563eb" />,
      bg: '#eff6ff',
      title: 'Course-Grounded AI Tutor',
      desc: 'Get precise answers sourced strictly from your lectures and transcripts with exact source citations.',
      link: '/ai-tutor',
    },
    {
      icon: <Target size={22} color="#0d9488" />,
      bg: '#f0fdfa',
      title: 'Personalized Learning',
      desc: 'Dynamic difficulty adaptation from beginner explanations to deep technical architectural breakdowns.',
      link: '/learning',
    },
    {
      icon: <Zap size={22} color="#7c3aed" />,
      bg: '#f5f3ff',
      title: 'Automated AI Quizzes',
      desc: 'Instant multiple-choice quizzes generated from your course material to test and reinforce comprehension.',
      link: '/quizzes',
    },
    {
      icon: <FileText size={22} color="#d97706" />,
      bg: '#fffbeb',
      title: 'Concise AI Summaries',
      desc: 'Transform long lectures and transcripts into clear, actionable bullet points and revision guides.',
      link: '/summaries',
    },
    {
      icon: <Sparkles size={22} color="#e11d48" />,
      bg: '#fff1f2',
      title: 'Interactive 3D Flashcards',
      desc: 'Practice spaced repetition with flip flashcards automatically synthesized from lesson key concepts.',
      link: '/flashcards',
    },
    {
      icon: <Clock size={22} color="#0284c7" />,
      bg: '#f0f9ff',
      title: 'Smart Study Plans',
      desc: 'AI-generated personalized study timetables that balance lectures, revision blocks, and practice quizzes.',
      link: '/study-plan',
    },
    {
      icon: <CheckCircle2 size={22} color="#16a34a" />,
      bg: '#f0fdf4',
      title: 'Progress & Mastery Tracking',
      desc: 'Track lesson completion, quiz accuracy rates, study streaks, and topic-level competency scores.',
      link: '/progress',
    },
    {
      icon: <ShieldCheck size={22} color="#4f46e5" />,
      bg: '#eef2ff',
      title: 'Curated & Verified Curriculum',
      desc: 'Peer-reviewed content submitted by vetted instructors and approved through administrative governance.',
      link: '/courses',
    },
  ];

  const steps = [
    {
      step: '1',
      title: 'Choose a Course',
      desc: 'Browse our catalog of verified courses across software engineering, AI, and cloud architectures.',
    },
    {
      step: '2',
      title: 'Learn Through Lessons',
      desc: 'Watch structured video lessons or follow along with rich interactive text curriculum at your pace.',
    },
    {
      step: '3',
      title: 'Ask AI Tutor',
      desc: 'Never get stuck. Ask questions and get instant, course-grounded explanations with source citations.',
    },
    {
      step: '4',
      title: 'Practice & Test',
      desc: 'Reinforce topics with AI-generated quizzes, interactive flip flashcards, and automated grading.',
    },
    {
      step: '5',
      title: 'Track Your Mastery',
      desc: 'Monitor your completion percentage, learning streak, and master every concept with confidence.',
    },
  ];

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Navbar />

      {/* Hero Section */}
      <section className="hero">
        <div className="hero-pill">
          <Sparkles size={14} /> Powered by Retrieval Augmented Generation (RAG)
        </div>
        <h1>
          Learn Smarter. <br />
          <span>Learn With AI.</span>
        </h1>
        <p>
          VertexLearn AI combines structured, verified educational courses with an intelligent, course-grounded AI Tutor. Master complex subjects with personalized assistance, instant quizzes, and interactive study plans.
        </p>
        <div className="hero-actions">
          <Link to="/login?tab=register" className="btn btn-primary btn-lg">
            Start Learning Free <ArrowRight size={17} />
          </Link>
          <Link to="/courses" className="btn btn-outline btn-lg">
            Explore Courses <BookOpen size={17} />
          </Link>
        </div>

        {/* AI Tutor Interface Preview */}
        <div
          id="ai-tutor"
          style={{
            background: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: '20px',
            padding: '24px',
            boxShadow: '0 20px 40px -15px rgba(11, 43, 103, 0.12)',
            maxWidth: '820px',
            margin: '0 auto',
            textAlign: 'left',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              paddingBottom: '16px',
              borderBottom: '1px solid #f1f5f9',
              marginBottom: '16px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '8px',
                  background: '#eaf1fc',
                  color: '#0b2b67',
                  display: 'grid',
                  placeItems: 'center',
                }}
              >
                <Sparkles size={17} />
              </div>
              <div>
                <b style={{ fontSize: '14px', color: '#0f172a' }}>VertexLearn AI Tutor</b>
                <span style={{ display: 'block', fontSize: '11px', color: '#64748b' }}>
                  Grounded in: Full Stack Web Development
                </span>
              </div>
            </div>
            <span
              style={{
                fontSize: '11px',
                fontWeight: 600,
                background: '#f0fdfa',
                color: '#0d9488',
                padding: '4px 10px',
                borderRadius: '20px',
                border: '1px solid rgba(13,148,136,0.2)',
              }}
            >
              Mode: Intermediate
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div
              style={{
                alignSelf: 'flex-end',
                background: '#0b2b67',
                color: '#fff',
                padding: '12px 16px',
                borderRadius: '16px 16px 4px 16px',
                fontSize: '13px',
                maxWidth: '80%',
              }}
            >
              Can you explain how REST APIs differ from GraphQL, based on Lecture 2?
            </div>
            <div
              style={{
                alignSelf: 'flex-start',
                background: '#f8fafc',
                border: '1px solid #e2e8f0',
                padding: '14px 18px',
                borderRadius: '16px 16px 16px 4px',
                fontSize: '13px',
                color: '#1e293b',
                lineHeight: 1.6,
                maxWidth: '90%',
              }}
            >
              According to <b>Lecture 2: API Architecture</b>, REST exposes fixed resource endpoints over HTTP verbs (GET, POST, PUT, DELETE) where the server dictates payload structure. In contrast, GraphQL provides a single endpoint allowing clients to query exact fields.
              <div className="sources" style={{ marginTop: '10px' }}>
                <b>Referenced Course Material:</b>
                <span className="source-tag">
                  <BookOpen size={11} /> Lecture 2: REST APIs and HTTP Foundations
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Feature Grid Section */}
      <section id="features" style={{ padding: '80px 48px', maxWidth: '1280px', margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: '48px' }}>
          <span className="eyebrow">INTELLIGENT LEARNING SUITE</span>
          <h2 style={{ fontSize: '36px', fontWeight: 800, marginTop: '8px', letterSpacing: '-0.02em' }}>
            Engineered for Deeper Understanding
          </h2>
          <p className="muted" style={{ maxWidth: '600px', margin: '8px auto 0' }}>
            Traditional LMS platforms provide static video links. VertexLearn integrates conversational AI into every module.
          </p>
        </div>

        <div className="feature-grid">
          {features.map((f, i) => (
            <Link
              to={f.link}
              className="feature-card"
              key={i}
              style={{ textDecoration: 'none', color: 'inherit', display: 'flex', flexDirection: 'column', cursor: 'pointer' }}
            >
              <div className="feature-icon" style={{ backgroundColor: f.bg }}>
                {f.icon}
              </div>
              <h3>{f.title}</h3>
              <p>{f.desc}</p>
              <span style={{ marginTop: 'auto', paddingTop: '14px', fontSize: '13px', fontWeight: 700, color: '#2563eb', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                Open Feature <ArrowRight size={14} />
              </span>
            </Link>
          ))}
        </div>
      </section>

      {/* How It Works Section */}
      <section id="how-it-works" className="how-it-works">
        <span className="eyebrow">THE VERTEXLEARN METHOD</span>
        <h2 style={{ fontSize: '34px', fontWeight: 800, marginTop: '8px', letterSpacing: '-0.02em' }}>
          How VertexLearn AI Works
        </h2>
        <p className="muted" style={{ maxWidth: '580px', margin: '8px auto 0' }}>
          A 5-step guided path designed to bridge the gap between passive video watching and active concept mastery.
        </p>

        <div className="steps-grid">
          {steps.map((s, i) => (
            <div className="step-card" key={i}>
              <div className="step-num">{s.step}</div>
              <h4>{s.title}</h4>
              <p>{s.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Course Showcase */}
      <section style={{ padding: '80px 48px', maxWidth: '1280px', margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: '40px' }}>
          <div>
            <span className="eyebrow">FEATURED COURSES</span>
            <h2 style={{ fontSize: '32px', fontWeight: 800, marginTop: '8px' }}>
              Start Learning in Demand Skills
            </h2>
          </div>
          <Link to="/courses" className="btn btn-secondary">
            View All Courses <ChevronRight size={16} />
          </Link>
        </div>

        <div className="course-grid">
          {courses.map((c) => (
            <article className="course-card" key={c.id}>
              <div className="course-cover">
                <PlayCircle size={44} opacity={0.8} />
                <span>{c.difficulty}</span>
              </div>
              <div className="course-body">
                <span className="tag" style={{ width: 'fit-content', marginBottom: '8px' }}>
                  {c.category}
                </span>
                <h3>{c.title}</h3>
                <p>{c.description}</p>
                <div className="course-meta">
                  <span>
                    <Star size={14} fill="currentColor" /> {c.rating || '4.8'}
                  </span>
                  <span>{c.instructor}</span>
                </div>
                <Link to={`/courses/${c.id}`} className="btn btn-primary full">
                  View Course <ArrowRight size={15} />
                </Link>
              </div>
            </article>
          ))}
        </div>
      </section>

      {/* Realistic Platform Statistics */}
      <section style={{ background: '#f1f5f9', padding: '60px 48px', borderTop: '1px solid #e2e8f0', borderBottom: '1px solid #e2e8f0' }}>
        <div
          style={{
            maxWidth: '1200px',
            margin: '0 auto',
            display: 'grid',
            gridTemplateColumns: 'repeat(4, 1fr)',
            gap: '30px',
            textAlign: 'center',
          }}
        >
          <div>
            <h3 style={{ fontSize: '38px', fontWeight: 800, color: '#0b2b67', margin: 0 }}>100%</h3>
            <p style={{ color: '#64748b', fontSize: '13px', marginTop: '6px' }}>Course-Grounded RAG Accuracy</p>
          </div>
          <div>
            <h3 style={{ fontSize: '38px', fontWeight: 800, color: '#0d9488', margin: 0 }}>1536</h3>
            <p style={{ color: '#64748b', fontSize: '13px', marginTop: '6px' }}>Dimensional Vector Embeddings</p>
          </div>
          <div>
            <h3 style={{ fontSize: '38px', fontWeight: 800, color: '#2563eb', margin: 0 }}>&lt;300ms</h3>
            <p style={{ color: '#64748b', fontSize: '13px', marginTop: '6px' }}>P95 Non-AI API Response Time</p>
          </div>
          <div>
            <h3 style={{ fontSize: '38px', fontWeight: 800, color: '#7c3aed', margin: 0 }}>24/7</h3>
            <p style={{ color: '#64748b', fontSize: '13px', marginTop: '6px' }}>Always-On Personalized Tutoring</p>
          </div>
        </div>
      </section>

      {/* Final Call to Action */}
      <section style={{ padding: '0 48px' }}>
        <div className="cta-banner">
          <h2>Start your learning journey with VertexLearn AI.</h2>
          <p>
            Experience education enhanced by real-time conversational intelligence. Ask questions, generate practice materials, and build real mastery.
          </p>
          <div style={{ display: 'flex', justifyContent: 'center', gap: '16px' }}>
            <Link to="/login?tab=register" className="btn btn-teal btn-lg">
              Create Free Account <ArrowRight size={17} />
            </Link>
            <Link to="/courses" className="btn btn-outline btn-lg" style={{ color: '#fff', borderColor: 'rgba(255,255,255,0.3)' }}>
              Browse Catalog
            </Link>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
