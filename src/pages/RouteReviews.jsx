import { useState, useEffect, useCallback, useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import { Star, MapPin, LocateFixed, Footprints, Bike, Car, Bus, Loader2, ExternalLink, Send } from 'lucide-react';
import { useApp } from '../context/AppContext';
import LiveMap from '../components/LiveMap';
import './RouteReviews.css';

const CRITERIA = [
  { key: 'safety', label: 'Overall safety', hint: 'How safe did you feel end to end?' },
  { key: 'lighting', label: 'Lighting after dark', hint: 'Street lights — well-lit or pitch dark?' },
  { key: 'crowd', label: 'Crowd & isolation', hint: 'Busy with people, or deserted stretches?' },
  { key: 'roadCondition', label: 'Road & path condition', hint: 'Potholes, pavement, easy to walk?' },
  { key: 'policePresence', label: 'Police / security presence', hint: 'Patrols, CCTV, help booths nearby?' },
];

const TRAVEL_MODES = [
  { key: 'walk', label: 'Walk', icon: Footprints },
  { key: 'bike', label: 'Bike', icon: Bike },
  { key: 'vehicle', label: 'Vehicle', icon: Car },
  { key: 'transit', label: 'Transit', icon: Bus },
];

const mapsDirections = (start, end) =>
  `https://www.google.com/maps/dir/?api=1&origin=${start.lat},${start.lng}&destination=${end.lat},${end.lng}`;

function StarPicker({ value, onChange }) {
  const [hover, setHover] = useState(0);
  return (
    <div className="rr__stars" onMouseLeave={() => setHover(0)}>
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          className="rr__star-btn"
          onMouseEnter={() => setHover(n)}
          onClick={() => onChange(n)}
          aria-label={`Rate ${n} out of 5`}
        >
          <Star size={20} fill={(hover || value) >= n ? '#00e0b8' : 'none'} color={(hover || value) >= n ? '#00e0b8' : '#586079'} />
        </button>
      ))}
    </div>
  );
}

function StarDisplay({ value }) {
  return (
    <div className="rr__stars rr__stars--display">
      {[1, 2, 3, 4, 5].map((n) => (
        <Star key={n} size={14} fill={value >= n ? '#00e0b8' : 'none'} color={value >= n ? '#00e0b8' : '#586079'} />
      ))}
    </div>
  );
}

function avgRating(ratings) {
  const vals = CRITERIA.map((c) => ratings[c.key]).filter((v) => Number.isFinite(v));
  return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
}

