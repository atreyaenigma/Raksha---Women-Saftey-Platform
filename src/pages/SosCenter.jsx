import { useState, useEffect, useRef, useCallback } from 'react';
import { PhoneCall, CheckCircle2, AlertTriangle, Clock, Users, Mic, LocateFixed, MapPin, ExternalLink, Loader2, RefreshCw } from 'lucide-react';
import { useApp } from '../context/AppContext';
import LiveMap from '../components/LiveMap';
import './SosCenter.css';

const mapsUrl = (lat, lng) => `https://www.google.com/maps?q=${lat},${lng}`;

export default function SosCenter() {
  const {
    sosActive, triggerSos, cancelSos, contacts, location, geoStatus, requestLiveLocation, recording,
    recordingKind, mediaStream, lastAlert, sosDispatching, backendOnline,
  } = useApp();
  const [holding, setHolding] = useState(false);
  const [progress, setProgress] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [demoNotified, setDemoNotified] = useState([]); // only used when there's no backend to report real status
  const holdTimer = useRef(null);
  const tickTimer = useRef(null);
  const videoRef = useRef(null);

  // Attach the real live camera+mic stream (from AppContext) to the preview <video>
  // element so the person can see exactly what's being captured as evidence.
  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;
    el.srcObject = mediaStream || null;
    if (mediaStream) el.play?.().catch(() => {});
  }, [mediaStream]);

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

  // elapsed timer. The demo staged reveal below only runs when we have no backend to
  // report real SMS status from — it's clearly labeled as a simulation in the UI.
  useEffect(() => {
    if (sosActive) {
      setElapsed(0);
      setDemoNotified([]);
      tickTimer.current = setInterval(() => setElapsed((e) => e + 1), 1000);
      if (!backendOnline) {
        contacts.forEach((c, i) => {
          setTimeout(() => setDemoNotified((prev) => [...prev, c.id]), 600 + i * 500);
        });
      }
    } else {
      clearInterval(tickTimer.current);
    }
    return () => clearInterval(tickTimer.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sosActive, backendOnline]);

  const fmtTime = (s) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

  // Real per-contact SMS status, straight from the backend's Twilio dispatch result —
  // not a simulation. Falls back to the demo staged reveal only when there's no backend.
  const statusForContact = (contactId) => {
    if (backendOnline) {
      if (sosActive && sosDispatching) return { label: 'Sending…', tone: 'pending' };
      const result = lastAlert?.notified?.find((n) => n.contactId === contactId);
      if (!result) return sosActive ? { label: 'Sending…', tone: 'pending' } : { label: 'Standby', tone: '' };
      if (result.status === 'sent')   return { label: 'SMS sent', tone: 'ok' };
      if (result.status === 'mock')   return { label: 'Logged (Twilio not set up)', tone: 'pending' };
      if (result.status === 'failed') return { label: `Failed: ${result.error || 'unknown error'}`, tone: 'failed' };
      return { label: result.status, tone: '' };
    }
    const isNotified = demoNotified.includes(contactId);
    const pending = sosActive && !isNotified;
    return isNotified
      ? { label: 'Notified (demo)', tone: 'ok' }
      : pending ? { label: 'Notifying… (demo)', tone: 'pending' } : { label: 'Standby', tone: '' };
  };

  const hasCoords = Number.isFinite(location.lat) && Number.isFinite(location.lng);

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
          {!backendOnline && (
            <p className="sosc__backend-note">
              Backend not connected — this runs in local demo mode, so contact notifications below are simulated, not real SMS. Connect the server to send real alerts.
            </p>
          )}
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
            {sosActive && (
              <div className="sosc__video-preview">
                <video
                  ref={videoRef}
                  className={recordingKind === 'av' ? '' : 'is-hidden'}
                  autoPlay
                  muted
                  playsInline
                />
                {recordingKind === 'av' && (
                  <span className="sosc__video-badge sosc__video-badge--live">
                    <Mic size={11} /> Recording live video &amp; audio
                  </span>
                )}
                {recordingKind === 'audio' && (
                  <span className="sosc__video-badge">
                    <Mic size={11} /> Camera unavailable — recording audio only
                  </span>
                )}
                {!recording && (
                  <span className="sosc__video-badge sosc__video-badge--off">
                    Evidence recording unavailable — check camera/mic permissions
                  </span>
                )}
              </div>
            )}
            <LiveMap
              lat={location.lat}
              lng={location.lng}
              label={location.label}
              live={location.live}
              pulse={sosActive}
              height={220}
              status={geoStatus}
              onRetry={requestLiveLocation}
            />
            <div className="sosc__map-info">
              <MapPin size={14} />
              {hasCoords ? (
                <a href={mapsUrl(location.lat, location.lng)} target="_blank" rel="noreferrer" className="sosc__coords-link">
                  {location.lat.toFixed(5)}, {location.lng.toFixed(5)} <ExternalLink size={11} />
                </a>
              ) : (
                <span>{location.label}</span>
              )}
              {recording && (
                <span className="sosc__recording">
                  <Mic size={12} /> {recordingKind === 'av' ? 'Recording video & audio' : 'Recording audio'}
                </span>
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
                const st = statusForContact(c.id);
                return (
                  <li key={c.id} className={st.tone === 'ok' ? 'is-notified' : ''}>
                    <div className="sosc__avatar">{c.name.charAt(0)}</div>
                    <div className="sosc__contact-meta">
                      <strong>{c.name}</strong>
                      <span>{c.relation}</span>
                    </div>
                    <span className={`sosc__pill ${st.tone ? `sosc__pill--${st.tone}` : ''}`}>{st.label}</span>
                  </li>
                );
              })}
            </ul>
            <a className="sosc__call-link" href="tel:112"><PhoneCall size={14} /> Call emergency services — 112</a>
          </div>
        </div>

        <AlertsLog />
        <HistoryPanel />
      </div>
    </section>
  );
}

