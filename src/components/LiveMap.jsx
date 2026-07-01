import { MapContainer, TileLayer, Marker, Circle, useMap } from 'react-leaflet';
import { useEffect } from 'react';
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

function Recenter({ lat, lng }) {
  const map = useMap();
  useEffect(() => {
    map.setView([lat, lng], map.getZoom(), { animate: true });
  }, [lat, lng, map]);
  return null;
}

export default function LiveMap({ lat, lng, label, live, pulse = false, height = 220, zoom = 15 }) {
  return (
    <div className="live-map" style={{ height }}>
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
        <Marker position={[lat, lng]} />
        {pulse && (
          <Circle
            center={[lat, lng]}
            radius={live ? 60 : 120}
            pathOptions={{ color: pulse ? '#ff3b5c' : '#00e0b8', fillOpacity: 0.12, weight: 1.5 }}
          />
        )}
        <Recenter lat={lat} lng={lng} />
      </MapContainer>
      <div className="live-map__badge">{live ? 'Live GPS' : 'Demo location'} · {label}</div>
    </div>
  );
}
