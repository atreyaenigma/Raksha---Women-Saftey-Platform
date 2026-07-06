import { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { api, tryApi } from '../api';

const AppContext = createContext(null);

const DEFAULT_CONTACTS = [
  { id: 'c1', name: 'Aanya Kapoor', relation: 'Sister', phone: '+91 98765 43210' },
  { id: 'c2', name: 'Rohan Mehta', relation: 'Friend', phone: '+91 91234 56780' },
  { id: 'c3', name: 'Mom', relation: 'Parent', phone: '+91 99887 76655' },
];

const DEFAULT_SETTINGS = {
  safeWord: 'help me now',
  voiceEnabled: false,
  shakeEnabled: false,
  recordEvidence: true,
  locationWatch: false,
};

function loadJSON(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch { return fallback; }
}

// Straight-line distance between two lat/lng points, in metres (haversine formula).
function distanceMeters(a, b) {
  if (!a || !b) return Infinity;
  const R = 6371000;
  const dLat = (b.lat - a.lat) * Math.PI / 180;
  const dLng = (b.lng - a.lng) * Math.PI / 180;
  const lat1 = a.lat * Math.PI / 180;
  const lat2 = b.lat * Math.PI / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

// How close (in metres) counts as "arrived" for auto check-in during Walk-with-me.
const ARRIVAL_RADIUS_M = 40;
// How often (ms) we ping GPS during an active Walk-with-me session.
const WALK_PING_INTERVAL_MS = 12000; // ~12s — inside the requested 10-15s window

export function AppProvider({ children }) {
  const [contacts, setContacts]   = useState(() => loadJSON('wsap_contacts', DEFAULT_CONTACTS));
  const [history, setHistory]     = useState(() => loadJSON('wsap_history', []));
  const [settings, setSettings]   = useState(() => loadJSON('wsap_settings', DEFAULT_SETTINGS));
  const [auth, setAuth]           = useState(() => loadJSON('wsap_auth', null));
  const [token, setToken]         = useState(() => { try { return localStorage.getItem('wsap_token') || null; } catch { return null; } });
  const [sosActive, setSosActive] = useState(false);
  const [sosStartedAt, setSosStartedAt] = useState(null);
  const [location, setLocation]   = useState({ lat: null, lng: null, label: 'Locating…', live: false, accuracy: null });
  const [geoStatus, setGeoStatus] = useState('idle');
  const [checkIn, setCheckIn]     = useState(null);
  const [walkTrail, setWalkTrail] = useState([]); // periodic GPS pings logged during an active Walk-with-me session
  const [lastPingAt, setLastPingAt] = useState(null);
  const [recording, setRecording] = useState(false);
  const [recordingKind, setRecordingKind] = useState(null); // 'av' | 'audio' | null — what evidence is actually being captured
  const [mediaStream, setMediaStream] = useState(null); // live camera+mic stream, exposed so the UI can show a live preview
  const [backendOnline, setBackendOnline] = useState(false);
  const [lastAlert, setLastAlert] = useState(null); // most recent alert response from the backend — real per-contact SMS status
  const [sosDispatching, setSosDispatching] = useState(false); // true while the SMS dispatch request is in flight

  const recognitionRef = useRef(null);
  const geoWatchRef    = useRef(null);
  const walkPingRef    = useRef(null);
  const mediaRecorderRef = useRef(null);
  const recordedChunksRef = useRef([]);
  const mediaStreamRef  = useRef(null);
  const recordingMimeRef = useRef('video/webm');

  // ── Persist to localStorage ───────────────────────────────────────────────
  useEffect(() => { localStorage.setItem('wsap_contacts', JSON.stringify(contacts)); }, [contacts]);
  useEffect(() => { localStorage.setItem('wsap_history',  JSON.stringify(history));  }, [history]);
  useEffect(() => { localStorage.setItem('wsap_settings', JSON.stringify(settings)); }, [settings]);
  useEffect(() => { localStorage.setItem('wsap_auth',     JSON.stringify(auth));     }, [auth]);
  useEffect(() => {
    if (token) localStorage.setItem('wsap_token', token);
    else localStorage.removeItem('wsap_token');
  }, [token]);

  // ── Backend handshake + initial sync ─────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    let syncedOnce = false;

    const checkBackend = async () => {
      const ok = await tryApi(() => api.health(), null);
      if (cancelled) return;

      if (ok?.ok) {
        setBackendOnline(true);
        if (!syncedOnce) {
          syncedOnce = true;
          const [rc, rh] = await Promise.all([
            tryApi(() => api.getContacts(), null),
            tryApi(() => api.getHistory(),  null),
          ]);
          if (cancelled) return;
          if (rc) setContacts(rc);
          if (rh) setHistory(rh);
        }
      } else {
        setBackendOnline(false);
      }
    };

    checkBackend(); // check immediately on mount
    const interval = setInterval(checkBackend, 5000); // then keep retrying, so we recover if the backend starts late or restarts

    return () => { cancelled = true; clearInterval(interval); };
  }, []);

  // ── Contacts ─────────────────────────────────────────────────────────────
  const addContact = useCallback((contact) => {
    const local = { ...contact, id: 'c' + Date.now() };
    setContacts((prev) => [...prev, local]);
    if (backendOnline) {
      tryApi(() => api.addContact(contact), null).then((remote) => {
        if (remote) setContacts((prev) => prev.map((c) => c.id === local.id ? remote : c));
      });
    }
  }, [backendOnline]);

  const removeContact = useCallback((id) => {
    setContacts((prev) => prev.filter((c) => c.id !== id));
    if (backendOnline) tryApi(() => api.removeContact(id), null);
  }, [backendOnline]);

  // ── History ───────────────────────────────────────────────────────────────
  const logEvent = useCallback((entry) => {
    const local = { id: 'h' + Date.now(), time: new Date().toISOString(), status: 'resolved', ...entry };
    setHistory((prev) => [local, ...prev]);
    if (backendOnline) tryApi(() => api.addHistory(entry), null);
  }, [backendOnline]);

  // ── GPS: one-shot ─────────────────────────────────────────────────────────
  const requestLiveLocation = useCallback(() => {
    if (!('geolocation' in navigator)) { setGeoStatus('unsupported'); return; }
    setGeoStatus('locating');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude, label: 'Live device location', live: true, accuracy: pos.coords.accuracy });
        setGeoStatus('live');
      },
      (err) => { console.warn('GPS error:', err.message); setGeoStatus('denied'); },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  }, []);

  // Fetch a real fix the moment the app loads — no page should ever show a
  // placeholder city as if it were the person's real position.
  useEffect(() => { requestLiveLocation(); }, [requestLiveLocation]);

  // ── GPS: continuous watch ─────────────────────────────────────────────────
  const startLocationWatch = useCallback(() => {
    if (!('geolocation' in navigator)) return;
    if (geoWatchRef.current != null) return; // already watching
    setGeoStatus('watching');
    geoWatchRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude, label: 'Live GPS (continuous)', live: true, accuracy: pos.coords.accuracy });
        setGeoStatus('watching');
      },
      (err) => { console.warn('GPS watch error:', err.message); setGeoStatus('denied'); },
      { enableHighAccuracy: true, maximumAge: 3000, timeout: 10000 }
    );
  }, []);

  const stopLocationWatch = useCallback(() => {
    if (geoWatchRef.current != null) {
      navigator.geolocation.clearWatch(geoWatchRef.current);
      geoWatchRef.current = null;
      setGeoStatus('idle');
    }
  }, []);

  // Auto-start watch based on settings
  useEffect(() => {
    if (settings.locationWatch) startLocationWatch();
    else stopLocationWatch();
    return stopLocationWatch;
  }, [settings.locationWatch, startLocationWatch, stopLocationWatch]);

  // Keep location refreshed during active SOS
  useEffect(() => {
    if (sosActive) startLocationWatch();
    else if (!settings.locationWatch) stopLocationWatch();
  }, [sosActive, settings.locationWatch, startLocationWatch, stopLocationWatch]);

  // ── SOS trigger ───────────────────────────────────────────────────────────
  const triggerSos = useCallback(async (source = 'manual', note = '') => {
    const startedAt = new Date().toISOString();
    setSosActive(true);
    setSosStartedAt(startedAt);
    setLastAlert(null);
    logEvent({ type: 'SOS Triggered', location: location.label, trigger: source, note: note || undefined });

    const hasFix = Number.isFinite(location.lat) && Number.isFinite(location.lng);

    if (backendOnline && hasFix) {
      setSosDispatching(true);
      const alert = await tryApi(() => api.triggerAlert({
        lat: location.lat, lng: location.lng,
        locationLabel: location.label,
        accuracy: location.accuracy,
        triggeredBy: source,
        note: note || undefined,
      }), null);
      setSosDispatching(false);
      if (alert) setLastAlert(alert);
    } else if (!hasFix) {
      console.warn('SOS triggered before a GPS fix was available — contacts were not sent coordinates.');
    }

    // Start live video + audio evidence recording. We try camera+mic first so the
    // recording actually captures video, and fall back to audio-only if the device
    // has no camera, the user denies video, or another app is holding the camera —
    // an SOS should still capture *something* rather than fail outright.
    if (settings.recordEvidence && navigator.mediaDevices?.getUserMedia) {
      const startRecorder = (stream, kind) => {
        recordedChunksRef.current = [];
        mediaStreamRef.current = stream;
        setMediaStream(stream);

        const candidates = kind === 'av'
          ? ['video/webm;codecs=vp8,opus', 'video/webm;codecs=vp9,opus', 'video/webm']
          : ['audio/webm;codecs=opus', 'audio/webm'];
        const mimeType = candidates.find((t) => window.MediaRecorder?.isTypeSupported?.(t)) || candidates[candidates.length - 1];
        recordingMimeRef.current = mimeType;

        const mr = new MediaRecorder(stream, { mimeType });
        mr.ondataavailable = (e) => { if (e.data.size > 0) recordedChunksRef.current.push(e.data); };
        mr.onerror = (e) => console.warn('SOS MediaRecorder error:', e.error || e);
        mr.start(1000); // flush a chunk every second so we always have data even if the app is force-closed
        mediaRecorderRef.current = mr;
        setRecording(true);
        setRecordingKind(kind);
      };

      navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
        audio: true,
      }).then((stream) => startRecorder(stream, 'av'))
        .catch((videoErr) => {
          console.warn('SOS camera unavailable, falling back to audio-only evidence:', videoErr.message);
          navigator.mediaDevices.getUserMedia({ audio: true })
            .then((stream) => startRecorder(stream, 'audio'))
            .catch((audioErr) => {
              console.warn('SOS evidence recording unavailable:', audioErr.message);
              setRecording(false);
              setRecordingKind(null);
            });
        });
    }
  }, [location, logEvent, settings.recordEvidence, backendOnline]);

  const cancelSos = useCallback(() => {
    setSosActive(false);
    setSosStartedAt(null);

    // Stop the recorder and offer a download of the live video+audio (or audio-only
    // fallback) evidence that was just captured, then release the camera/mic.
    if (mediaRecorderRef.current) {
      const mr = mediaRecorderRef.current;
      const streamToStop = mediaStreamRef.current;
      mr.onstop = () => {
        if (recordedChunksRef.current.length > 0) {
          const blob = new Blob(recordedChunksRef.current, { type: recordingMimeRef.current });
          const ext  = recordingMimeRef.current.startsWith('video') ? 'webm' : 'webm'; // both container types are .webm
          const url  = URL.createObjectURL(blob);
          const a    = document.createElement('a');
          a.href = url; a.download = `sos-recording-${Date.now()}.${ext}`; a.click();
          URL.revokeObjectURL(url);
        }
        recordedChunksRef.current = [];
        if (streamToStop) streamToStop.getTracks().forEach((t) => t.stop());
        mediaStreamRef.current = null;
        setMediaStream(null);
      };
      try { mr.stop(); } catch { mr.onstop(); }
      mediaRecorderRef.current = null;
    } else if (mediaStreamRef.current) {
      // No recorder was running but a stream is still open (e.g. recorder failed to start) — release the camera/mic anyway.
      mediaStreamRef.current.getTracks().forEach((t) => t.stop());
      mediaStreamRef.current = null;
      setMediaStream(null);
    }
    setRecording(false);
    setRecordingKind(null);
    logEvent({ type: 'Marked safe', location: location.label, status: 'closed' });
  }, [location, logEvent]);

  // ── Voice safe-word ───────────────────────────────────────────────────────
  useEffect(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!settings.voiceEnabled || !SR) return;
    const rec = new SR();
    rec.continuous = true; rec.interimResults = true; rec.lang = 'en-IN';
    rec.onresult = (e) => {
      const transcript = Array.from(e.results).map((r) => r[0].transcript).join(' ').toLowerCase();
      if (settings.safeWord && transcript.includes(settings.safeWord.toLowerCase()) && !sosActive)
        triggerSos('voice');
    };
    rec.onerror = () => {};
    rec.onend   = () => { if (settings.voiceEnabled) { try { rec.start(); } catch {} } };
    try { rec.start(); } catch {}
    recognitionRef.current = rec;
    return () => { try { rec.stop(); } catch {} };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings.voiceEnabled, settings.safeWord, sosActive]);

  // ── Shake-to-trigger ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!settings.shakeEnabled) return;
    let lastTime = 0, lastX, lastY, lastZ;
    const THRESHOLD = 18;
    const handler = (e) => {
      const { x, y, z } = e.accelerationIncludingGravity || {};
      if (x == null) return;
      const now = Date.now();
      if (now - lastTime < 150) return;
      if (lastX != null) {
        const delta = Math.abs(x - lastX) + Math.abs(y - lastY) + Math.abs(z - lastZ);
        if (delta > THRESHOLD && !sosActive) triggerSos('shake');
      }
      lastX = x; lastY = y; lastZ = z; lastTime = now;
    };
    window.addEventListener('devicemotion', handler);
    return () => window.removeEventListener('devicemotion', handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings.shakeEnabled, sosActive]);

  // ── Walk-with-me check-in ─────────────────────────────────────────────────
  // destinationCoords is optional {lat, lng} — dropped as a pin on the map.
  // When present we get live distance-to-go, an auto "arrived" geofence, and
  // a two-point (start → destination) view on the map.
  const startCheckIn = useCallback((destination, minutes, destinationCoords = null) => {
    setWalkTrail([{ lat: location.lat, lng: location.lng, t: Date.now() }]);
    setLastPingAt(Date.now());
    setCheckIn({
      destination,
      minutes,
      destinationCoords,
      startedAt: Date.now(),
      endsAt: Date.now() + minutes * 60 * 1000,
    });
    logEvent({ type: 'Walk-with-me started', location: location.label, status: 'in progress' });
  }, [location, logEvent]);

  const confirmSafeArrival = useCallback((source = 'manual') => {
    setCheckIn(null);
    logEvent({
      type: 'Arrived safely',
      location: location.label,
      status: 'closed',
      note: source === 'auto-arrived' ? 'Auto-detected on the map — within range of the destination pin' : undefined,
    });
  }, [location, logEvent]);

  // Countdown watcher — fires SOS with the live location if the timer runs out
  // before the walker checks in.
  useEffect(() => {
    if (!checkIn) return;
    const id = setInterval(() => {
      if (Date.now() >= checkIn.endsAt) {
        clearInterval(id);
        triggerSos('check-in-timeout', `Was walking to "${checkIn.destination}" and didn't check in before the timer ended.`);
        setCheckIn(null);
      }
    }, 1000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [checkIn]);

  // GPS pinger — every ~10-15s while a walk is active, take a fresh GPS fix,
  // drop it on the trail, and auto-confirm arrival if we're within range of
  // the destination pin. This is deliberately a poll (not watchPosition) so
  // the interval is predictable and battery use stays low.
  useEffect(() => {
    if (!checkIn) {
      if (walkPingRef.current) { clearInterval(walkPingRef.current); walkPingRef.current = null; }
      return;
    }
    if (!('geolocation' in navigator)) return;

    // destinationCoords (if any) is fixed for the lifetime of this session,
    // so it's safe to read once from the closure rather than re-reading state.
    const destinationCoords = checkIn.destinationCoords;

    const ping = () => {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const next = { lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy };
          setLocation((prev) => ({ ...prev, ...next, label: 'Live GPS (walk with me)', live: true }));
          setLastPingAt(Date.now());
          setWalkTrail((prev) => [...prev.slice(-49), { ...next, t: Date.now() }]);

          if (destinationCoords && distanceMeters(next, destinationCoords) <= ARRIVAL_RADIUS_M) {
            confirmSafeArrival('auto-arrived');
          }
        },
        (err) => console.warn('Walk-with-me GPS ping failed:', err.message),
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
      );
    };

    ping(); // immediate first fix, then on the interval
    walkPingRef.current = setInterval(ping, WALK_PING_INTERVAL_MS);
    return () => { clearInterval(walkPingRef.current); walkPingRef.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [!!checkIn]);

  // Make sure the camera/mic light never stays on after the app unmounts.
  useEffect(() => () => {
    if (mediaRecorderRef.current) { try { mediaRecorderRef.current.stop(); } catch { /* noop */ } }
    if (mediaStreamRef.current) mediaStreamRef.current.getTracks().forEach((t) => t.stop());
  }, []);

  const updateSettings = useCallback((patch) => setSettings((p) => ({ ...p, ...patch })), []);

  // Pulls the real alert log from the backend — each entry carries the actual
  // per-contact SMS dispatch result (sent / failed / mock), not a simulation.
  const fetchAlerts = useCallback(() => tryApi(() => api.getAlerts(), []), []);

  // Community route-safety reviews: people who've actually been down a road
  // rate it so others can check before they go.
  const fetchRouteReviews = useCallback((lat, lng, radiusKm) => tryApi(() => api.getRouteReviews(lat, lng, radiusKm), []), []);
  const submitRouteReview = useCallback((review) => tryApi(() => api.addRouteReview(review), null), []);

  // ── Auth ─────────────────────────────────────────────────────────────────
  // Real accounts live on the backend (hashed passwords + JWT sessions). If the
  // backend is unreachable we fall back to the original demo/offline behavior
  // so the app — and the Login page's own logic — never has to change.
  const login = useCallback(({ email, password, role }) => {
    if (backendOnline) {
      return api.login({ email, password, role })
        .then((result) => {
          setAuth({ ...result.user, loggedInAt: new Date().toISOString() });
          setToken(result.token);
          return { ok: true };
        })
        .catch((err) => ({ ok: false, error: err.message || 'Invalid email or password.' }));
    }
    return new Promise((resolve) => {
      setTimeout(() => {
        if (!email.trim() || !/^\S+@\S+\.\S+$/.test(email)) {
          resolve({ ok: false, error: 'Enter a valid email address.' });
          return;
        }
        if (!password || password.length < 6) {
          resolve({ ok: false, error: 'Password must be at least 6 characters.' });
          return;
        }
        const name = email.split('@')[0].replace(/[._]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
        setAuth({ email, name, role, loggedInAt: new Date().toISOString() });
        resolve({ ok: true });
      }, 700 + Math.random() * 500); // simulated network latency
    });
  }, [backendOnline]);

  // Creates a brand-new user account on the backend. Sign-up always yields a
  // regular 'user' role — admin accounts are provisioned directly in the database.
  const register = useCallback(({ name, email, password }) => {
    if (!backendOnline) {
      return Promise.resolve({ ok: false, error: 'Can\u2019t create an account while offline. Please try again once the server is reachable.' });
    }
    return api.register({ name, email, password })
      .then((result) => {
        setAuth({ ...result.user, loggedInAt: new Date().toISOString() });
        setToken(result.token);
        return { ok: true };
      })
      .catch((err) => ({ ok: false, error: err.message || 'Could not create account.' }));
  }, [backendOnline]);

  const logout = useCallback(() => { setAuth(null); setToken(null); }, []);

  // ── Admin ────────────────────────────────────────────────────────────────
  // Every registered user's profile + how many incidents/alerts they've logged.
  const adminFetchUsers = useCallback(() => tryApi(() => api.adminGetUsers(token), []), [token]);
  // A single user's profile plus their full SOS history and alert log.
  const adminFetchUserDetail = useCallback((id) => tryApi(() => api.adminGetUserDetail(id, token), null), [token]);

  return (
    <AppContext.Provider value={{
      contacts, addContact, removeContact,
      sosActive, sosStartedAt, triggerSos, cancelSos, lastAlert, sosDispatching,
      location, setLocation, geoStatus, requestLiveLocation, startLocationWatch, stopLocationWatch,
      history, logEvent,
      settings, updateSettings,
      checkIn, startCheckIn, confirmSafeArrival, walkTrail, lastPingAt,
      recording, recordingKind, mediaStream, backendOnline, fetchAlerts, fetchRouteReviews, submitRouteReview,
      auth, token, login, register, logout, adminFetchUsers, adminFetchUserDetail,
    }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}
