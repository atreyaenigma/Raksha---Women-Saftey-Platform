import { Link } from 'react-router-dom';
import { ShieldCheck, Users, History, MapPin, Siren, ArrowRight, Footprints, LocateFixed } from 'lucide-react';
import { useApp } from '../context/AppContext';
import LiveMap from '../components/LiveMap';
import './Dashboard.css';

export default function Dashboard() {
  const { contacts, history, sosActive, location, checkIn, geoStatus, requestLiveLocation } = useApp();

  const stats = [
    { icon: Siren, label: 'Active alerts', value: sosActive ? '1' : '0', tone: sosActive ? 'accent' : 'safe' },
    { icon: Users, label: 'Trusted contacts', value: contacts.length, tone: 'safe' },
    { icon: History, label: 'Logged incidents', value: history.length, tone: 'safe' },
    { icon: ShieldCheck, label: 'System status', value: 'Armed', tone: 'safe' },
  ];

  return (
    <section className="dash">
      <div className="container">
        <div className="dash__head">
          <div>
            <span className="how__eyebrow">Overview</span>
            <h1>Your safety dashboard</h1>
          </div>
          <Link to="/sos" className="btn btn--primary">
            Open SOS Center <ArrowRight size={16} />
          </Link>
        </div>

        <div className="dash__stats">
          {stats.map((s) => (
            <div className={`dash__stat dash__stat--${s.tone}`} key={s.label}>
              <s.icon size={20} />
              <div>
                <strong>{s.value}</strong>
                <span>{s.label}</span>
              </div>
            </div>
          ))}
        </div>

        <div className="dash__grid">
          <div className="dash__panel dash__panel--wide">
            <div className="dash__panel-title-row">
              <h3><MapPin size={16} /> Current location</h3>
              <button
                type="button"
                className="dash__locate-btn"
                onClick={requestLiveLocation}
                disabled={geoStatus === 'locating'}
              >
                <LocateFixed size={13} />
                {geoStatus === 'live' || geoStatus === 'watching'
                  ? 'Refresh location'
                  : geoStatus === 'locating'
                    ? 'Locating…'
                    : 'Use current location'}
              </button>
            </div>
            <LiveMap
              lat={location.lat}
              lng={location.lng}
              label={location.label}
              live={location.live}
              pulse={sosActive}
              height={200}
              zoom={14}
              status={geoStatus}
              onRetry={requestLiveLocation}
            />
          </div>

          <div className="dash__panel">
            <h3><Footprints size={16} /> Walk with me</h3>
            {checkIn ? (
              <p className="dash__empty">Active — heading to <strong>{checkIn.destination}</strong>. <Link to="/walk-with-me">View timer →</Link></p>
            ) : (
              <p className="dash__empty">No walk timer running. <Link to="/walk-with-me">Start one →</Link></p>
            )}
          </div>

          <div className="dash__panel">
            <h3><Users size={16} /> Trusted contacts</h3>
            {contacts.length === 0 ? (
              <p className="dash__empty">No contacts yet. <Link to="/contacts">Add your first one →</Link></p>
            ) : (
              <ul className="dash__contact-list">
                {contacts.slice(0, 4).map((c) => (
                  <li key={c.id}>
                    <div className="sosc__avatar">{c.name.charAt(0)}</div>
                    <div>
                      <strong>{c.name}</strong>
                      <span>{c.relation}</span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
            <Link to="/contacts" className="dash__manage-link">Manage contacts →</Link>
          </div>

          <div className="dash__panel dash__panel--wide">
            <h3><History size={16} /> Incident history</h3>
            {history.length === 0 ? (
              <p className="dash__empty">No alerts have been triggered yet. Your history will appear here.</p>
            ) : (
              <table className="dash__table">
                <thead>
                  <tr><th>Type</th><th>Location</th><th>Time</th><th>Status</th></tr>
                </thead>
                <tbody>
                  {history.map((h) => (
                    <tr key={h.id}>
                      <td>{h.type}{h.note && <span className="dash__note">{h.note}</span>}</td>
                      <td>{h.location}</td>
                      <td>{new Date(h.time).toLocaleString()}</td>
                      <td><span className="dash__badge">{h.status}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
