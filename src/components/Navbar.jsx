import { useState, useEffect } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { ShieldHalf, Menu, X, ChevronDown, LogOut, ShieldCheck, User as UserIcon } from 'lucide-react';
import { useApp } from '../context/AppContext';
import './Navbar.css';

export default function Navbar() {
  const [open, setOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const { sosActive, backendOnline, auth, logout } = useApp();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const links = [
    { to: '/', label: 'Home' },
    { to: '/dashboard', label: 'Dashboard' },
    { to: '/contacts', label: 'Contacts' },
  ];

  const moreLinks = [
    { to: '/sos', label: 'SOS Center' },
    { to: '/walk-with-me', label: 'Walk With Me' },
    { to: '/police-stations', label: 'Nearby Help' },
    { to: '/routes/rate', label: 'Route Safety' },
    { to: '/settings', label: 'Settings' },
  ];

  return (
    <header className={`nav ${scrolled ? 'nav--scrolled' : ''}`}>
      <div className="container nav__inner">
        <Link to="/" className="nav__brand" onClick={() => setOpen(false)}>
          <ShieldHalf size={22} strokeWidth={2.2} />
          <span>Raksha<span className="nav__brand-accent">Link</span></span>
        </Link>

        <span className={`nav__backend-badge ${backendOnline ? 'is-online' : ''}`} title={backendOnline ? 'Connected to alert server' : 'Offline mode — alerts stay on this device'}>
          <span className="nav__backend-dot" /> {backendOnline ? 'Server connected' : 'Offline mode'}
        </span>

        <nav className={`nav__links ${open ? 'nav__links--open' : ''}`}>
          {links.map((l) => (
            <NavLink
              key={l.to}
              to={l.to}
              className={({ isActive }) => `nav__link ${isActive ? 'nav__link--active' : ''}`}
              onClick={() => setOpen(false)}
            >
              {l.label}
            </NavLink>
          ))}

          <div className="nav__more" onMouseEnter={() => setMoreOpen(true)} onMouseLeave={() => setMoreOpen(false)}>
            <button className="nav__link nav__more-trigger" onClick={() => setMoreOpen((o) => !o)}>
              More <ChevronDown size={14} />
            </button>
            <div className={`nav__more-menu ${moreOpen ? 'is-open' : ''}`}>
              {moreLinks.map((l) => (
                <NavLink key={l.to} to={l.to} className="nav__more-item" onClick={() => { setOpen(false); setMoreOpen(false); }}>
                  {l.label}
                </NavLink>
              ))}
            </div>
          </div>

          <Link to="/sos" className="nav__cta" onClick={() => setOpen(false)}>
            {sosActive ? (
              <span className="nav__cta-live">● Live SOS</span>
            ) : (
              'Activate SOS'
            )}
          </Link>

          {auth ? (
            <div className="nav__account">
              {auth.role === 'admin' && (
                <NavLink to="/admin" className="nav__link" onClick={() => setOpen(false)}>
                  Admin Panel
                </NavLink>
              )}
              <span className="nav__account-badge" title={auth.email}>
                {auth.role === 'admin' ? <ShieldCheck size={13} /> : <UserIcon size={13} />}
                {auth.name}
              </span>
              <button className="nav__account-logout" onClick={() => { logout(); setOpen(false); }} aria-label="Log out">
                <LogOut size={14} />
              </button>
            </div>
          ) : (
            <Link to="/login" className="nav__link nav__login" onClick={() => setOpen(false)}>
              Log in
            </Link>
          )}
        </nav>

        <button className="nav__burger" onClick={() => setOpen((o) => !o)} aria-label="Toggle menu">
          {open ? <X size={22} /> : <Menu size={22} />}
        </button>
      </div>
    </header>
  );
}
