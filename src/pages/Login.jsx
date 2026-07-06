import { useState, useRef, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  ShieldHalf, Mail, Lock, Eye, EyeOff, User, ShieldCheck,
  ArrowRight, Loader2, CheckCircle2, LogOut,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import './Login.css';

const ADMIN_DEMO_EMAIL = 'admin@rakshalink.app';
const ADMIN_DEMO_PASSWORD = 'Admin@123';

const ROLES = [
  { id: 'user', label: 'User', icon: User, blurb: 'Access your safety circle, SOS Center, and live location tools.' },
  { id: 'admin', label: 'Admin', icon: ShieldCheck, blurb: 'Monitor alerts, manage help desks, and oversee the platform.' },
];

export default function Login() {
  const { auth, login, logout } = useApp();
  const navigate = useNavigate();

  const [role, setRole] = useState('user');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [status, setStatus] = useState('idle'); // idle | submitting | success | error
  const [error, setError] = useState('');
  const [shake, setShake] = useState(false);

  const roleIndex = ROLES.findIndex((r) => r.id === role);
  const shakeTimer = useRef(null);
  useEffect(() => () => clearTimeout(shakeTimer.current), []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (status === 'submitting' || status === 'success') return;
    setStatus('submitting');
    setError('');

    const res = await login({ email, password, role });

    if (!res.ok) {
      setStatus('error');
      setError(res.error);
      setShake(true);
      clearTimeout(shakeTimer.current);
      shakeTimer.current = setTimeout(() => setShake(false), 500);
      return;
    }

    setStatus('success');
    setTimeout(() => navigate(role === 'admin' ? '/admin' : '/dashboard'), 650);
  };

  // Already signed in — offer to continue or switch accounts instead of re-showing the form.
  if (auth && status === 'idle') {
    const RoleIcon = auth.role === 'admin' ? ShieldCheck : User;
    return (
      <section className="login">
        <div className="login__ambient" aria-hidden="true">
          <span className="login__ring login__ring--1" />
          <span className="login__ring login__ring--2" />
          <span className="login__ring login__ring--3" />
        </div>
        <div className="login__card login__card--session">
          <div className="login__session-icon"><RoleIcon size={26} /></div>
          <h1>Welcome back, {auth.name}</h1>
          <p>You're signed in as <strong>{auth.role === 'admin' ? 'Admin' : 'User'}</strong>.</p>
          <div className="login__session-actions">
            <button className="btn btn--primary" onClick={() => navigate(auth.role === 'admin' ? '/admin' : '/dashboard')}>
              {auth.role === 'admin' ? 'Go to admin panel' : 'Continue to dashboard'} <ArrowRight size={16} />
            </button>
            <button className="btn btn--ghost" onClick={logout}>
              <LogOut size={15} /> Log out &amp; switch account
            </button>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="login">
      <div className="login__ambient" aria-hidden="true">
        <span className="login__ring login__ring--1" />
        <span className="login__ring login__ring--2" />
        <span className="login__ring login__ring--3" />
      </div>

      <div className="login__layout">
        <div className="login__brand">
          <Link to="/" className="login__brand-mark">
            <ShieldHalf size={26} strokeWidth={2.2} />
            <span>Raksha<span className="login__brand-accent">Link</span></span>
          </Link>
          <h2>Emergency SOS &amp; live location alerts, built for the moments that can't wait.</h2>
          <p className="login__brand-sub">
            Sign in to manage your safety circle, or as an admin to oversee alerts across the
            platform.
          </p>
        </div>

        <form className={`login__card ${shake ? 'is-shaking' : ''}`} onSubmit={handleSubmit}>
          <div className="login__tabs" role="tablist" aria-label="Sign in as">
            <span className="login__tabs-pill" style={{ transform: `translateX(${roleIndex * 100}%)` }} />
            {ROLES.map((r) => (
              <button
                key={r.id}
                type="button"
                role="tab"
                aria-selected={role === r.id}
                className={`login__tab ${role === r.id ? 'is-active' : ''}`}
                onClick={() => { setRole(r.id); setError(''); setStatus('idle'); }}
              >
                <r.icon size={15} /> {r.label}
              </button>
            ))}
          </div>

          <p className="login__role-blurb">{ROLES[roleIndex].blurb}</p>

          <label className="login__field">
            Email
            <div className="login__input-wrap">
              <Mail size={16} className="login__input-icon" />
              <input
                type="email"
                placeholder="you@example.com"
                value={email}
                autoComplete="email"
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
          </label>

          <label className="login__field">
            Password
            <div className="login__input-wrap">
              <Lock size={16} className="login__input-icon" />
              <input
                type={showPassword ? 'text' : 'password'}
                placeholder="At least 6 characters"
                value={password}
                autoComplete="current-password"
                onChange={(e) => setPassword(e.target.value)}
              />
              <button
                type="button"
                className="login__toggle-visibility"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
          </label>

          {error && <span className="login__error">{error}</span>}

          <button className="btn btn--primary login__submit" disabled={status === 'submitting' || status === 'success'}>
            {status === 'submitting' ? (
              <><Loader2 size={17} className="login__spin" /> Signing in…</>
            ) : status === 'success' ? (
              <><CheckCircle2 size={17} /> Signed in</>
            ) : (
              <>Sign in as {ROLES[roleIndex].label} <ArrowRight size={16} /></>
            )}
          </button>

          {role === 'admin' ? (
            <p className="login__demo-hint">
              Demo admin account — <strong>{ADMIN_DEMO_EMAIL}</strong> / <strong>{ADMIN_DEMO_PASSWORD}</strong>.
              {' '}
              <button
                type="button"
                className="login__prefill"
                onClick={() => { setEmail(ADMIN_DEMO_EMAIL); setPassword(ADMIN_DEMO_PASSWORD); }}
              >
                Fill in
              </button>
            </p>
          ) : (
            <p className="login__demo-hint">
              New here? <Link to="/register" className="login__prefill">Create a user account</Link> to save your
              contacts and history to the server.
            </p>
          )}
          <p className="login__demo-hint">
            If the server is unreachable, sign-in falls back to a local demo mode — any email and a
            6-character password will work.
          </p>
        </form>
      </div>
    </section>
  );
}
