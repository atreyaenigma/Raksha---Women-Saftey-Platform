import { useState, useEffect, useMemo } from 'react';
import { Building2, Navigation, Phone, LocateFixed, MapPinned, Loader2 } from 'lucide-react';
import { useApp } from '../context/AppContext';
import LiveMap from '../components/LiveMap';
import { nearestStations, fetchNearbyPoliceStations } from '../data/policeStations';
import './PoliceStations.css';

export default function PoliceStations() {
  const { location, geoStatus, requestLiveLocation } = useApp();
  const mapsQuery = encodeURIComponent(
    'police station near ' + (location.live ? `${location.lat},${location.lng}` : 'me')
  );

  // Real coordinates get a real answer: query OpenStreetMap for actual nearby police
  // stations. Round to ~100m so re-renders don't refire the network call needlessly.
  const roundedLat = useMemo(() => (Number.isFinite(location.lat) ? Math.round(location.lat * 1000) / 1000 : null), [location.lat]);
  const roundedLng = useMemo(() => (Number.isFinite(location.lng) ? Math.round(location.lng * 1000) / 1000 : null), [location.lng]);
  const [liveStations, setLiveStations] = useState(null);
  const [stationsLoading, setStationsLoading] = useState(false);
  const [stationsError, setStationsError] = useState(null);

  useEffect(() => {
    if (!location.live || roundedLat == null || roundedLng == null) { setLiveStations(null); setStationsError(null); return; }
    let cancelled = false;
    setStationsLoading(true);
    setStationsError(null);
    fetchNearbyPoliceStations(roundedLat, roundedLng)
      .then((stations) => { if (!cancelled) setLiveStations(stations); })
      .catch(() => { if (!cancelled) setStationsError("Couldn't reach live station data"); })
      .finally(() => { if (!cancelled) setStationsLoading(false); });
    return () => { cancelled = true; };
  }, [location.live, roundedLat, roundedLng]);

  // Only used as a last resort — when location access is actually denied/unsupported,
  // not while we're merely still waiting on a real fix.
  const demoStations = useMemo(() => nearestStations(location.lat, location.lng, false).slice(0, 4), [location.lat, location.lng]);
  const showDemoFallback = !location.live && (geoStatus === 'denied' || geoStatus === 'unsupported');

  return (
    <section className="ps">
      <div className="container">
        <div className="ps__head">
          <span className="how__eyebrow">Nearby help</span>
          <h1>Police stations & help desks near you</h1>
          <p>
            {location.live ? 'Based on your live location.' : 'Waiting for your location…'} Distances are approximate.
          </p>
        </div>

        <div className="ps__actions">
          <button className="btn btn--ghost ps__locate-btn" onClick={requestLiveLocation} disabled={geoStatus === 'locating'}>
            <LocateFixed size={16} />
            {geoStatus === 'live'
              ? 'Refresh my live location'
              : geoStatus === 'locating'
              ? 'Locating…'
              : geoStatus === 'denied' || geoStatus === 'unsupported'
              ? 'Location unavailable — retry'
              : 'Use my real location'}
          </button>

          <a
            className="btn btn--primary ps__maps-link"
            href={`https://www.google.com/maps/search/${mapsQuery}`}
            target="_blank"
            rel="noreferrer"
          >
            <Navigation size={16} /> Open full map search
          </a>
        </div>

        {location.live && (
          <p className="ps__live-note">
            <MapPinned size={13} />
            Showing real police stations from OpenStreetMap near your live position
            {location.accuracy ? ` (±${Math.round(location.accuracy)}m accuracy)` : ''}.
          </p>
        )}

        <div className="ps__map">
          <LiveMap
            lat={location.lat}
            lng={location.lng}
            label={location.live ? 'Your live position' : location.label}
            live={location.live}
            pulse={location.live}
            height={280}
            status={geoStatus}
            onRetry={requestLiveLocation}
            markers={
              location.live && liveStations
                ? liveStations.map((s) => ({ key: `${s.lat},${s.lng}`, lat: s.lat, lng: s.lng, label: s.name }))
                : showDemoFallback
                  ? demoStations.map((s) => ({ key: s.name, lat: s.lat, lng: s.lng, label: s.name }))
                  : []
            }
          />
        </div>

        {location.live ? (
          stationsLoading ? (
            <p className="ps__status-note"><Loader2 size={14} className="ps__spin" /> Looking up police stations near you…</p>
          ) : stationsError ? (
            <div className="ps__out-of-range">
              <p>{stationsError} — call <strong>112</strong> (emergency) or <strong>1091</strong> (women's helpline), or use <strong>Open full map search</strong> above.</p>
            </div>
          ) : liveStations && liveStations.length ? (
            <>
              <ul className="ps__list">
                {liveStations.map((s) => (
                  <li key={`${s.lat},${s.lng}`} className="ps__item">
                    <div className="ps__icon">
                      <Building2 size={20} />
                    </div>
                    <div className="ps__meta">
                      <strong>{s.name}</strong>
                      <span>{s.km.toFixed(1)} km away</span>
                    </div>
                    <a className="ps__call" href={`tel:${s.phone || '112'}`}>
                      <Phone size={14} /> {s.phone ? 'Call' : 'Call 112'}
                    </a>
                  </li>
                ))}
              </ul>
              <p className="ps__status-note">Numbers come from OpenStreetMap where listed — if a station has none on record, its call button dials 112 instead.</p>
            </>
          ) : (
            <div className="ps__out-of-range">
              <p>No police stations listed on OpenStreetMap within 15 km of your position — call <strong>112</strong> (all-India emergency) or <strong>1091</strong> (women's helpline), or use <strong>Open full map search</strong> above.</p>
            </div>
          )
        ) : showDemoFallback ? (
          <>
            <div className="ps__out-of-range">
              <p>
                Location access isn't available, so the list below is a demo set near New Delhi —
                not stations near you. Enable location and retry, or use <strong>Open full map
                search</strong> above.
              </p>
            </div>
            <ul className="ps__list">
              {demoStations.map((s) => (
                <li key={s.name} className="ps__item">
                  <div className="ps__icon">
                    <Building2 size={20} />
                  </div>
                  <div className="ps__meta">
                    <strong>{s.name}</strong>
                    <span>Demo entry</span>
                  </div>
                  <a className="ps__call" href={`tel:${s.phone}`}>
                    <Phone size={14} /> Call
                  </a>
                </li>
              ))}
            </ul>
          </>
        ) : (
          <p className="ps__status-note"><Loader2 size={14} className="ps__spin" /> Waiting for your location to look up nearby stations…</p>
        )}

        <div className="ps__helplines">
          <h3>National helplines</h3>
          <div className="ps__helpline-grid">
            <a href="tel:112" className="ps__helpline"><strong>112</strong><span>All-India emergency</span></a>
            <a href="tel:1091" className="ps__helpline"><strong>1091</strong><span>Women's helpline</span></a>
            <a href="tel:181" className="ps__helpline"><strong>181</strong><span>Women in distress</span></a>
            <a href="tel:1098" className="ps__helpline"><strong>1098</strong><span>Child helpline</span></a>
          </div>
        </div>
      </div>
    </section>
  );
}
