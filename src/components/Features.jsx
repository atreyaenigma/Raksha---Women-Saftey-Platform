import {
  Users, MapPin, Siren, History, Route, Building2, FileWarning, LayoutDashboard,
  Footprints, Mic, Smartphone, Video,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import './Features.css';

const features = [
  { icon: Siren, title: 'SOS alert system', desc: 'One-tap or gesture-based emergency trigger with instant multi-channel dispatch.' },
  { icon: MapPin, title: 'Live location tracking', desc: 'Real GPS sharing pulled straight from your device, not a simulated pin.' },
  { icon: Footprints, title: 'Walk with me timer', desc: 'Set a countdown for a journey — miss your check-in and an SOS fires automatically.', to: '/walk-with-me' },
  { icon: Mic, title: 'Voice safe word', desc: 'Say a chosen phrase out loud to trigger an alert without touching your phone.', to: '/settings' },
  { icon: Smartphone, title: 'Shake to trigger', desc: 'A firm shake of your phone fires an SOS — useful when you can\'t look at the screen.', to: '/settings' },
  { icon: Video, title: 'Evidence recording', desc: 'Audio capture starts automatically the moment an alert goes active.' },
  { icon: Users, title: 'Trusted contact circle', desc: 'Organize family and friends who get notified the moment an alert fires.', to: '/contacts' },
  { icon: Building2, title: 'Nearby police stations', desc: 'Surface the closest stations and helplines based on your live position.', to: '/police-stations' },
  { icon: Route, title: 'Safe route suggestions', desc: 'Routes weighted toward lit, populated, and previously safe-reported paths.' },
  { icon: FileWarning, title: 'Incident reporting', desc: 'Log harassment or unsafe-area reports to build a community safety map.' },
  { icon: History, title: 'Emergency history', desc: 'A timestamped record of every alert, response, and resolution.', to: '/dashboard' },
  { icon: LayoutDashboard, title: 'Admin dashboard', desc: 'Operators monitor active alerts and response status in real time.', to: '/dashboard' },
];

export default function Features() {
  return (
    <section className="features" id="features">
      <div className="container">
        <div className="features__head">
          <span className="how__eyebrow">Inside the platform</span>
          <h2 className="how__title">Every module built around one goal — faster help</h2>
        </div>
        <div className="features__grid">
          {features.map((f, i) => {
            const Card = f.to ? Link : 'div';
            return (
              <Card to={f.to} className="feature-card" key={f.title} style={{ animationDelay: `${i * 0.05}s` }}>
                <div className="feature-card__icon"><f.icon size={20} strokeWidth={1.8} /></div>
                <h3>{f.title}</h3>
                <p>{f.desc}</p>
              </Card>
            );
          })}
        </div>
      </div>
    </section>
  );
}
