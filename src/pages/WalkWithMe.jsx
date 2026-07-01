import { useState, useEffect } from 'react';
import { Footprints, CheckCircle2, Clock } from 'lucide-react';
import { useApp } from '../context/AppContext';
import './WalkWithMe.css';

export default function WalkWithMe() {
  const { checkIn, startCheckIn, confirmSafeArrival, contacts } = useApp();
  const [destination, setDestination] = useState('');
  const [minutes, setMinutes] = useState(15);
  const [remaining, setRemaining] = useState(0);

  useEffect(() => {
    if (!checkIn) return;
    const tick = () => setRemaining(Math.max(0, Math.round((checkIn.endsAt - Date.now()) / 1000)));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [checkIn]);

  const fmt = (s) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

  return (
    <section className="walk">
      <div className="container walk__inner">
        <div className="walk__head">
          <span className="how__eyebrow">Walk with me</span>
          <h1>Set a safety timer for your journey</h1>
          <p>
            Tell us where you're headed and how long it should take. If you don't check in before
            the timer runs out, we automatically trigger an SOS alert to your trusted circle —
            no need to remember to do it yourself mid-walk.
          </p>
        </div>

        {!checkIn ? (
          <div className="walk__panel">
            <label>
              Destination
              <input
                type="text"
                placeholder="e.g. Home, Metro station, Friend's place"
                value={destination}
                onChange={(e) => setDestination(e.target.value)}
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
                onChange={(e) => setMinutes(Number(e.target.value))}
              />
            </label>
            <p className="walk__note">
              <Clock size={14} /> {contacts.length} contact{contacts.length !== 1 ? 's' : ''} will be alerted automatically if the timer expires.
            </p>
            <button
              className="btn btn--primary walk__start"
              disabled={!destination.trim()}
              onClick={() => startCheckIn(destination.trim(), minutes)}
            >
              <Footprints size={16} /> Start walk timer
            </button>
          </div>
        ) : (
          <div className="walk__active">
            <div className="walk__countdown">{fmt(remaining)}</div>
            <p>Walking to <strong>{checkIn.destination}</strong> — check in before the timer hits zero.</p>
            <button className="btn btn--primary walk__arrived" onClick={confirmSafeArrival}>
              <CheckCircle2 size={16} /> I've arrived safely
            </button>
            <span className="walk__hint">If the timer runs out, an SOS alert fires automatically.</span>
          </div>
        )}
      </div>
    </section>
  );
}
