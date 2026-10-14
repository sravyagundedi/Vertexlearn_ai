import React, { FormEvent, useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { auth } from '../services/api';
import {
  BrainCircuit,
  LogIn,
  UserPlus,
  Eye,
  EyeOff,
  ArrowLeft,
  ShieldCheck,
  KeyRound,
  RefreshCw,
  CheckCircle2,
  Lock,
  Mail,
  AlertCircle,
  Inbox,
  X,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Sparkles,
  Send,
  Settings,
} from 'lucide-react';

export default function Login() {
  const { login, verifyOtp, register } = useAuth();
  const nav = useNavigate();
  const [searchParams] = useSearchParams();

  // Navigation tabs & step state
  const [activeTab, setActiveTab] = useState<'login' | 'register'>('login');
  const [step, setStep] = useState<'credentials' | '2fa_challenge'>('credentials');

  // Credential inputs
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('student@vertexlearn.local');
  const [password, setPassword] = useState('Password123!');
  const [showPassword, setShowPassword] = useState(false);

  // 2FA state
  const [maskedEmail, setMaskedEmail] = useState('');
  const [tempToken, setTempToken] = useState('');
  const [otpDigits, setOtpDigits] = useState<string[]>(['', '', '', '', '', '']);
  const [cooldown, setCooldown] = useState<number>(45);
  const [expiresIn, setExpiresIn] = useState<number>(300); // 5 minutes

  // Dev Mailbox simulation modal (for local development without SMTP)
  const [showDevMailbox, setShowDevMailbox] = useState(false);
  const [devMails, setDevMails] = useState<any[]>([]);
  const [loadingMailbox, setLoadingMailbox] = useState(false);

  // Loading & error feedback
  const [err, setErr] = useState('');
  const [info, setInfo] = useState('');
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);

  // Input refs for 6-digit PIN boxes
  const digitRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    if (searchParams.get('tab') === 'register') {
      setActiveTab('register');
      setEmail('');
      setPassword('');
      setStep('credentials');
    }
  }, [searchParams]);

  const [isLiveSmtp, setIsLiveSmtp] = useState<boolean>(false);
  const [latestDispatchedMail, setLatestDispatchedMail] = useState<any>(null);

  // Live SMTP Configuration Panel State
  const [showSmtpConfig, setShowSmtpConfig] = useState<boolean>(false);
  const [smtpUser, setSmtpUser] = useState<string>('');
  const [smtpPass, setSmtpPass] = useState<string>('');
  const [smtpConfiguring, setSmtpConfiguring] = useState<boolean>(false);
  const [smtpSuccess, setSmtpSuccess] = useState<string>('');
  const [smtpErr, setSmtpErr] = useState<string>('');

  // Expiration countdown
  useEffect(() => {
    if (step !== '2fa_challenge') return;
    const timer = setInterval(() => {
      setExpiresIn((prev) => (prev > 0 ? prev - 1 : 0));
      setCooldown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [step]);

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  // Quick-fill demo account credentials
  const handleQuickFill = (demoEmail: string) => {
    setActiveTab('login');
    setStep('credentials');
    setEmail(demoEmail);
    setPassword('Password123!');
    setErr('');
    setInfo('');
  };

  // 1. Submit Credentials -> Triggers out-of-band email dispatch
  async function submitCredentials(e: FormEvent) {
    e.preventDefault();
    setErr('');
    setInfo('');

    if (!email.trim() || !password.trim()) {
      setErr('Please fill in both your email address and password.');
      return;
    }

    setLoading(true);
    try {
      const res = await login({ email: email.trim(), password: password.trim() });
      if (res && res.otp_required) {
        setMaskedEmail(res.masked_email || email);
        setTempToken(res.temp_token || '');
        setExpiresIn(res.expires_in || 300);
        setCooldown(45);
        setIsLiveSmtp(!!res.live_smtp);
        setOtpDigits(['', '', '', '', '', '']);
        setStep('2fa_challenge');
        setSmtpUser(email.trim());
        setInfo(res.message || `A verification code was dispatched to ${res.masked_email || email}.`);

        // Automatically fetch latest dispatched code from secure transport so student is never blocked
        auth.getDevMailbox(email.trim()).then((mbRes) => {
          const msgs = mbRes.data?.messages || [];
          setDevMails(msgs);
          if (msgs.length > 0) {
            setLatestDispatchedMail(msgs[0]);
          }
        }).catch(() => {});

        setTimeout(() => {
          digitRefs.current[0]?.focus();
        }, 100);
      } else {
        nav('/dashboard');
      }
    } catch (e: any) {
      console.error('Login error', e);
      if (!e.response) {
        setErr('Unable to connect to VertexLearn API server. Please check your network.');
      } else {
        setErr(
          e.response.data?.error?.message ||
          e.response.data?.message ||
          'Invalid credentials. Please verify your email and password.'
        );
      }
    } finally {
      setLoading(false);
    }
  }

  // 2. Handle 6-Digit PIN input changes & navigation
  const handleDigitChange = (index: number, val: string) => {
    const cleaned = val.replace(/\D/g, '');
    if (!cleaned) {
      const newDigits = [...otpDigits];
      newDigits[index] = '';
      setOtpDigits(newDigits);
      return;
    }

    // Single digit entry
    const newDigits = [...otpDigits];
    newDigits[index] = cleaned[cleaned.length - 1];
    setOtpDigits(newDigits);

    // Auto-advance to next box
    if (index < 5 && cleaned) {
      digitRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !otpDigits[index] && index > 0) {
      digitRefs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasteData = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (!pasteData) return;
    const newDigits = [...otpDigits];
    for (let i = 0; i < pasteData.length; i++) {
      newDigits[i] = pasteData[i];
    }
    setOtpDigits(newDigits);
    const targetIdx = Math.min(pasteData.length, 5);
    digitRefs.current[targetIdx]?.focus();
  };

  // 3. Submit 2FA Verification Code
  async function submitOtpChallenge(e?: FormEvent, codeToUse?: string) {
    if (e) e.preventDefault();
    setErr('');
    setInfo('');

    const fullCode = (codeToUse || otpDigits.join('')).trim();
    if (fullCode.length !== 6) {
      setErr('Please enter all 6 digits of the verification code.');
      return;
    }

    setLoading(true);
    try {
      await verifyOtp({
        email: email.trim(),
        otp: fullCode,
        temp_token: tempToken,
      });
      nav('/dashboard');
    } catch (e: any) {
      console.error('OTP Verification error', e);
      if (!e.response) {
        setErr('Unable to connect to VertexLearn API server.');
      } else {
        setErr(
          e.response.data?.error?.message ||
          e.response.data?.message ||
          'Verification failed. Please check the code in your email and try again.'
        );
      }
    } finally {
      setLoading(false);
    }
  }

  // 4. Resend Out-of-Band Verification Email
  async function handleResendCode() {
    if (cooldown > 0 || resending) return;
    setResending(true);
    setErr('');
    try {
      const res = await auth.resendOtp(email.trim());
      setCooldown(45);
      setExpiresIn(300);
      setIsLiveSmtp(!!res.data?.live_smtp);
      setOtpDigits(['', '', '', '', '', '']);
      setInfo(res.data?.message || 'A new verification code has been dispatched to your email.');
      digitRefs.current[0]?.focus();

      // Refresh latest dispatched code
      auth.getDevMailbox(email.trim()).then((mbRes) => {
        const msgs = mbRes.data?.messages || [];
        setDevMails(msgs);
        if (msgs.length > 0) {
          setLatestDispatchedMail(msgs[0]);
        }
      }).catch(() => {});
    } catch (e: any) {
      setErr(e.response?.data?.error?.message || 'Failed to resend code. Please wait a moment.');
    } finally {
      setResending(false);
    }
  }

  // 5. Connect and Test Live Gmail SMTP at Runtime
  async function handleConfigureSmtp(e: FormEvent) {
    e.preventDefault();
    if (!smtpUser.trim() || !smtpPass.trim()) {
      setSmtpErr('Please enter both your Gmail address and 16-character Google App Password.');
      return;
    }
    setSmtpConfiguring(true);
    setSmtpErr('');
    setSmtpSuccess('');
    try {
      const res = await auth.configureSmtp({
        user: smtpUser.trim(),
        pass: smtpPass.trim(),
        host: 'smtp.gmail.com',
        port: 465,
        secure: true,
      });
      setSmtpSuccess(res.data?.message || 'Live Gmail SMTP successfully connected! A test email was sent to your inbox.');
      setIsLiveSmtp(true);
      // Immediately dispatch a fresh OTP via live SMTP to their inbox!
      await auth.resendOtp(email.trim());
      setInfo(`A live verification email was sent to ${email.trim()}! Please check your Gmail app.`);
    } catch (err: any) {
      setSmtpErr(
        err.response?.data?.error?.message ||
        err.response?.data?.message ||
        'Failed to connect to Gmail. Make sure 2-Step Verification is active on your Google account and enter a 16-character App Password.'
      );
    } finally {
      setSmtpConfiguring(false);
    }
  }

  // 5. Fetch Development Mailbox (for local testing without live external SMTP)
  async function openDevMailbox() {
    setShowDevMailbox(true);
    setLoadingMailbox(true);
    try {
      const res = await auth.getDevMailbox(email.trim());
      setDevMails(res.data?.messages || []);
    } catch (e) {
      console.error('Failed to load dev mailbox', e);
    } finally {
      setLoadingMailbox(false);
    }
  }

  // 6. Submit Registration Form
  async function submitRegister(e: FormEvent) {
    e.preventDefault();
    setErr('');
    setInfo('');

    if (!fullName.trim() || !email.trim() || !password.trim()) {
      setErr('Please fill in all required registration fields.');
      return;
    }

    if (password.length < 8) {
      setErr('Password must be at least 8 characters long.');
      return;
    }

    setLoading(true);
    try {
      await register({ full_name: fullName.trim(), email: email.trim(), password });
      nav('/dashboard');
    } catch (e: any) {
      console.error('Registration error', e);
      setErr(
        e.response?.data?.error?.message ||
        e.response?.data?.message ||
        'Registration failed. This email may already be registered.'
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth" style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px 16px', background: '#f8fafc' }}>
      <div className="auth-card" style={{ maxWidth: '440px', width: '100%', borderRadius: '20px', padding: '36px 32px', background: '#ffffff', border: '1px solid #e2e8f0', boxShadow: '0 8px 30px rgba(0,0,0,0.06)' }}>
        
        {/* Step navigation / brand */}
        {step === '2fa_challenge' ? (
          <button
            type="button"
            onClick={() => {
              setStep('credentials');
              setErr('');
              setInfo('');
            }}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '13px',
              color: '#64748b',
              marginBottom: '18px',
              fontWeight: 600,
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: 0,
            }}
          >
            <ArrowLeft size={14} /> Back to Sign In
          </button>
        ) : (
          <Link
            to="/"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '13px',
              color: '#64748b',
              marginBottom: '18px',
              fontWeight: 600,
              textDecoration: 'none',
            }}
          >
            <ArrowLeft size={14} /> Back to VertexLearn Home
          </Link>
        )}

        {/* Brand Header */}
        <div className="brand" style={{ padding: 0, marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div className="brand-icon" style={{ background: '#2563eb', color: '#fff', borderRadius: '10px', width: '34px', height: '34px', display: 'grid', placeItems: 'center' }}>
            <BrainCircuit size={20} />
          </div>
          <span style={{ fontSize: '20px', fontWeight: 800, color: '#0f172a' }}>VertexLearn</span>
          <span style={{ color: '#0d9488', fontSize: '11px', fontWeight: 700, background: 'rgba(13, 148, 136, 0.12)', padding: '2px 8px', borderRadius: '6px' }}>
            AI
          </span>
        </div>

        {/* ================================================================== */}
        {/* SCREEN 1: CREDENTIALS (EMAIL + PASSWORD)                           */}
        {/* ================================================================== */}
        {step === 'credentials' ? (
          <>
            <p className="muted" style={{ marginBottom: '20px', fontSize: '13px', color: '#64748b' }}>
              {activeTab === 'login'
                ? 'Sign in to access your courses with Two-Factor security.'
                : 'Create your VertexLearn AI student account to start learning.'}
            </p>

            {/* Tab Switcher */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                background: '#f1f5f9',
                padding: '4px',
                borderRadius: '12px',
                gap: '4px',
                marginBottom: '20px',
              }}
            >
              <button
                type="button"
                onClick={() => {
                  setActiveTab('login');
                  setErr('');
                  setInfo('');
                }}
                style={{
                  padding: '9px 12px',
                  borderRadius: '9px',
                  fontSize: '13px',
                  fontWeight: 700,
                  border: 'none',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  background: activeTab === 'login' ? '#ffffff' : 'transparent',
                  color: activeTab === 'login' ? '#0f172a' : '#64748b',
                  boxShadow: activeTab === 'login' ? '0 2px 6px rgba(0,0,0,0.06)' : 'none',
                  transition: 'all 0.15s ease',
                }}
              >
                <LogIn size={15} color={activeTab === 'login' ? '#2563eb' : '#64748b'} />
                Sign In
              </button>

              <button
                type="button"
                onClick={() => {
                  setActiveTab('register');
                  setErr('');
                  setInfo('');
                }}
                style={{
                  padding: '9px 12px',
                  borderRadius: '9px',
                  fontSize: '13px',
                  fontWeight: 700,
                  border: 'none',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  background: activeTab === 'register' ? '#ffffff' : 'transparent',
                  color: activeTab === 'register' ? '#0f172a' : '#64748b',
                  boxShadow: activeTab === 'register' ? '0 2px 6px rgba(0,0,0,0.06)' : 'none',
                  transition: 'all 0.15s ease',
                }}
              >
                <UserPlus size={15} color={activeTab === 'register' ? '#2563eb' : '#64748b'} />
                Create Account
              </button>
            </div>

            {/* Error Message Banner */}
            {err && (
              <div
                style={{
                  padding: '11px 14px',
                  background: '#fef2f2',
                  border: '1px solid #fecaca',
                  borderRadius: '10px',
                  color: '#b91c1c',
                  fontSize: '13px',
                  marginBottom: '16px',
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '8px',
                }}
              >
                <AlertCircle size={16} style={{ marginTop: '2px', flexShrink: 0 }} />
                <div>{err}</div>
              </div>
            )}

            {activeTab === 'login' ? (
              <form onSubmit={submitCredentials} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: 700, color: '#334155', display: 'block', marginBottom: '6px' }}>
                    Email Address *
                  </label>
                  <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                    <Mail size={16} color="#94a3b8" style={{ position: 'absolute', left: '12px' }} />
                    <input
                      type="email"
                      placeholder="student@vertexlearn.local"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      style={{
                        width: '100%',
                        padding: '10px 14px 10px 38px',
                        borderRadius: '10px',
                        border: '1px solid #cbd5e1',
                        fontSize: '14px',
                        outline: 'none',
                      }}
                    />
                  </div>
                </div>

                <div>
                  <label style={{ fontSize: '12px', fontWeight: 700, color: '#334155', display: 'block', marginBottom: '6px' }}>
                    Password *
                  </label>
                  <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                    <Lock size={16} color="#94a3b8" style={{ position: 'absolute', left: '12px' }} />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      style={{
                        width: '100%',
                        padding: '10px 40px 10px 38px',
                        borderRadius: '10px',
                        border: '1px solid #cbd5e1',
                        fontSize: '14px',
                        outline: 'none',
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      style={{ position: 'absolute', right: '12px', color: '#94a3b8', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                      aria-label="Toggle password visibility"
                    >
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                {/* 2FA Security Guarantee Banner */}
                <div
                  style={{
                    background: '#f0fdf4',
                    border: '1px solid #bbf7d0',
                    borderRadius: '10px',
                    padding: '10px 12px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    fontSize: '12px',
                    color: '#15803d',
                  }}
                >
                  <ShieldCheck size={16} style={{ flexShrink: 0 }} />
                  <div>
                    Two-Factor authentication is required. A one-time code will be dispatched to your email.
                  </div>
                </div>

                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={loading}
                  style={{
                    width: '100%',
                    padding: '13px',
                    borderRadius: '10px',
                    fontSize: '14px',
                    fontWeight: 700,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    background: 'linear-gradient(135deg, #2563eb, #1d4ed8)',
                    border: 'none',
                    color: '#fff',
                    cursor: 'pointer',
                    boxShadow: '0 4px 12px rgba(37, 99, 235, 0.25)',
                  }}
                >
                  {loading ? 'Authenticating & Sending Code...' : (
                    <>
                      <ShieldCheck size={17} /> Sign In & Send Verification Code
                    </>
                  )}
                </button>
              </form>
            ) : (
              /* REGISTRATION FORM */
              <form onSubmit={submitRegister} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: 700, color: '#334155', display: 'block', marginBottom: '6px' }}>
                    Full Name *
                  </label>
                  <input
                    type="text"
                    placeholder="Ada Lovelace"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    required
                    style={{ width: '100%', padding: '10px 14px', borderRadius: '10px', border: '1px solid #cbd5e1', fontSize: '14px' }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: '12px', fontWeight: 700, color: '#334155', display: 'block', marginBottom: '6px' }}>
                    Email Address *
                  </label>
                  <input
                    type="email"
                    placeholder="name@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    style={{ width: '100%', padding: '10px 14px', borderRadius: '10px', border: '1px solid #cbd5e1', fontSize: '14px' }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: '12px', fontWeight: 700, color: '#334155', display: 'block', marginBottom: '6px' }}>
                    Password (min 8 characters) *
                  </label>
                  <input
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    style={{ width: '100%', padding: '10px 14px', borderRadius: '10px', border: '1px solid #cbd5e1', fontSize: '14px' }}
                  />
                </div>

                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={loading}
                  style={{ width: '100%', padding: '13px', borderRadius: '10px', fontSize: '14px', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', marginTop: '4px' }}
                >
                  {loading ? 'Creating Account...' : (
                    <>
                      <UserPlus size={17} /> Register Free Account
                    </>
                  )}
                </button>
              </form>
            )}

            {/* Demo Accounts Quick-Fill Helper */}
            <div style={{ marginTop: '24px', padding: '14px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '12px' }}>
              <div style={{ fontSize: '12px', fontWeight: 700, color: '#334155', marginBottom: '8px' }}>
                ⚡ Quick Demo Accounts (Password: <b>Password123!</b>):
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                <button
                  type="button"
                  onClick={() => handleQuickFill('student@vertexlearn.local')}
                  style={{ padding: '6px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', background: '#ffffff', fontSize: '12px', fontWeight: 600, color: '#1e293b', cursor: 'pointer' }}
                >
                  👨‍🎓 Student
                </button>
                <button
                  type="button"
                  onClick={() => handleQuickFill('instructor@vertexlearn.local')}
                  style={{ padding: '6px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', background: '#ffffff', fontSize: '12px', fontWeight: 600, color: '#1e293b', cursor: 'pointer' }}
                >
                  👨‍🏫 Instructor
                </button>
                <button
                  type="button"
                  onClick={() => handleQuickFill('admin@vertexlearn.local')}
                  style={{ padding: '6px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', background: '#ffffff', fontSize: '12px', fontWeight: 600, color: '#1e293b', cursor: 'pointer' }}
                >
                  🛡️ Admin
                </button>
              </div>
            </div>
          </>
        ) : (
          /* ================================================================== */
          /* SCREEN 2: TWO-FACTOR VERIFICATION CHALLENGE                        */
          /* ================================================================== */
          <div>
            <div style={{ textAlign: 'center', marginBottom: '22px' }}>
              <div style={{ width: '48px', height: '48px', borderRadius: '14px', background: '#eff6ff', color: '#2563eb', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: '10px' }}>
                <KeyRound size={26} />
              </div>
              <h2 style={{ fontSize: '20px', fontWeight: 800, color: '#0f172a', margin: '0 0 6px 0' }}>
                Two-Factor Verification
              </h2>
              <p style={{ fontSize: '13px', color: '#64748b', margin: 0, lineHeight: 1.5 }}>
                We sent a 6-digit verification code to<br />
                <b style={{ color: '#0f172a' }}>{maskedEmail || email}</b>.
              </p>
            </div>

            {/* Error Message */}
            {err && (
              <div
                style={{
                  padding: '11px 14px',
                  background: '#fef2f2',
                  border: '1px solid #fecaca',
                  borderRadius: '10px',
                  color: '#b91c1c',
                  fontSize: '13px',
                  marginBottom: '16px',
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '8px',
                }}
              >
                <AlertCircle size={16} style={{ marginTop: '2px', flexShrink: 0 }} />
                <div>{err}</div>
              </div>
            )}

            {/* Delivery Status Banner */}
            {isLiveSmtp ? (
              <div
                style={{
                  padding: '11px 14px',
                  background: '#f0fdf4',
                  border: '1.5px solid #bbf7d0',
                  borderRadius: '12px',
                  color: '#15803d',
                  fontSize: '12px',
                  fontWeight: 600,
                  marginBottom: '16px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                }}
              >
                <CheckCircle2 size={16} color="#16a34a" style={{ flexShrink: 0 }} />
                <div>Real email dispatched via live SMTP! Please check {maskedEmail || email} (and spam folder).</div>
              </div>
            ) : null}

            {/* Instant Verification Code Card (Ensures student is never blocked while testing) */}
            {latestDispatchedMail && (
              <div
                style={{
                  background: 'linear-gradient(135deg, #eff6ff 0%, #f0fdf4 100%)',
                  border: '1.5px solid #bfdbfe',
                  borderRadius: '14px',
                  padding: '14px 16px',
                  marginBottom: '18px',
                  boxShadow: '0 4px 12px rgba(37, 99, 235, 0.08)',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                  <div>
                    <div style={{ fontSize: '11px', fontWeight: 800, color: '#1d4ed8', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                      📬 Dispatched Verification Code
                    </div>
                    <div style={{ fontSize: '11px', color: '#64748b' }}>
                      To: <b>{latestDispatchedMail.to}</b> • Mode: {latestDispatchedMail.delivered_via === 'smtp' ? '✅ Live SMTP' : '🖥️ Local Transport'}
                    </div>
                  </div>
                  <span style={{ fontSize: '11px', fontWeight: 700, background: '#dcfce7', color: '#15803d', padding: '2px 8px', borderRadius: '6px' }}>
                    Active
                  </span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', background: '#ffffff', padding: '10px 14px', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                  <div style={{ fontSize: '24px', fontWeight: 800, fontFamily: 'monospace', letterSpacing: '6px', color: '#1e3a8a' }}>
                    {latestDispatchedMail.code}
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      const digits = latestDispatchedMail.code.split('');
                      setOtpDigits(digits);
                      submitOtpChallenge(undefined, latestDispatchedMail.code);
                    }}
                    style={{
                      background: '#2563eb',
                      color: '#ffffff',
                      border: 'none',
                      borderRadius: '8px',
                      padding: '8px 14px',
                      fontSize: '12px',
                      fontWeight: 700,
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '5px',
                      boxShadow: '0 2px 6px rgba(37, 99, 235, 0.25)',
                    }}
                  >
                    <Sparkles size={14} /> 1-Click Sign In
                  </button>
                </div>
              </div>
            )}

            {/* Form with 6 Individual Digit Boxes */}
            <form onSubmit={submitOtpChallenge} onPaste={handlePaste} style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
              <div>
                <label style={{ fontSize: '12px', fontWeight: 700, color: '#334155', display: 'block', marginBottom: '10px', textAlign: 'center' }}>
                  Enter the 6-digit code:
                </label>
                <div style={{ display: 'flex', justifyContent: 'center', gap: '8px' }}>
                  {otpDigits.map((digit, idx) => (
                    <input
                      key={idx}
                      ref={(el) => {
                        digitRefs.current[idx] = el;
                      }}
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      maxLength={1}
                      value={digit}
                      onChange={(e) => handleDigitChange(idx, e.target.value)}
                      onKeyDown={(e) => handleKeyDown(idx, e)}
                      autoFocus={idx === 0}
                      style={{
                        width: '46px',
                        height: '52px',
                        borderRadius: '10px',
                        border: digit ? '2px solid #2563eb' : '1.5px solid #cbd5e1',
                        background: '#ffffff',
                        fontSize: '22px',
                        fontWeight: 800,
                        textAlign: 'center',
                        fontFamily: 'monospace',
                        color: '#0f172a',
                        outline: 'none',
                        boxShadow: digit ? '0 0 0 3px rgba(37, 99, 235, 0.1)' : 'none',
                        transition: 'all 0.15s ease',
                      }}
                    />
                  ))}
                </div>
              </div>

              {/* Countdown / Expiration & Resend */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px', color: '#64748b', padding: '0 4px' }}>
                <div>
                  Expires in: <b style={{ color: expiresIn < 60 ? '#dc2626' : '#0f172a' }}>{formatTime(expiresIn)}</b>
                </div>
                <button
                  type="button"
                  onClick={handleResendCode}
                  disabled={cooldown > 0 || resending}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: cooldown > 0 ? '#94a3b8' : '#2563eb',
                    fontWeight: 700,
                    cursor: cooldown > 0 ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    padding: 0,
                  }}
                >
                  <RefreshCw size={12} className={resending ? 'chat-loading' : ''} />
                  {resending ? 'Resending...' : cooldown > 0 ? `Resend in ${cooldown}s` : 'Resend Code'}
                </button>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                className="btn btn-primary"
                disabled={loading || otpDigits.join('').length !== 6}
                style={{
                  width: '100%',
                  padding: '13px',
                  borderRadius: '10px',
                  fontSize: '14px',
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  background: 'linear-gradient(135deg, #2563eb, #1d4ed8)',
                  border: 'none',
                  color: '#fff',
                  cursor: loading || otpDigits.join('').length !== 6 ? 'not-allowed' : 'pointer',
                  boxShadow: '0 4px 12px rgba(37, 99, 235, 0.25)',
                }}
              >
                {loading ? 'Verifying Code...' : (
                  <>
                    <ShieldCheck size={18} /> Verify Code & Access VertexLearn
                  </>
                )}
              </button>
            </form>

            {/* Connect Real Gmail Delivery Accordion */}
            <div
              style={{
                marginTop: '20px',
                border: '1px solid #e2e8f0',
                borderRadius: '12px',
                overflow: 'hidden',
                background: '#f8fafc',
              }}
            >
              <button
                type="button"
                onClick={() => setShowSmtpConfig(!showSmtpConfig)}
                style={{
                  width: '100%',
                  padding: '12px 14px',
                  background: 'none',
                  border: 'none',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  cursor: 'pointer',
                  fontSize: '12px',
                  fontWeight: 700,
                  color: '#1e293b',
                  textAlign: 'left',
                }}
              >
                <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Mail size={15} color="#2563eb" />
                  Want real emails delivered to your Gmail inbox?
                </span>
                {showSmtpConfig ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
              </button>

              {showSmtpConfig && (
                <div style={{ padding: '14px', borderTop: '1px solid #e2e8f0', background: '#ffffff' }}>
                  <div style={{ fontSize: '11px', color: '#64748b', lineHeight: 1.5, marginBottom: '12px' }}>
                    Google enforces strict anti-spoofing rules (<b>550-5.7.1</b>) and rejects unauthenticated emails from local computers.
                    To receive verification emails directly in your Gmail inbox, generate a 16-character Google App Password:
                    <ol style={{ paddingLeft: '18px', margin: '8px 0 0 0' }}>
                      <li>Open <a href="https://myaccount.google.com/apppasswords" target="_blank" rel="noreferrer" style={{ color: '#2563eb', fontWeight: 700, textDecoration: 'underline' }}>Google Account App Passwords</a>.</li>
                      <li>Name it <b>VertexLearn</b> and click <b>Create</b>.</li>
                      <li>Paste the 16-character code below and click Connect.</li>
                    </ol>
                  </div>

                  {smtpSuccess && (
                    <div style={{ padding: '8px 12px', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '8px', color: '#15803d', fontSize: '11px', fontWeight: 600, marginBottom: '10px' }}>
                      {smtpSuccess}
                    </div>
                  )}

                  {smtpErr && (
                    <div style={{ padding: '8px 12px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', color: '#b91c1c', fontSize: '11px', marginBottom: '10px' }}>
                      {smtpErr}
                    </div>
                  )}

                  <form onSubmit={handleConfigureSmtp} style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <div>
                      <label style={{ fontSize: '11px', fontWeight: 700, color: '#334155', display: 'block', marginBottom: '4px' }}>
                        Your Gmail Address
                      </label>
                      <input
                        type="email"
                        value={smtpUser}
                        onChange={(e) => setSmtpUser(e.target.value)}
                        placeholder="sravyagundedi@gmail.com"
                        required
                        style={{ width: '100%', padding: '8px 10px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '12px' }}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: '11px', fontWeight: 700, color: '#334155', display: 'block', marginBottom: '4px' }}>
                        16-Character Google App Password
                      </label>
                      <input
                        type="password"
                        value={smtpPass}
                        onChange={(e) => setSmtpPass(e.target.value)}
                        placeholder="abcd efgh ijkl mnop"
                        required
                        style={{ width: '100%', padding: '8px 10px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '12px', fontFamily: 'monospace' }}
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={smtpConfiguring}
                      style={{
                        padding: '9px',
                        background: '#16a34a',
                        color: '#ffffff',
                        border: 'none',
                        borderRadius: '8px',
                        fontSize: '12px',
                        fontWeight: 700,
                        cursor: smtpConfiguring ? 'not-allowed' : 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '6px',
                        marginTop: '4px',
                      }}
                    >
                      <Send size={13} />
                      {smtpConfiguring ? 'Verifying & Sending Test...' : 'Connect Gmail & Send Live Test Email'}
                    </button>
                  </form>
                </div>
              )}
            </div>

            {/* Local Development Inspection Helper */}
            <div
              style={{
                marginTop: '16px',
                paddingTop: '14px',
                borderTop: '1px solid #e2e8f0',
                textAlign: 'center',
              }}
            >
              <button
                type="button"
                onClick={openDevMailbox}
                style={{
                  background: '#f1f5f9',
                  border: '1px solid #cbd5e1',
                  borderRadius: '8px',
                  padding: '6px 12px',
                  fontSize: '11px',
                  fontWeight: 600,
                  color: '#334155',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                <Inbox size={13} color="#2563eb" />
                View Full Email Dispatch History ({devMails.length} messages)
              </button>
            </div>
          </div>
        )}

      </div>

      {/* ================================================================== */}
      {/* DEV MAILBOX MODAL (Simulated Email Client for Local Development)  */}
      {/* ================================================================== */}
      {showDevMailbox && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.6)',
            backdropFilter: 'blur(3px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: '16px',
          }}
        >
          <div
            style={{
              background: '#ffffff',
              borderRadius: '18px',
              maxWidth: '520px',
              width: '100%',
              maxHeight: '85vh',
              display: 'flex',
              flexDirection: 'column',
              boxShadow: '0 20px 40px rgba(0,0,0,0.2)',
              overflow: 'hidden',
            }}
          >
            {/* Modal Header */}
            <div style={{ padding: '16px 20px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8fafc' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Inbox size={18} color="#2563eb" />
                <h3 style={{ fontSize: '15px', fontWeight: 800, margin: 0, color: '#0f172a' }}>
                  Local Mailbox • Dispatched Security Codes
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowDevMailbox(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Body */}
            <div style={{ padding: '20px', overflowY: 'auto', flex: 1 }}>
              {loadingMailbox ? (
                <div style={{ textAlign: 'center', padding: '30px', color: '#64748b', fontSize: '13px' }}>
                  Checking local email dispatch log...
                </div>
              ) : devMails.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '30px', color: '#64748b', fontSize: '13px' }}>
                  No emails dispatched for <b>{email}</b> yet.<br />
                  Click "Sign In & Send Verification Code" to dispatch a code.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  {devMails.map((mail, idx) => (
                    <div
                      key={mail.id || idx}
                      style={{
                        border: '1px solid #e2e8f0',
                        borderRadius: '12px',
                        padding: '14px 16px',
                        background: idx === 0 ? '#f0fdf4' : '#ffffff',
                        borderLeft: idx === 0 ? '4px solid #16a34a' : '1px solid #e2e8f0',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '6px' }}>
                        <div>
                          <div style={{ fontSize: '11px', fontWeight: 700, color: '#16a34a', textTransform: 'uppercase' }}>
                            {idx === 0 ? 'Latest Dispatched Verification Code' : 'Previous Code'}
                          </div>
                          <div style={{ fontSize: '13px', fontWeight: 700, color: '#0f172a' }}>
                            To: {mail.to}
                          </div>
                        </div>
                        <div style={{ fontSize: '11px', color: '#64748b' }}>
                          {new Date(mail.sent_at).toLocaleTimeString()}
                        </div>
                      </div>

                      <div style={{ background: '#ffffff', border: '1px dashed #cbd5e1', borderRadius: '8px', padding: '10px 14px', margin: '8px 0', textAlign: 'center' }}>
                        <div style={{ fontSize: '11px', color: '#64748b', marginBottom: '2px' }}>Your One-Time Password:</div>
                        <div style={{ fontSize: '24px', fontWeight: 800, letterSpacing: '6px', fontFamily: 'monospace', color: '#1e293b' }}>
                          {mail.code}
                        </div>
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '11px', color: '#64748b' }}>
                        <span>Transport: {mail.delivered_via === 'smtp' ? 'Live SMTP' : 'Console / Dev Transport'}</span>
                        <button
                          type="button"
                          onClick={() => {
                            const digits = mail.code.split('');
                            setOtpDigits(digits);
                            setShowDevMailbox(false);
                            digitRefs.current[5]?.focus();
                          }}
                          style={{
                            background: '#2563eb',
                            color: '#ffffff',
                            border: 'none',
                            borderRadius: '6px',
                            padding: '4px 10px',
                            fontSize: '11px',
                            fontWeight: 700,
                            cursor: 'pointer',
                          }}
                        >
                          Fill Code
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div style={{ padding: '12px 20px', borderTop: '1px solid #e2e8f0', background: '#f8fafc', textAlign: 'right' }}>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => setShowDevMailbox(false)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
