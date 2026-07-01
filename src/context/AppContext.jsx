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

export function AppProvider({ children }) {
  const [contacts, setContacts]   = useState(() => loadJSON('wsap_contacts', DEFAULT_CONTACTS));
  const [history, setHistory]     = useState(() => loadJSON('wsap_history', []));
  const [settings, setSettings]   = useState(() => loadJSON('wsap_settings', DEFAULT_SETTINGS));
  const [sosActive, setSosActive] = useState(false);
  const [sosStartedAt, setSosStartedAt] = useState(null);
  const [location, setLocation]   = useState({ lat: 28.6139, lng: 77.2090, label: 'Connaught Place, New Delhi', live: false, accuracy: null });
  const [geoStatus, setGeoStatus] = useState('idle');
  const [checkIn, setCheckIn]     = useState(null);
  const [recording, setRecording] = useState(false);
  const [backendOnline, setBackendOnline] = useState(false);

  const recognitionRef = useRef(null);
  const geoWatchRef    = useRef(null);
  const mediaRecorderRef = useRef(null);
  const recordedChunksRef = useRef([]);

  // ── Persist to localStorage ───────────────────────────────────────────────
  useEffect(() => { localStorage.setItem('wsap_contacts', JSON.stringify(contacts)); }, [contacts]);
  useEffect(() => { localStorage.setItem('wsap_history',  JSON.stringify(history));  }, [history]);
  useEffect(() => { localStorage.setItem('wsap_settings', JSON.stringify(settings)); }, [settings]);

  // ── Backend handshake + initial sync ─────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const ok = await tryApi(() => api.health(), null);
      if (cancelled || !ok?.ok) return;
      setBackendOnline(true);
      const [rc, rh] = await Promise.all([
        tryApi(() => api.getContacts(), null),
        tryApi(() => api.getHistory(),  null),
      ]);
      if (rc) setContacts(rc);
      if (rh) setHistory(rh);
    })();
    return () => { cancelled = true; };
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
  const triggerSos = useCallback((source = 'manual') => {
    const startedAt = new Date().toISOString();
    setSosActive(true);
    setSosStartedAt(startedAt);
    logEvent({ type: 'SOS Triggered', location: location.label, trigger: source });

    if (backendOnline) {
      tryApi(() => api.triggerAlert({
        lat: location.lat, lng: location.lng,
        locationLabel: location.label,
        accuracy: location.accuracy,
        triggeredBy: source,
      }), null);
    }

    // Start audio evidence recording
    if (settings.recordEvidence && navigator.mediaDevices?.getUserMedia) {
      navigator.mediaDevices.getUserMedia({ audio: true }).then((stream) => {
        recordedChunksRef.current = [];
        const mr = new MediaRecorder(stream);
        mr.ondataavailable = (e) => { if (e.data.size > 0) recordedChunksRef.current.push(e.data); };
        mr.start(1000);
        mediaRecorderRef.current = mr;
        setRecording(true);
      }).catch(() => setRecording(false));
    }
  }, [location, logEvent, settings.recordEvidence, backendOnline]);

  const cancelSos = useCallback(() => {
    setSosActive(false);
    setSosStartedAt(null);

    // Stop and offer download of audio evidence
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current.onstop = () => {
        if (recordedChunksRef.current.length > 0) {
          const blob = new Blob(recordedChunksRef.current, { type: 'audio/webm' });
          const url  = URL.createObjectURL(blob);
          const a    = document.createElement('a');
          a.href = url; a.download = `sos-recording-${Date.now()}.webm`; a.click();
          URL.revokeObjectURL(url);
        }
      };
      mediaRecorderRef.current = null;
    }
    setRecording(false);
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
  const startCheckIn = useCallback((destination, minutes) => {
    setCheckIn({ destination, minutes, endsAt: Date.now() + minutes * 60 * 1000 });
    logEvent({ type: 'Walk-with-me started', location: location.label, status: 'in progress' });
  }, [location, logEvent]);

  const confirmSafeArrival = useCallback(() => {
    setCheckIn(null);
    logEvent({ type: 'Arrived safely', location: location.label, status: 'closed' });
  }, [location, logEvent]);

  useEffect(() => {
    if (!checkIn) return;
    const id = setInterval(() => {
      if (Date.now() >= checkIn.endsAt) {
        clearInterval(id); triggerSos('check-in-timeout'); setCheckIn(null);
      }
    }, 1000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [checkIn]);

  const updateSettings = useCallback((patch) => setSettings((p) => ({ ...p, ...patch })), []);

  return (
    <AppContext.Provider value={{
      contacts, addContact, removeContact,
      sosActive, sosStartedAt, triggerSos, cancelSos,
      location, setLocation, geoStatus, requestLiveLocation, startLocationWatch, stopLocationWatch,
      history, logEvent,
      settings, updateSettings,
      checkIn, startCheckIn, confirmSafeArrival,
      recording, backendOnline,
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
