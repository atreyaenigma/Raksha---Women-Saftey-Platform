import { useState, useRef, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  ShieldHalf, Mail, Lock, User as UserIcon, Eye, EyeOff,
  ArrowRight, Loader2, CheckCircle2,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import './Login.css';

export default function Register() {
  const { auth, register, backendOnline } = useApp();
  const navigate = useNavigate();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [status, setStatus] = useState('idle'); // idle | submitting | success | error
  const [error, setError] = useState('');
  const [shake, setShake] = useState(false);

  const shakeTimer = useRef(null);
  useEffect(() => () => clearTimeout(shakeTimer.current), []);

  // Already signed in — nothing to register, just send them onward.
  useEffect(() => {
    if (auth) navigate(auth.role === 'admin' ? '/admin' : '/dashboard', { replace: true });
  }, [auth, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (status === 'submitting' || status === 'success') return;
    setStatus('submitting');
    setError('');

    const res = await register({ name, email, password });

    if (!res.ok) {
      setStatus('error');
      setError(res.error);
      setShake(true);
      clearTimeout(shakeTimer.current);
      shakeTimer.current = setTimeout(() => setShake(false), 500);
      return;
    }

    setStatus('success');
    setTimeout(() => navigate('/dashboard'), 650);
  };

  if (auth) return null;

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
          <h2>Create your account to save contacts, alerts, and history securely.</h2>
          <p className="login__brand-sub">
            Sign-up creates a regular user account. Admin access is provisioned separately by the
            platform team.
          </p>
        </div>

        <form className={`login__card ${shake ? 'is-shaking' : ''}`} onSubmit={handleSubmit}>
          <p className="login__role-blurb">Set up your RakshaLink account in a few seconds.</p>

          <label className="login__field">
            Full name
            <div className="login__input-wrap">
              <UserIcon size={16} className="login__input-icon" />
              <input
                type="text"
                placeholder="Your name"
                value={name}
                autoComplete="name"
                onChange={(e) => setName(e.target.value)}
              />
            </div>
          </label>

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
                autoComplete="new-password"
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
              <><Loader2 size={17} className="login__spin" /> Creating account…</>
            ) : status === 'success' ? (
              <><CheckCircle2 size={17} /> Account created</>
            ) : (
              <>Create account <ArrowRight size={16} /></>
            )}
          </button>

          <p className="login__demo-hint">
            {backendOnline
              ? <>Already have an account? <Link to="/login" className="login__prefill">Sign in</Link></>
              : 'The server is currently unreachable, so new accounts can\u2019t be created right now. Please try again shortly.'}
          </p>
        </form>
      </div>
    </section>
  );
}
