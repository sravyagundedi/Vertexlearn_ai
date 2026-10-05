import { Link } from 'react-router-dom';
import { BrainCircuit, BookOpen, Sparkles, LogIn, ArrowRight, User } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function Navbar() {
  const { user } = useAuth();

  return (
    <header className="landing-navbar">
      <Link to="/" className="brand" style={{ padding: 0 }}>
        <div className="brand-icon">
          <BrainCircuit size={20} />
        </div>
        <span>VertexLearn</span>
        <span style={{ color: '#0d9488', fontSize: '11px', background: 'rgba(13, 148, 136, 0.1)', padding: '2px 6px', borderRadius: '4px' }}>AI</span>
      </Link>

      <nav className="landing-nav-links">
        <Link to="/">Home</Link>
        <Link to="/courses">Courses</Link>
        <a href="/#features">Features</a>
        <a href="/#how-it-works">How It Works</a>
        <a href="/#ai-tutor">AI Tutor</a>
      </nav>

      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        {user ? (
          <Link
            to={user.role === 'admin' ? '/admin' : user.role === 'instructor' ? '/instructor' : '/dashboard'}
            className="btn btn-primary"
          >
            <User size={15} /> Go to Dashboard
          </Link>
        ) : (
          <>
            <Link to="/login" className="btn btn-outline">
              <LogIn size={15} /> Sign In
            </Link>
            <Link to="/login?tab=register" className="btn btn-primary">
              Get Started <ArrowRight size={15} />
            </Link>
          </>
        )}
      </div>
    </header>
  );
}
