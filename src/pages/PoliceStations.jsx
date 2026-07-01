import { Building2, Navigation, Phone } from 'lucide-react';
import { useApp } from '../context/AppContext';
import './PoliceStations.css';

// Demo dataset — in production this would come from a places API keyed off live location.
const STATIONS = [
  { name: 'Connaught Place Police Station', distance: '0.8 km', phone: '+91 11 2334 1234' },
  { name: 'Parliament Street Police Station', distance: '1.4 km', phone: '+91 11 2336 5678' },
  { name: 'Mandir Marg Police Station', distance: '2.1 km', phone: '+91 11 2336 9012' },
  { name: "Women's Help Desk — North District", distance: '2.6 km', phone: '1091' },
];

export default function PoliceStations() {
  const { location } = useApp();
  const mapsQuery = encodeURIComponent('police station near ' + (location.live ? `${location.lat},${location.lng}` : location.label));

  return (
    <section className="ps">
      <div className="container">
        <div className="ps__head">
          <span className="how__eyebrow">Nearby help</span>
          <h1>Police stations & help desks near you</h1>
          <p>Based on {location.live ? 'your live location' : location.label}. Distances are approximate.</p>
        </div>

        <a
          className="btn btn--ghost ps__maps-link"
          href={`https://www.google.com/maps/search/${mapsQuery}`}
          target="_blank" rel="noreferrer"
        >
          <Navigation size={16} /> Open full map search
        </a>

        <ul className="ps__list">
          {STATIONS.map((s) => (
            <li key={s.name} className="ps__item">
              <div className="ps__icon"><Building2 size={20} /></div>
              <div className="ps__meta">
                <strong>{s.name}</strong>
                <span>{s.distance} away</span>
              </div>
              <a className="ps__call" href={`tel:${s.phone}`}><Phone size={14} /> Call</a>
            </li>
          ))}
        </ul>

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
