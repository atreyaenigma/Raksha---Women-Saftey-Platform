import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Footprints } from 'lucide-react';
import { useApp } from '../context/AppContext';
import './CheckInBanner.css';

export default function CheckInBanner() {
  const { checkIn } = useApp();
  const [remaining, setRemaining] = useState(0);

  useEffect(() => {
    if (!checkIn) return;
    const tick = () => setRemaining(Math.max(0, Math.round((checkIn.endsAt - Date.now()) / 1000)));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [checkIn]);

  if (!checkIn) return null;
  const fmt = (s) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

  return (
    <Link to="/walk-with-me" className="check-banner">
      <Footprints size={14} />
      <span>Walking to {checkIn.destination} — {fmt(remaining)} left to check in</span>
    </Link>
  );
}
