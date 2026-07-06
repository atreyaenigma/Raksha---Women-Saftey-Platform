// In development: Vite proxies /api → localhost:4000 automatically.
// In production: set VITE_API_URL=https://your-backend.railway.app/api
const BASE = import.meta.env.VITE_API_URL || '/api';

async function request(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
  });
  if (!res.ok) {
    // Prefer the backend's own { error: '...' } message (e.g. "Invalid email or password")
    // over a generic status code so forms like Login can show something useful.
    let message = `API ${path} → ${res.status}`;
    try {
      const body = await res.json();
      if (body?.error) message = body.error;
    } catch { /* body wasn't JSON — keep the generic message */ }
    throw new Error(message);
  }
  if (res.status === 204) return null;
  return res.json();
}

// Builds an Authorization header for authenticated requests. Safe to spread
// into a headers object even when there's no token (spreads to nothing).
function authHeader(token) {
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export const api = {
  health:       ()           => request('/health'),
  getContacts:  ()           => request('/contacts'),
  addContact:   (c)          => request('/contacts',      { method: 'POST',   body: JSON.stringify(c) }),
  removeContact:(id)         => request(`/contacts/${id}`,{ method: 'DELETE' }),
  getHistory:   ()           => request('/history'),
  addHistory:   (e)          => request('/history',       { method: 'POST',   body: JSON.stringify(e) }),
  triggerAlert: (payload)    => request('/alerts/trigger',{ method: 'POST',   body: JSON.stringify(payload) }),
  resolveAlert: (id)         => request(`/alerts/${id}/resolve`, { method: 'POST' }),
  getAlerts:    ()           => request('/alerts'),
  getRouteReviews: (lat, lng, radiusKm = 5) =>
    request(`/routes/reviews${Number.isFinite(lat) ? `?lat=${lat}&lng=${lng}&radiusKm=${radiusKm}` : ''}`),
  addRouteReview: (review)   => request('/routes/reviews', { method: 'POST', body: JSON.stringify(review) }),

  // ── Auth ───────────────────────────────────────────────────────────────
  register:     (data)       => request('/auth/register', { method: 'POST', body: JSON.stringify(data) }),
  login:        (data)       => request('/auth/login',    { method: 'POST', body: JSON.stringify(data) }),
  getMe:        (token)      => request('/auth/me', { headers: authHeader(token) }),

  // ── Admin ────────────────────────────────────────────────────────────────
  adminGetUsers:      (token)     => request('/admin/users', { headers: authHeader(token) }),
  adminGetUserDetail: (id, token) => request(`/admin/users/${id}`, { headers: authHeader(token) }),
};

// Calls fn() and silently returns `fallback` if the backend is unreachable.
export async function tryApi(fn, fallback) {
  try { return await fn(); }
  catch { return fallback; }
}