export default function RouteReviews() {
  const { location, geoStatus, requestLiveLocation, backendOnline, fetchRouteReviews, submitRouteReview } = useApp();
  const routerLocation = useLocation();
  const prefill = routerLocation.state; // { start, end, label } — passed from "Rate this route" after a Walk-with-me arrival

  const [startCoords, setStartCoords] = useState(prefill?.start ?? null);
  const [endCoords, setEndCoords] = useState(prefill?.end ?? null);
  const [pickTarget, setPickTarget] = useState(prefill ? null : 'start');
  const [routeName, setRouteName] = useState(prefill?.label ?? '');
  const [travelMode, setTravelMode] = useState('walk');
  const [ratings, setRatings] = useState({});
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitError, setSubmitError] = useState(null);

  const [reviews, setReviews] = useState([]);
  const [reviewsLoading, setReviewsLoading] = useState(false);

  const loadReviews = useCallback(() => {
    if (!location.live) return;
    setReviewsLoading(true);
    fetchRouteReviews(location.lat, location.lng, 5)
      .then(setReviews)
      .finally(() => setReviewsLoading(false));
  }, [location.live, location.lat, location.lng, fetchRouteReviews]);

  useEffect(() => { loadReviews(); }, [loadReviews]);

  const handleMapClick = useCallback((point) => {
    if (pickTarget === 'start') { setStartCoords(point); setPickTarget(endCoords ? null : 'end'); }
    else if (pickTarget === 'end') { setEndCoords(point); setPickTarget(null); }
  }, [pickTarget, endCoords]);

  const allRated = CRITERIA.every((c) => ratings[c.key] >= 1);
  const canSubmit = startCoords && endCoords && allRated && !submitting;

  const path = startCoords && endCoords ? [[startCoords.lat, startCoords.lng], [endCoords.lat, endCoords.lng]] : null;
  const mapMarkers = useMemo(() => {
    const m = [];
    if (startCoords) m.push({ key: 'start', lat: startCoords.lat, lng: startCoords.lng, label: 'Start' });
    return m;
  }, [startCoords]);

  const handleSubmit = async () => {
    setSubmitting(true);
    setSubmitError(null);
    const payload = {
      startLat: startCoords.lat, startLng: startCoords.lng,
      endLat: endCoords.lat, endLng: endCoords.lng,
      routeName: routeName.trim() || null,
      travelMode,
      ratings,
      comment,
    };
    const result = await submitRouteReview(payload);
    setSubmitting(false);
    if (!result) { setSubmitError(backendOnline ? "Couldn't save your review — try again." : 'Connect the backend to save reviews.'); return; }
    setSubmitted(true);
    setRatings({});
    setComment('');
    loadReviews();
  };

  return (
    <section className="rr">
      <div className="container rr__inner">
        <div className="rr__head">
          <span className="how__eyebrow">Route safety</span>
          <h1>Rate a road you've traveled</h1>
          <p>
            Been down a road or path before — on foot, bike, or otherwise? Rate how it actually felt
            so the next person can check before they go. Reviews are tied to real start/end points,
            not just a place name.
          </p>
          {!backendOnline && (
            <p className="rr__backend-note">Backend not connected — you can preview the form, but reviews won't be saved or visible to others until the server is running.</p>
          )}
        </div>

        <div className="rr__layout">
          <div className="rr__form-panel">
            <div className="rr__map-panel">
              <LiveMap
                lat={location.lat}
                lng={location.lng}
                label={location.label}
                live={location.live}
                height={240}
                markers={mapMarkers}
                destination={endCoords ? { ...endCoords, label: 'End' } : null}
                path={path}
                onMapClick={handleMapClick}
                status={geoStatus}
                onRetry={requestLiveLocation}
              />
              <div className="rr__point-toolbar">
                <button
                  type="button"
                  className={`rr__point-btn ${pickTarget === 'start' ? 'is-active' : ''} ${startCoords ? 'is-set' : ''}`}
                  onClick={() => setPickTarget('start')}
                >
                  {startCoords ? '✓ Start set' : 'Tap map to set start'}
                </button>
                <button
                  type="button"
                  className={`rr__point-btn ${pickTarget === 'end' ? 'is-active' : ''} ${endCoords ? 'is-set' : ''}`}
                  onClick={() => setPickTarget('end')}
                >
                  {endCoords ? '✓ End set' : 'Tap map to set end'}
                </button>
                {location.live && (
                  <button type="button" className="rr__point-btn" onClick={() => { setStartCoords({ lat: location.lat, lng: location.lng }); setPickTarget(endCoords ? null : 'end'); }}>
                    <LocateFixed size={12} /> Use my location as start
                  </button>
                )}
              </div>
            </div>

            <label className="rr__label">
              Route name (optional)
              <input type="text" placeholder="e.g. MG Road to Rajiv Chowk Metro" value={routeName} onChange={(e) => setRouteName(e.target.value)} />
            </label>

            <div className="rr__label">
              How did you travel it?
              <div className="rr__mode-row">
                {TRAVEL_MODES.map(({ key, label, icon: Icon }) => (
                  <button key={key} type="button" className={`rr__mode-btn ${travelMode === key ? 'is-active' : ''}`} onClick={() => setTravelMode(key)}>
                    <Icon size={15} /> {label}
                  </button>
                ))}
              </div>
            </div>

            <div className="rr__criteria">
              {CRITERIA.map((c) => (
                <div key={c.key} className="rr__criterion">
                  <div className="rr__criterion-text">
                    <strong>{c.label}</strong>
                    <span>{c.hint}</span>
                  </div>
                  <StarPicker value={ratings[c.key] || 0} onChange={(v) => setRatings((r) => ({ ...r, [c.key]: v }))} />
                </div>
              ))}
            </div>

            <label className="rr__label">
              Anything else worth knowing?
              <textarea rows={3} placeholder="e.g. Well-lit until 9pm but the last stretch near the underpass is dark and quiet." value={comment} onChange={(e) => setComment(e.target.value)} />
            </label>

            {submitError && <p className="rr__error">{submitError}</p>}
            {submitted && <p className="rr__success">Thanks — your review is live for others nearby.</p>}

            <button className="btn btn--primary rr__submit" disabled={!canSubmit} onClick={handleSubmit}>
              {submitting ? <Loader2 size={16} className="rr__spin" /> : <Send size={16} />} Submit review
            </button>
            {!canSubmit && !submitting && (
              <span className="rr__hint">
                {!startCoords || !endCoords ? 'Set both a start and end point on the map.' : 'Rate all 5 criteria to submit.'}
              </span>
            )}
          </div>

          <div className="rr__list-panel">
            <h3><MapPin size={16} /> Reviews near you</h3>
            {!location.live ? (
              <p className="rr__list-empty"><Loader2 size={14} className="rr__spin" /> Waiting for your location…</p>
            ) : reviewsLoading ? (
              <p className="rr__list-empty"><Loader2 size={14} className="rr__spin" /> Loading nearby reviews…</p>
            ) : reviews.length === 0 ? (
              <p className="rr__list-empty">No reviews near you yet — be the first to rate a route here.</p>
            ) : (
              <ul className="rr__review-list">
                {reviews.map((r) => (
                  <li key={r.id} className="rr__review">
                    <div className="rr__review-top">
                      <strong>{r.routeName || 'Unnamed route'}</strong>
                      <StarDisplay value={avgRating(r.ratings)} />
                    </div>
                    <a className="rr__review-link" href={mapsDirections({ lat: r.startLat, lng: r.startLng }, { lat: r.endLat, lng: r.endLng })} target="_blank" rel="noreferrer">
                      View route <ExternalLink size={11} />
                    </a>
                    <div className="rr__review-breakdown">
                      {CRITERIA.map((c) => (
                        <span key={c.key} className="rr__breakdown-chip">{c.label.split(' ')[0]}: {r.ratings[c.key]}★</span>
                      ))}
                    </div>
                    {r.comment && <p className="rr__review-comment">"{r.comment}"</p>}
                    <span className="rr__review-meta">{r.travelMode} · {new Date(r.time).toLocaleDateString()}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