// Real, backend-sourced log of past alerts — each with the exact coordinates that were
// sent (tap to open in Google Maps) and the true per-contact SMS delivery result. This
// is what actually happened, not a client-side simulation.
function AlertsLog() {
  const { fetchAlerts, backendOnline, lastAlert } = useApp();
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const rows = await fetchAlerts();
    setAlerts(rows || []);
    setLoading(false);
  }, [fetchAlerts]);

  useEffect(() => { if (backendOnline) load(); }, [backendOnline, load]);
  // Re-pull the log right after a new alert finishes dispatching, so this reflects
  // the real SMS result in near-real-time rather than requiring a manual refresh.
  useEffect(() => { if (backendOnline && lastAlert) load(); }, [lastAlert, backendOnline, load]);

  if (!backendOnline) {
    return (
      <div className="sosc__history">
        <h3><Clock size={16} /> SMS delivery log</h3>
        <p className="sosc__log-empty">Connect the backend to see real, per-contact SMS delivery status here.</p>
      </div>
    );
  }

  return (
    <div className="sosc__history">
      <div className="sosc__log-head">
        <h3><Clock size={16} /> SMS delivery log</h3>
        <button type="button" className="sosc__refresh-btn" onClick={load} disabled={loading}>
          {loading ? <Loader2 size={13} className="sosc__spin" /> : <RefreshCw size={13} />} Refresh
        </button>
      </div>
      {alerts.length === 0 ? (
        <p className="sosc__log-empty">No alerts dispatched yet — trigger the SOS button to see real delivery status here.</p>
      ) : (
        <ul className="sosc__log-list">
          {alerts.slice(0, 6).map((a) => {
            const sent = a.notified?.filter((n) => n.status === 'sent').length ?? 0;
            const mock = a.notified?.filter((n) => n.status === 'mock').length ?? 0;
            const failed = a.notified?.filter((n) => n.status === 'failed').length ?? 0;
            return (
              <li key={a.id}>
                <span className="sosc__history-dot" />
                <div>
                  <a href={mapsUrl(a.lat, a.lng)} target="_blank" rel="noreferrer" className="sosc__coords-link">
                    {a.lat.toFixed(5)}, {a.lng.toFixed(5)} <ExternalLink size={11} />
                  </a>
                  <span>{new Date(a.time).toLocaleString()} · via {a.triggeredBy}{a.note ? ` — ${a.note}` : ''}</span>
                </div>
                <span className="sosc__log-counts">
                  {sent > 0 && <span className="sosc__pill sosc__pill--ok">{sent} sent</span>}
                  {mock > 0 && <span className="sosc__pill sosc__pill--pending">{mock} logged</span>}
                  {failed > 0 && <span className="sosc__pill sosc__pill--failed">{failed} failed</span>}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function HistoryPanel() {
  const { history } = useApp();
  if (!history.length) return null;
  return (
    <div className="sosc__history">
      <h3><Clock size={16} /> Recent activity</h3>
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
