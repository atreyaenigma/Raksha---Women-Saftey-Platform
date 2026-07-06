import { ShieldHalf, Phone } from 'lucide-react';
import { Link } from 'react-router-dom';
import './Footer.css';

export default function Footer() {
  return (
    <footer className="footer">
      <div className="container footer__inner">
        <div className="footer__brand">
          <div className="footer__brand-name">
            <ShieldHalf size={20} />
            <span>RakshaLink</span>
          </div>
          <p>Emergency SOS &amp; live location alerts, built for the moments that can't wait.</p>
        </div>

        <div className="footer__col">
          <h4>Platform</h4>
          <ul>
            <li><Link to="/dashboard">Dashboard</Link></li>
            <li><Link to="/contacts">Contacts</Link></li>
            <li><Link to="/sos">SOS Center</Link></li>
            <li><Link to="/walk-with-me">Walk With Me</Link></li>
          </ul>
        </div>

        <div className="footer__col">
          <h4>Safety resources</h4>
          <ul>
            <li><Link to="/police-stations">Nearby police stations</Link></li>
            <li><Link to="/settings">Voice & shake triggers</Link></li>
            <li><Link to="/dashboard">Incident history</Link></li>
          </ul>
        </div>

        <div className="footer__col footer__emergency">
          <h4>In immediate danger?</h4>
          <a className="footer__call" href="tel:112">
            <Phone size={15} /> Call 112
          </a>
          <p>This is a demo interface. Always contact local emergency services directly when at risk.</p>
        </div>
      </div>
      <div className="container footer__bottom">
        <span>© {new Date().getFullYear()} RakshaLink. Built for safety, not surveillance.</span>
      </div>
    </footer>
  );
}
