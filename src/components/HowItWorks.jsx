import { Hand, MapPinned, BellRing, ShieldCheck } from 'lucide-react';
import './HowItWorks.css';

const steps = [
  {
    icon: Hand,
    title: 'Trigger the alert',
    desc: 'Press the SOS button, use a shake gesture, or speak a safe word. No fumbling for apps mid-emergency.',
  },
  {
    icon: MapPinned,
    title: 'Location locks in',
    desc: 'Your live GPS coordinates are captured instantly and refreshed every few seconds while the alert stays active.',
  },
  {
    icon: BellRing,
    title: 'Circle gets notified',
    desc: 'Trusted contacts, nearby authorities, and emergency services receive your status, message, and live map link.',
  },
  {
    icon: ShieldCheck,
    title: 'Stay tracked until safe',
    desc: 'The incident stays logged and monitored until you mark yourself safe — nothing closes itself silently.',
  },
];

export default function HowItWorks() {
  return (
    <section className="how" id="how-it-works">
      <div className="container">
        <div className="how__head">
          <span className="how__eyebrow">The response chain</span>
          <h2 className="how__title">From a single tap to a closed loop of help</h2>
        </div>

        <div className="how__grid">
          {steps.map((s, i) => (
            <div className="how__card" key={s.title} style={{ animationDelay: `${i * 0.08}s` }}>
              <span className="how__index">{String(i + 1).padStart(2, '0')}</span>
              <s.icon className="how__icon" size={26} strokeWidth={1.8} />
              <h3>{s.title}</h3>
              <p>{s.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
