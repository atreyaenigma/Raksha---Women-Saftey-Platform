// In development: Vite proxies /api → localhost:4000 automatically.
// In production: set VITE_API_URL=https://your-backend.railway.app/api
const BASE = import.meta.env.VITE_API_URL || '/api';

async function request(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) throw new Error(`API ${path} → ${res.status}`);
  if (res.status === 204) return null;
  return res.json();
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
};

// Calls fn() and silently returns `fallback` if the backend is unreachable.
export async function tryApi(fn, fallback) {
  try { return await fn(); }
  catch { return fallback; }
}
