import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import './CtaBand.css';

export default function CtaBand() {
  return (
    <section className="cta-band">
      <div className="container cta-band__inner">
        <div>
          <h2>Set up your safety circle in under two minutes.</h2>
          <p>Add trusted contacts now, so the platform already knows who to call when it matters.</p>
        </div>
        <Link to="/contacts" className="btn btn--primary">
          Add trusted contacts <ArrowRight size={17} />
        </Link>
      </div>
    </section>
  );
}
