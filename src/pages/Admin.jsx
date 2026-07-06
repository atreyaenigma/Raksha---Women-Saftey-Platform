import { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ShieldCheck, Users, History, Siren, ArrowLeft, Mail, CalendarClock,
  Clock, X, RefreshCcw, User as UserIcon, Lock,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import './Admin.css';

function formatDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

export default function Admin() {
  const { auth, backendOnline, adminFetchUsers, adminFetchUserDetail } = useApp();
  const navigate = useNavigate();

  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState(null);
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const loadUsers = useCallback(async () => {
    setLoading(true);
    const rows = await adminFetchUsers();
    setUsers(rows || []);
    setLoading(false);
  }, [adminFetchUsers]);

  useEffect(() => { if (auth?.role === 'admin') loadUsers(); }, [auth, loadUsers]);

  useEffect(() => {
    if (!selectedId) { setDetail(null); return; }
    let cancelled = false;
    setDetailLoading(true);
    adminFetchUserDetail(selectedId).then((d) => { if (!cancelled) { setDetail(d); setDetailLoading(false); } });
    return () => { cancelled = true; };
  }, [selectedId, adminFetchUserDetail]);

  // ── Access control ─────────────────────────────────────────────────────
  if (!auth) {
    return (
      <section className="admin admin--gate">
        <div className="container admin__gate-card">
          <Lock size={28} />
          <h1>Admin sign-in required</h1>
          <p>Log in with an admin account to view registered users and their history.</p>
          <button className="btn btn--primary" onClick={() => navigate('/login')}>Go to login</button>
        </div>
      </section>
    );
  }

  if (auth.role !== 'admin') {
    return (
      <section className="admin admin--gate">
        <div className="container admin__gate-card">
          <ShieldCheck size={28} />
          <h1>Admins only</h1>
          <p>You're signed in as <strong>{auth.name}</strong>, a User account. Switch to an admin account to access this page.</p>
          <button className="btn btn--primary" onClick={() => navigate('/dashboard')}>Back to dashboard</button>
        </div>
      </section>
    );
  }

  if (!backendOnline) {
    return (
      <section className="admin admin--gate">
        <div className="container admin__gate-card">
          <RefreshCcw size={28} />
          <h1>Server unreachable</h1>
          <p>The admin panel reads live user data from the backend, which is currently offline. Please try again once it reconnects.</p>
        </div>
      </section>
    );
  }

  const totals = {
    users: users.length,
    history: users.reduce((sum, u) => sum + (u.historyCount || 0), 0),
    alerts: users.reduce((sum, u) => sum + (u.alertCount || 0), 0),
  };

  return (
    <section className="admin">
      <div className="container">
        <div className="admin__head">
          <div>
            <span className="how__eyebrow">Admin</span>
            <h1>Registered users &amp; activity</h1>
            <p>Every account on the platform, with their SOS history and alert log.</p>
          </div>
          <button className="btn btn--ghost" onClick={loadUsers} disabled={loading}>
            <RefreshCcw size={15} className={loading ? 'admin__spin' : ''} /> Refresh
          </button>
        </div>

        <div className="admin__stats">
          <div className="admin__stat">
            <Users size={18} />
            <div><strong>{totals.users}</strong><span>Registered users</span></div>
          </div>
          <div className="admin__stat">
            <History size={18} />
            <div><strong>{totals.history}</strong><span>Logged incidents</span></div>
          </div>
          <div className="admin__stat">
            <Siren size={18} />
            <div><strong>{totals.alerts}</strong><span>SOS alerts sent</span></div>
          </div>
        </div>

        <div className="admin__panel">
          <h3><Users size={16} /> All accounts</h3>

          {loading ? (
            <p className="admin__empty">Loading users…</p>
          ) : users.length === 0 ? (
            <p className="admin__empty">No users have registered yet.</p>
          ) : (
            <div className="admin__table-wrap">
              <table className="admin__table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Email</th>
                    <th>Role</th>
                    <th>Joined</th>
                    <th>Last login</th>
                    <th>Incidents</th>
                    <th>Alerts</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => (
                    <tr key={u.id}>
                      <td className="admin__cell-name">
                        {u.role === 'admin' ? <ShieldCheck size={14} /> : <UserIcon size={14} />}
                        {u.name}
                      </td>
                      <td className="admin__cell-muted">{u.email}</td>
                      <td><span className={`admin__badge admin__badge--${u.role}`}>{u.role}</span></td>
                      <td className="admin__cell-muted">{formatDate(u.createdAt)}</td>
                      <td className="admin__cell-muted">{formatDate(u.lastLoginAt)}</td>
                      <td>{u.historyCount}</td>
                      <td>{u.alertCount}</td>
                      <td>
                        <button className="admin__view-btn" onClick={() => setSelectedId(u.id)}>View</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <Link to="/dashboard" className="admin__back-link"><ArrowLeft size={14} /> Back to dashboard</Link>
      </div>

      {selectedId && (
        <div className="admin__drawer-backdrop" onClick={() => setSelectedId(null)}>
          <div className="admin__drawer" onClick={(e) => e.stopPropagation()}>
            <button className="admin__drawer-close" onClick={() => setSelectedId(null)} aria-label="Close">
              <X size={18} />
            </button>

            {detailLoading || !detail ? (
              <p className="admin__empty">Loading profile…</p>
            ) : (
              <>
                <div className="admin__drawer-head">
                  <div className="admin__drawer-icon">
                    {detail.user.role === 'admin' ? <ShieldCheck size={22} /> : <UserIcon size={22} />}
                  </div>
                  <div>
                    <h2>{detail.user.name}</h2>
                    <span className={`admin__badge admin__badge--${detail.user.role}`}>{detail.user.role}</span>
                  </div>
                </div>

                <ul className="admin__drawer-meta">
                  <li><Mail size={14} /> {detail.user.email}</li>
                  <li><CalendarClock size={14} /> Joined {formatDate(detail.user.createdAt)}</li>
                  <li><Clock size={14} /> Last login {formatDate(detail.user.lastLoginAt)}</li>
                </ul>

                <h3 className="admin__drawer-subhead"><Siren size={14} /> SOS alerts ({detail.alerts.length})</h3>
                {detail.alerts.length === 0 ? (
                  <p className="admin__empty">No alerts triggered by this account.</p>
                ) : (
                  <ul className="admin__timeline">
                    {detail.alerts.map((a) => (
                      <li key={a.id}>
                        <strong>{a.locationLabel}</strong>
                        <span>{formatDate(a.time)} · triggered by {a.triggeredBy} · {a.status}</span>
                      </li>
                    ))}
                  </ul>
                )}

                <h3 className="admin__drawer-subhead"><History size={14} /> Incident history ({detail.history.length})</h3>
                {detail.history.length === 0 ? (
                  <p className="admin__empty">No history logged by this account.</p>
                ) : (
                  <ul className="admin__timeline">
                    {detail.history.map((h) => (
                      <li key={h.id}>
                        <strong>{h.type}</strong>
                        <span>{formatDate(h.time)} · {h.location} · {h.status}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
