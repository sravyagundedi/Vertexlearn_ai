import { ReactNode, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  BrainCircuit,
  LayoutDashboard,
  BookOpen,
  LogOut,
  ShieldCheck,
  Menu,
  X,
  Compass,
  Sparkles,
  Zap,
  Clock,
  Target,
  Award,
  FileText,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function Layout({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth();
  const loc = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  const links =
    user?.role === 'admin'
      ? [
          ['/admin', 'Admin Console', ShieldCheck],
          ['/courses', 'Catalog', BookOpen],
        ]
      : user?.role === 'instructor'
      ? [
          ['/instructor', 'Instructor Studio', LayoutDashboard],
          ['/courses', 'Course Catalog', BookOpen],
        ]
      : [
          ['/dashboard', 'My Learning', LayoutDashboard],
          ['/courses', 'Explore Courses', Compass],
          ['/ai-tutor', 'AI Tutor', BrainCircuit],
          ['/quizzes', 'Quizzes', Zap],
          ['/flashcards', 'Flashcards', Sparkles],
          ['/summaries', 'Summaries', FileText],
          ['/study-plan', 'Study Plan', Clock],
          ['/learning', 'Personalized', Target],
          ['/progress', 'Mastery & Progress', Award],
        ];

  return (
    <div className="app">
      {/* Mobile Top Header */}
      <div
        style={{
          display: 'none',
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          height: '60px',
          background: '#091e42',
          color: '#fff',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 18px',
          zIndex: 60,
          borderBottom: '1px solid rgba(255,255,255,0.1)',
        }}
        className="mobile-header"
      >
        <Link to="/" className="brand" style={{ padding: 0 }}>
          <div className="brand-icon" style={{ width: '28px', height: '28px' }}>
            <BrainCircuit size={16} />
          </div>
          <span style={{ fontSize: '16px' }}>VertexLearn</span>
        </Link>
        <button
          onClick={() => setMobileOpen(!mobileOpen)}
          style={{ color: '#fff', padding: '6px' }}
          aria-label="Toggle menu"
        >
          {mobileOpen ? <X size={22} /> : <Menu size={22} />}
        </button>
      </div>

      {/* Sidebar Navigation */}
      <aside style={{ display: mobileOpen ? 'flex' : undefined }}>
        <Link to="/" className="brand">
          <div className="brand-icon">
            <BrainCircuit size={20} />
          </div>
          <span>VertexLearn</span>
          <span style={{ color: '#2dd4bf', fontSize: '11px', background: 'rgba(45, 212, 191, 0.15)', padding: '2px 6px', borderRadius: '4px' }}>AI</span>
        </Link>

        <nav>
          {links.map(([to, label, Icon]: any) => {
            const isActive = loc.pathname === to || (to !== '/' && loc.pathname.startsWith(to));
            return (
              <Link
                className={isActive ? 'active' : ''}
                to={to}
                key={to}
                onClick={() => setMobileOpen(false)}
              >
                <Icon size={18} />
                <span>{label}</span>
              </Link>
            );
          })}
        </nav>

        {/* AI Quick Banner in Sidebar */}
        <div
          style={{
            margin: '24px 0',
            padding: '14px',
            background: 'rgba(255, 255, 255, 0.04)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            borderRadius: '12px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#5eead4', fontSize: '11px', fontWeight: 700, marginBottom: '6px' }}>
            <Sparkles size={13} /> AI TUTOR READY
          </div>
          <p style={{ color: '#94a3b8', fontSize: '11px', lineHeight: 1.5, margin: 0 }}>
            Course-grounded answers with citations on any lesson.
          </p>
        </div>

        {/* User Profile */}
        <div className="profile">
          <div className="avatar">
            {user?.avatar_url ? (
              <img src={user.avatar_url} alt={user.full_name} style={{ width: '100%', height: '100%', borderRadius: '50%' }} />
            ) : (
              user?.full_name?.[0]?.toUpperCase() || 'V'
            )}
          </div>
          <div style={{ overflow: 'hidden' }}>
            <b style={{ whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
              {user?.full_name || 'Learner'}
            </b>
            <small>{user?.role || 'student'}</small>
          </div>
          <button onClick={logout} title="Sign out">
            <LogOut size={17} />
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main>{children}</main>
    </div>
  );
}
