import { Link, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { ArrowRight, MapPin, Radio } from 'lucide-react';
import './Hero.css';

export default function Hero() {
  const [pressed, setPressed] = useState(false);
  const navigate = useNavigate();

  return (
    <section className="hero">
      <div className="container hero__inner">
        <div className="hero__copy">
          <span className="hero__eyebrow">
            <Radio size={14} /> Always listening for your signal
          </span>
          <h1 className="hero__title">
            One tap sends help.
            <br />
            Before trouble <span className="hero__title-accent">finds you.</span>
          </h1>
          <p className="hero__sub">
            RakshaLink is an emergency SOS system with live location sharing — built for the seconds
            that matter most. Alert your trusted circle, nearby authorities, and emergency services
            the instant something feels wrong.
          </p>
          <div className="hero__actions">
            <Link to="/sos" className="btn btn--primary">
              Try the SOS demo <ArrowRight size={17} />
            </Link>
            <Link to="/dashboard" className="btn btn--ghost">
              View dashboard
            </Link>
          </div>
          <div className="hero__stats">
            <div>
              <strong>2.3s</strong>
              <span>Avg. alert dispatch</span>
            </div>
            <div>
              <strong>24/7</strong>
              <span>Live monitoring</span>
            </div>
            <div>
              <strong>100%</strong>
              <span>Location accuracy</span>
            </div>
          </div>
        </div>

        <div className="hero__visual">
          <div className="sonar">
            <div className="sonar__ring sonar__ring--1" />
            <div className="sonar__ring sonar__ring--2" />
            <div className="sonar__ring sonar__ring--3" />
            <button
              className={`sonar__core ${pressed ? 'sonar__core--pressed' : ''}`}
              onMouseDown={() => setPressed(true)}
              onMouseUp={() => setPressed(false)}
              onMouseLeave={() => setPressed(false)}
              onClick={() => navigate('/sos')}
              aria-label="Go to SOS Center — hold the button there to send an alert"
            >
              SOS
            </button>
          </div>
          <div className="hero__location-chip">
            <MapPin size={15} />
            <span>Sharing live location…</span>
            <span className="hero__location-dot" />
          </div>
        </div>
      </div>
    </section>
  );
}
