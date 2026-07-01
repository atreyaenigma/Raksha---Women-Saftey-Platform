import { useState, useEffect, useRef } from 'react';
import { PhoneCall, CheckCircle2, AlertTriangle, Clock, Users, Mic, LocateFixed, MapPin } from 'lucide-react';
import { useApp } from '../context/AppContext';
import LiveMap from '../components/LiveMap';
import './SosCenter.css';

export default function SosCenter() {
  const { sosActive, triggerSos, cancelSos, contacts, location, geoStatus, requestLiveLocation, recording } = useApp();
  const [holding, setHolding] = useState(false);
  const [progress, setProgress] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [notified, setNotified] = useState([]);
  const holdTimer = useRef(null);
  const tickTimer = useRef(null);

  // hold-to-confirm logic (1.4s press to avoid accidental trigger)
  useEffect(() => {
    if (holding && !sosActive) {
      let p = 0;
      holdTimer.current = setInterval(() => {
        p += 4;
        setProgress(p);
        if (p >= 100) {
          clearInterval(holdTimer.current);
          triggerSos();
          setProgress(0);
          setHolding(false);
        }
      }, 35);
    }
    return () => clearInterval(holdTimer.current);
  }, [holding, sosActive, triggerSos]);

  useEffect(() => {
    if (!holding) {
      clearInterval(holdTimer.current);
      setProgress(0);
    }
  }, [holding]);

  // elapsed timer + staged contact notification once active
  useEffect(() => {
    if (sosActive) {
      setElapsed(0);
      setNotified([]);
      tickTimer.current = setInterval(() => setElapsed((e) => e + 1), 1000);
      contacts.forEach((c, i) => {
        setTimeout(() => setNotified((prev) => [...prev, c.id]), 600 + i * 500);
      });
    } else {
      clearInterval(tickTimer.current);
    }
    return () => clearInterval(tickTimer.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sosActive]);

  const fmtTime = (s) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

  return (
    <section className="sosc">
      <div className="container sosc__inner">
        <div className="sosc__head">
          <span className={`sosc__status ${sosActive ? 'sosc__status--active' : ''}`}>
            {sosActive ? <AlertTriangle size={14} /> : <CheckCircle2 size={14} />}
            {sosActive ? 'Emergency alert active' : 'All clear — system armed'}
          </span>
          <h1>SOS Center</h1>
          <p>Hold the button for a second and a half to confirm — that's enough to stop accidental taps, fast enough not to slow you down.</p>
        </div>

        <div className="sosc__grid">
          <div className="sosc__panel sosc__trigger">
            <div className={`sosc__btn-wrap ${sosActive ? 'is-active' : ''}`}>
              <svg className="sosc__ring-progress" viewBox="0 0 140 140">
                <circle cx="70" cy="70" r="64" className="sosc__ring-track" />
                <circle
                  cx="70" cy="70" r="64"
                  className="sosc__ring-fill"
                  style={{ strokeDashoffset: 402 - (402 * progress) / 100 }}
                />
              </svg>
              <button
                className="sosc__btn"
                disabled={sosActive}
                onMouseDown={() => setHolding(true)}
                onMouseUp={() => setHolding(false)}
                onMouseLeave={() => setHolding(false)}
                onTouchStart={() => setHolding(true)}
                onTouchEnd={() => setHolding(false)}
              >
                {sosActive ? fmtTime(elapsed) : 'HOLD\nSOS'}
              </button>
            </div>

            {sosActive ? (
              <button className="btn btn--ghost sosc__cancel" onClick={cancelSos}>
                Mark myself safe — end alert
              </button>
            ) : (
              <p className="sosc__hint">Press and hold — release early to cancel.</p>
            )}
          </div>

          <div className="sosc__panel sosc__map">
            <LiveMap
              lat={location.lat}
              lng={location.lng}
              label={location.label}
              live={location.live}
              pulse={sosActive}
              height={220}
            />
            <div className="sosc__map-info">
              <MapPin size={14} />
              <span>{location.label}</span>
              {recording && (
                <span className="sosc__recording"><Mic size={12} /> Recording audio</span>
              )}
            </div>
            <button className="sosc__locate-btn" onClick={requestLiveLocation}>
              <LocateFixed size={13} />
              {geoStatus === 'live' ? 'Refresh live location' : geoStatus === 'locating' ? 'Locating…' : 'Use my real location'}
            </button>
          </div>

          <div className="sosc__panel sosc__contacts">
            <h3><Users size={16} /> Notification trail</h3>
            <ul>
              {contacts.map((c) => {
                const isNotified = notified.includes(c.id);
                const pending = sosActive && !isNotified;
                return (
                  <li key={c.id} className={isNotified ? 'is-notified' : ''}>
                    <div className="sosc__avatar">{c.name.charAt(0)}</div>
                    <div className="sosc__contact-meta">
                      <strong>{c.name}</strong>
                      <span>{c.relation}</span>
                    </div>
                    <span className={`sosc__pill ${isNotified ? 'sosc__pill--ok' : pending ? 'sosc__pill--pending' : ''}`}>
                      {isNotified ? 'Notified' : pending ? 'Notifying…' : 'Standby'}
                    </span>
                  </li>
                );
              })}
            </ul>
            <a className="sosc__call-link" href="tel:112"><PhoneCall size={14} /> Call emergency services — 112</a>
          </div>
        </div>

        <HistoryPanel />
      </div>
    </section>
  );
}

function HistoryPanel() {
  const { history } = useApp();
  if (!history.length) return null;
  return (
    <div className="sosc__history">
      <h3><Clock size={16} /> Recent alerts</h3>
      <ul>
        {history.slice(0, 5).map((h) => (
          <li key={h.id}>
            <span className="sosc__history-dot" />
            <div>
              <strong>{h.type}</strong>
              <span>{h.location} · {new Date(h.time).toLocaleString()}</span>
            </div>
            <span className="sosc__history-status">{h.status}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
