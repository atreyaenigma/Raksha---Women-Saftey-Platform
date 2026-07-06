import { MapContainer, TileLayer, Marker, Circle, Polyline, Popup, useMap, useMapEvents } from 'react-leaflet';
import { useEffect, useMemo } from 'react';
import { Loader2, MapPinOff } from 'lucide-react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';
import './LiveMap.css';

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
});

// Small red dot icon for secondary points of interest (e.g. nearby stations),
// visually distinct from the default blue pin used for the user's own position.
const poiIcon = L.divIcon({
  className: 'live-map__poi-icon',
  html: '<span></span>',
  iconSize: [14, 14],
  iconAnchor: [7, 7],
});

// Flag-style pin for a chosen destination (e.g. Walk-with-me's end point),
// visually distinct from both the user's own position and generic POIs.
const destinationIcon = L.divIcon({
  className: 'live-map__dest-icon',
  html: '<span>\u{1F3C1}</span>',
  iconSize: [26, 26],
  iconAnchor: [13, 24],
});

function Recenter({ lat, lng }) {
  const map = useMap();
  useEffect(() => {
    map.setView([lat, lng], map.getZoom(), { animate: true });
    requestAnimationFrame(() => map.invalidateSize());
  }, [lat, lng, map]);
  return null;
}

function FitToMarkers({ lat, lng, markers }) {
  const map = useMap();
  useEffect(() => {
    if (!markers?.length) return;
    const bounds = L.latLngBounds([[lat, lng], ...markers.map((m) => [m.lat, m.lng])]);
    map.fitBounds(bounds, { padding: [36, 36], maxZoom: 15 });
    requestAnimationFrame(() => map.invalidateSize());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lat, lng, markers, map]);
  return null;
}

function ResizeFix() {
  const map = useMap();
  useEffect(() => {
    const invalidate = () => map.invalidateSize();
    const t = setTimeout(invalidate, 0);
    requestAnimationFrame(invalidate);
    window.addEventListener('resize', invalidate);
    return () => {
      clearTimeout(t);
      window.removeEventListener('resize', invalidate);
    };
  }, [map]);
  return null;
}

// Lets the parent respond to taps/clicks on the map — used to drop a
// destination pin the same way you'd set a second point on Google Maps.
function ClickToSetPoint({ onMapClick }) {
  useMapEvents({
    click(e) {
      onMapClick?.({ lat: e.latlng.lat, lng: e.latlng.lng });
    },
  });
  return null;
}

export default function LiveMap({
  lat, lng, label, live, pulse = false, height = 220, zoom = 15,
  markers = [],
  destination = null,   // { lat, lng, label } — second point, e.g. Walk-with-me's end point
  path = null,          // array of [lat, lng] pairs to draw a route line, e.g. [[startLat,startLng],[destLat,destLng]]
  onMapClick = null,    // (( {lat, lng} ) => void) — called when the user clicks/taps the map to set a point
  status = null,        // geoStatus from AppContext ('idle' | 'locating' | 'live' | 'watching' | 'denied' | 'unsupported')
  onRetry = null,       // called when the person taps "try again" in the denied/unsupported state
}) {
  const ready = Number.isFinite(lat) && Number.isFinite(lng);

  // Hooks must run unconditionally on every render, so these are computed
  // before the early-return below (they're cheap, and unused when !ready).
  const fitMarkers = useMemo(
    () => (destination ? [...markers, destination] : markers),
    [markers, destination]
  );
  const key = useMemo(
    () => (ready ? `${lat.toFixed(3)},${lng.toFixed(3)}` : 'pending'),
    [ready, lat, lng]
  );

  // No coordinates yet — never fall back to a fake demo pin. Show what's
  // actually happening instead: still fetching, or access was denied.
  if (!ready) {
    const isError = status === 'denied' || status === 'unsupported';
    return (
      <div className="live-map live-map--empty" style={{ height }}>
        {isError ? (
          <>
            <MapPinOff size={22} />
            <p>{status === 'unsupported' ? "Your browser doesn't support location access." : 'Location access was denied.'}</p>
            {onRetry && <button type="button" onClick={onRetry}>Try again</button>}
          </>
        ) : (
          <>
            <Loader2 size={22} className="live-map__spin" />
            <p>Fetching your location…</p>
          </>
        )}
      </div>
    );
  }

  const hasMarkers = markers.length > 0 || !!destination;

  return (
    <div className={`live-map ${onMapClick ? 'live-map--pickable' : ''}`} style={{ height }}>
      <MapContainer
        center={[lat, lng]}
        zoom={zoom}
        scrollWheelZoom={false}
        zoomControl={false}
        attributionControl={true}
        className="live-map__container"
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        />
        <Marker position={[lat, lng]}>
          <Popup>{live ? 'You are here (live)' : label}</Popup>
        </Marker>
        {pulse && (
          <Circle
            center={[lat, lng]}
            radius={live ? 60 : 120}
            pathOptions={{ color: pulse ? '#ff3b5c' : '#00e0b8', fillOpacity: 0.12, weight: 1.5 }}
          />
        )}
        {destination && (
          <Marker position={[destination.lat, destination.lng]} icon={destinationIcon}>
            <Popup>{destination.label || 'Destination'}</Popup>
          </Marker>
        )}
        {path && path.length > 1 && (
          <Polyline
            positions={path}
            pathOptions={{ color: '#00e0b8', weight: 3, opacity: 0.75, dashArray: '2 10' }}
          />
        )}
        {markers.map((m) => (
          <Marker key={m.key ?? m.label} position={[m.lat, m.lng]} icon={poiIcon}>
            <Popup>{m.label}</Popup>
          </Marker>
        ))}
        {hasMarkers ? (
          <FitToMarkers key={key} lat={lat} lng={lng} markers={fitMarkers} />
        ) : (
          <Recenter lat={lat} lng={lng} />
        )}
        {onMapClick && <ClickToSetPoint onMapClick={onMapClick} />}
        <ResizeFix />
      </MapContainer>
      <div className="live-map__badge">{live ? 'Live GPS' : 'Demo location'} · {label}</div>
      {onMapClick && <div className="live-map__pick-hint">Tap the map to drop a pin</div>}
    </div>
  );
}
