import { useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { X } from 'lucide-react';
import './QuickExit.css';

export default function QuickExit() {
  const navigate = useNavigate();
  const loc = useLocation();
  const pressCount = useRef(0);
  const pressTimer = useRef(null);

  const exit = () => {
    navigate('/notes');
  };

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') {
        pressCount.current += 1;
        clearTimeout(pressTimer.current);
        pressTimer.current = setTimeout(() => { pressCount.current = 0; }, 900);
        if (pressCount.current >= 3) {
          pressCount.current = 0;
          exit();
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (loc.pathname === '/notes') return null;

  return (
    <button className="quick-exit" onClick={exit} title="Quick exit (or press Esc 3x)" aria-label="Quick exit to a disguised page">
      <X size={14} /> Quick exit
    </button>
  );
}
