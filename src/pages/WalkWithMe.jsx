import { useState, useEffect, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Footprints, CheckCircle2, Clock, Navigation, X, Satellite, LocateFixed, Building2, Phone, Loader2, ArrowRight } from 'lucide-react';
import { useApp } from '../context/AppContext';
import LiveMap from '../components/LiveMap';
import { nearestStations, fetchNearbyPoliceStations } from '../data/policeStations';
import './WalkWithMe.css';

// Straight-line distance in metres (haversine) — mirrors the helper in AppContext,
// kept local here since it's only needed for the suggested-time / distance display.
function distanceMeters(a, b) {
  if (!a || !b) return null;
  const R = 6371000;
  const dLat = (b.lat - a.lat) * Math.PI / 180;
  const dLng = (b.lng - a.lng) * Math.PI / 180;
  const lat1 = a.lat * Math.PI / 180;
  const lat2 = b.lat * Math.PI / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

const fmtDist = (m) => (m == null ? '—' : m < 1000 ? `${Math.round(m)} m` : `${(m / 1000).toFixed(1)} km`);
const fmtTime = (s) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

export default function WalkWithMe() {
  const {
    checkIn, startCheckIn, confirmSafeArrival, contacts,
    location, geoStatus, requestLiveLocation, walkTrail, lastPingAt,
  } = useApp();

  const [destLabel, setDestLabel] = useState('');
  const [destCoords, setDestCoords] = useState(null);
  const [minutes, setMinutes] = useState(15);
  const [minutesTouched, setMinutesTouched] = useState(false);
  const [remaining, setRemaining] = useState(0);
  const [nowTick, setNowTick] = useState(Date.now());
  const [justArrived, setJustArrived] = useState(null); // { start, end, label } — shown briefly after a manual "arrived safely"

  // Suggest a timer length from straight-line distance (~5 km/h walking pace),
  // but don't fight the user once they've dragged the slider themselves.
  useEffect(() => {
    if (!destCoords || minutesTouched) return;
    const dist = distanceMeters(location, destCoords);
    if (dist == null) return;
    const suggested = Math.min(60, Math.max(5, Math.round((dist / 1400 / 60) * 5) * 5)); // 1400 m/min ≈ 5 km/h, rounded to nearest 5
    setMinutes(suggested);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [destCoords]);

  // Tick every second — drives both the countdown display and the
  // "last updated Xs ago" live-tracking indicator.
  useEffect(() => {
    const id = setInterval(() => setNowTick(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (!checkIn) return;
    setRemaining(Math.max(0, Math.round((checkIn.endsAt - Date.now()) / 1000)));
  }, [checkIn, nowTick]);

  const handleMapClick = useCallback((point) => {
    if (checkIn) return; // pin is locked once a walk is underway
    setDestCoords(point);
  }, [checkIn]);

  const activeDestCoords = checkIn?.destinationCoords ?? null;
  const distanceRemaining = useMemo(
    () => (activeDestCoords ? distanceMeters(location, activeDestCoords) : null),
    [location, activeDestCoords]
  );
  const setupDistance = useMemo(
    () => (destCoords ? distanceMeters(location, destCoords) : null),
    [location, destCoords]
  );
  const secondsSincePing = lastPingAt ? Math.round((nowTick - lastPingAt) / 1000) : null;

  const path = activeDestCoords
    ? [[location.lat, location.lng], [activeDestCoords.lat, activeDestCoords.lng]]
    : destCoords
      ? [[location.lat, location.lng], [destCoords.lat, destCoords.lng]]
      : null;

  const canStart = (destLabel.trim() || destCoords) && location.live;

  // Real coordinates get a real answer: query OpenStreetMap for actual nearby police
  // stations. Round to ~100m so GPS jitter during an active walk doesn't refire this
  // on every 12s ping.
  const roundedLat = useMemo(() => Math.round(location.lat * 1000) / 1000, [location.lat]);
  const roundedLng = useMemo(() => Math.round(location.lng * 1000) / 1000, [location.lng]);
  const [liveStations, setLiveStations] = useState(null);
  const [stationsLoading, setStationsLoading] = useState(false);
  const [stationsError, setStationsError] = useState(null);

  useEffect(() => {
    if (!location.live) { setLiveStations(null); setStationsError(null); return; }
    let cancelled = false;
    setStationsLoading(true);
    setStationsError(null);
    fetchNearbyPoliceStations(roundedLat, roundedLng)
      .then((stations) => { if (!cancelled) setLiveStations(stations); })
      .catch(() => { if (!cancelled) setStationsError("Couldn't reach live station data"); })
      .finally(() => { if (!cancelled) setStationsLoading(false); });
    return () => { cancelled = true; };
  }, [location.live, roundedLat, roundedLng]);

  // Only used when we don't yet have a real location — the bundled New Delhi demo set.
  const demoStations = useMemo(() => nearestStations(location.lat, location.lng, false).slice(0, 3), [location.lat, location.lng]);

  return (
    <section className="walk">
      <div className="container walk__inner">
        <div className="walk__head">
          <span className="how__eyebrow">Walk with me</span>
          <h1>Set a safety timer for your journey</h1>
          <p>
            Drop a pin where you're headed (or just name it) and how long it should take. Your
            location updates on the map every 10-15 seconds while you walk. If you don't check in
            — or reach the pin — before the timer runs out, we automatically trigger an SOS alert
            with your live location to your trusted circle.
          </p>
        </div>

        {!checkIn ? (
          <div className="walk__setup">
            {justArrived && (
              <div className="walk__arrived-banner">
                <CheckCircle2 size={16} />
                <span>Arrived safely! Rate this route so others know what to expect.</span>
                <Link to="/routes/rate" state={justArrived} className="walk__rate-link">
                  Rate this route <ArrowRight size={14} />
                </Link>
                <button type="button" onClick={() => setJustArrived(null)} aria-label="Dismiss">
                  <X size={14} />
                </button>
              </div>
            )}
            <div className="walk__map-panel">
              <LiveMap
                lat={location.lat}
                lng={location.lng}
                label={location.label}
                live={location.live}
                height={260}
                zoom={destCoords ? 14 : 13}
                destination={destCoords ? { ...destCoords, label: destLabel.trim() || 'Destination pin' } : null}
                path={path}
                onMapClick={handleMapClick}
                status={geoStatus}
                onRetry={requestLiveLocation}
              />
              <div className="walk__map-toolbar">
                <button type="button" className="walk__locate-btn" onClick={requestLiveLocation} disabled={geoStatus === 'locating'}>
                  <LocateFixed size={13} /> {geoStatus === 'locating' ? 'Locating…' : 'Refresh my location'}
                </button>
                {destCoords && (
                  <button type="button" className="walk__clear-pin" onClick={() => { setDestCoords(null); setMinutesTouched(false); }}>
                    <X size={13} /> Clear pin
                  </button>
                )}
              </div>
              {setupDistance != null && (
                <p className="walk__distance">
                  <Navigation size={14} /> {fmtDist(setupDistance)} to the pin — about a {minutes} min walk
                </p>
              )}
            </div>

            <div className="walk__panel">
              <label>
                Destination name (optional if you've dropped a pin)
                <input
                  type="text"
                  placeholder="e.g. Home, Metro station, Friend's place"
                  value={destLabel}
                  onChange={(e) => setDestLabel(e.target.value)}
                />
              </label>
              <label>
                Expected time ({minutes} min)
                <input
                  type="range"
                  min="5"
                  max="60"
                  step="5"
                  value={minutes}
                  onChange={(e) => { setMinutes(Number(e.target.value)); setMinutesTouched(true); }}
                />
              </label>
              <p className="walk__note">
                <Clock size={14} /> {contacts.length} contact{contacts.length !== 1 ? 's' : ''} will be alerted automatically — with your live location — if the timer expires.
              </p>
              <button
                className="btn btn--primary walk__start"
                disabled={!canStart}
                onClick={() => startCheckIn(destLabel.trim() || 'Pinned destination', minutes, destCoords)}
              >
                <Footprints size={16} /> Start walk timer
              </button>
              {!location.live && (
                <span className="walk__hint">Waiting for your GPS fix before this can start — this uses your real position, never a placeholder.</span>
              )}
            </div>
          </div>
        ) : (
          <div className="walk__active-layout">
            <div className="walk__map-panel">
              <LiveMap
                lat={location.lat}
                lng={location.lng}
                label={location.label}
                live={location.live}
                pulse
                height={260}
                zoom={14}
                destination={activeDestCoords ? { ...activeDestCoords, label: checkIn.destination } : null}
                path={path}
                status={geoStatus}
                onRetry={requestLiveLocation}
              />
              <p className="walk__ping-status">
                <Satellite size={13} />
                {secondsSincePing == null ? 'Waiting for first GPS fix…' : `Location updated ${secondsSincePing}s ago`}
                {walkTrail.length > 1 && <span className="walk__ping-count"> · {walkTrail.length} pings logged</span>}
              </p>
              {distanceRemaining != null && (
                <p className="walk__distance">
                  <Navigation size={14} /> {fmtDist(distanceRemaining)} to go — you'll auto check-in once you're close
                </p>
              )}
            </div>

            <div className="walk__active">
              <div className="walk__countdown">{fmtTime(remaining)}</div>
              <p>Walking to <strong>{checkIn.destination}</strong> — check in before the timer hits zero.</p>
              <button
                className="btn btn--primary walk__arrived"
                onClick={() => {
                  if (activeDestCoords) {
                    setJustArrived({ start: { lat: location.lat, lng: location.lng }, end: activeDestCoords, label: checkIn.destination });
                  }
                  confirmSafeArrival('manual');
                }}
              >
                <CheckCircle2 size={16} /> I've arrived safely
              </button>
              <span className="walk__hint">If the timer runs out, an SOS alert fires automatically with your live location.</span>
            </div>
          </div>
        )}

        <div className="walk__police">
          <div className="walk__police-head">
            <h3><Building2 size={16} /> Police help near {location.live ? 'your location' : 'you'}</h3>
            {!location.live && (
              <button type="button" className="walk__locate-btn" onClick={requestLiveLocation} disabled={geoStatus === 'locating'}>
                <LocateFixed size={13} /> {geoStatus === 'locating' ? 'Locating…' : 'Retry location'}
              </button>
            )}
          </div>

          {location.live ? (
            stationsLoading ? (
              <p className="walk__police-note"><Loader2 size={14} className="walk__police-spin" /> Looking up police stations near you…</p>
            ) : stationsError ? (
              <p className="walk__police-note">
                {stationsError} — call <a href="tel:112">112</a> (emergency) or <a href="tel:1091">1091</a> (women's helpline) instead.
              </p>
            ) : liveStations && liveStations.length ? (
              <>
                <ul className="walk__police-list">
                  {liveStations.map((s) => (
                    <li key={`${s.lat},${s.lng}`}>
                      <div className="walk__police-meta">
                        <strong>{s.name}</strong>
                        <span>{s.km.toFixed(1)} km away</span>
                      </div>
                      <a className="walk__police-call" href={`tel:${s.phone || '112'}`}>
                        <Phone size={13} /> {s.phone || 'Call 112'}
                      </a>
                    </li>
                  ))}
                </ul>
                <p className="walk__police-caption">Numbers come from OpenStreetMap where listed — if a station has none on record, tap it to call 112 instead.</p>
              </>
            ) : (
              <p className="walk__police-note">
                No police stations listed on OpenStreetMap within 15 km — call <a href="tel:112">112</a> (all-India emergency) or <a href="tel:1091">1091</a> (women's helpline).
              </p>
            )
          ) : geoStatus === 'denied' || geoStatus === 'unsupported' ? (
            <>
              <p className="walk__police-note">
                Location access isn't available, so these are demo entries near New Delhi, not stations near you — enable location and retry for a real list.
              </p>
              <ul className="walk__police-list">
                {demoStations.map((s) => (
                  <li key={s.name}>
                    <div className="walk__police-meta">
                      <strong>{s.name}</strong>
                      <span>Demo entry</span>
                    </div>
                    <a className="walk__police-call" href={`tel:${s.phone}`}>
                      <Phone size={13} /> {s.phone}
                    </a>
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <p className="walk__police-note"><Loader2 size={14} className="walk__police-spin" /> Waiting for your location to look up nearby police stations…</p>
          )}
        </div>
      </div>
    </section>
  );
}
