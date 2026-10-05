import { FormEvent, useState, useEffect } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { BrainCircuit, LogIn, UserPlus, Eye, EyeOff, ArrowLeft, CheckCircle2 } from 'lucide-react';

export default function Login() {
  const { login, register } = useAuth();
  const nav = useNavigate();
  const [searchParams] = useSearchParams();

  const [isRegister, setIsRegister] = useState(false);
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('student@vertexlearn.local');
  const [password, setPassword] = useState('Password123!');
  const [role, setRole] = useState<'student' | 'instructor'>('student');
  const [showPassword, setShowPassword] = useState(false);
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (searchParams.get('tab') === 'register') {
      setIsRegister(true);
      setEmail('');
      setPassword('');
    }
  }, [searchParams]);

  const handleQuickFill = (demoEmail: string) => {
    setIsRegister(false);
    setEmail(demoEmail);
    setPassword('Password123!');
    setErr('');
  };

  async function submit(e: FormEvent) {
    e.preventDefault();
    setErr('');

    if (!email.trim() || !password.trim()) {
      setErr('Please fill in all required fields.');
      return;
    }

    if (isRegister && !fullName.trim()) {
      setErr('Please enter your full name.');
      return;
    }

    if (isRegister && password.length < 8) {
      setErr('Password must be at least 8 characters long.');
      return;
    }

    setLoading(true);
    try {
      if (isRegister) {
        await register({ full_name: fullName, email, password });
        nav('/dashboard');
      } else {
        await login({ email, password });
        nav('/dashboard');
      }
    } catch (e: any) {
      console.error('Auth error', e);
      if (!e.response) {
        setErr('Unable to connect to VertexLearn API server. Please check your network connection.');
      } else {
        setErr(
          e.response.data?.error?.message ||
          e.response.data?.message ||
          'Authentication failed. Please check your credentials.'
        );
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth">
      <div className="auth-card">
        {/* Back to Home link */}
        <Link to="/" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: '#64748b', marginBottom: '16px', fontWeight: 600 }}>
          <ArrowLeft size={14} /> Back to VertexLearn
        </Link>

        {/* Brand */}
        <div className="brand" style={{ padding: 0, marginBottom: '8px' }}>
          <div className="brand-icon">
            <BrainCircuit size={20} />
          </div>
          <span>VertexLearn</span>
          <span style={{ color: '#0d9488', fontSize: '11px', background: 'rgba(13, 148, 136, 0.1)', padding: '2px 6px', borderRadius: '4px' }}>AI</span>
        </div>
        <p className="muted" style={{ marginBottom: '20px', fontSize: '13px' }}>
          {isRegister ? 'Create your VertexLearn AI account to begin.' : 'Sign in to access your courses and AI tutor.'}
        </p>

        {/* Tab Switcher */}
        <div className="tool-tabs" style={{ marginBottom: '20px' }}>
          <button
            type="button"
            className={`tool-tab-btn ${!isRegister ? 'active' : ''}`}
            onClick={() => { setIsRegister(false); setErr(''); }}
          >
            <LogIn size={15} /> Sign In
          </button>
          <button
            type="button"
            className={`tool-tab-btn ${isRegister ? 'active' : ''}`}
            onClick={() => { setIsRegister(true); setErr(''); }}
          >
            <UserPlus size={15} /> Create Account
          </button>
        </div>

        {/* Error Alert */}
        {err && <div className="error">{err}</div>}

        <form onSubmit={submit}>
          {isRegister && (
            <label>
              Full Name
              <input
                type="text"
                placeholder="Ada Lovelace"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
              />
            </label>
          )}

          <label>
            Email Address
            <input
              type="email"
              placeholder="name@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </label>

          <label style={{ position: 'relative' }}>
            Password
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <input
                type={showPassword ? 'text' : 'password'}
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                style={{ width: '100%', paddingRight: '40px' }}
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                style={{ position: 'absolute', right: '12px', color: '#94a3b8' }}
                aria-label="Toggle password visibility"
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            {isRegister && <span style={{ fontSize: '11px', color: '#64748b' }}>Minimum 8 characters</span>}
          </label>

          <button className="btn btn-primary btn-full" style={{ padding: '12px', marginTop: '8px' }} disabled={loading}>
            {loading ? (
              'Processing...'
            ) : isRegister ? (
              <>
                <UserPlus size={16} /> Register Free
              </>
            ) : (
              <>
                <LogIn size={16} /> Sign In
              </>
            )}
          </button>
        </form>

        {/* Demo Accounts Helper */}
        <div className="demo">
          <div style={{ fontWeight: 700, marginBottom: '6px', color: '#0f172a' }}>
            Quick Demo Accounts (Password: <b>Password123!</b>):
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '8px' }}>
            <button
              type="button"
              className="prompt-chip"
              onClick={() => handleQuickFill('student@vertexlearn.local')}
            >
              Student
            </button>
            <button
              type="button"
              className="prompt-chip"
              onClick={() => handleQuickFill('instructor@vertexlearn.local')}
            >
              Instructor
            </button>
            <button
              type="button"
              className="prompt-chip"
              onClick={() => handleQuickFill('admin@vertexlearn.local')}
            >
              Admin
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
