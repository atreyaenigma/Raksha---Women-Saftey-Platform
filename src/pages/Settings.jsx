import { useState } from 'react';
import { Mic, Smartphone, Video, MapPin, ShieldAlert, Navigation, CheckCircle2 } from 'lucide-react';
import { useApp } from '../context/AppContext';
import './Settings.css';

export default function Settings() {
  const { settings, updateSettings, geoStatus, requestLiveLocation, startLocationWatch, stopLocationWatch, location, backendOnline } = useApp();
  const [safeWordDraft, setSafeWordDraft] = useState(settings.safeWord);
  const [motionStatus, setMotionStatus] = useState('idle'); // idle | granted | denied

  const speechSupported = typeof window !== 'undefined' && !!(window.SpeechRecognition || window.webkitSpeechRecognition);

  // iOS 13+ requires a user gesture to enable DeviceMotionEvent
  const requestMotionPermission = async () => {
    if (typeof DeviceMotionEvent?.requestPermission === 'function') {
      try {
        const result = await DeviceMotionEvent.requestPermission();
        if (result === 'granted') {
          setMotionStatus('granted');
          updateSettings({ shakeEnabled: true });
        } else {
          setMotionStatus('denied');
        }
      } catch { setMotionStatus('denied'); }
    } else {
      // Android / desktop — permission not needed
      setMotionStatus('granted');
      updateSettings({ shakeEnabled: true });
    }
  };

  const geoLabel = {
    idle: 'Not active — using demo location.',
    locating: 'Getting your location…',
    live: `One-shot · ${location.lat.toFixed(5)}, ${location.lng.toFixed(5)}`,
    watching: `Continuous · ${location.lat.toFixed(5)}, ${location.lng.toFixed(5)} (±${location.accuracy ? Math.round(location.accuracy) + 'm' : '?'})`,
    denied: 'Permission denied — check browser site settings.',
    unsupported: 'Geolocation not supported in this browser.',
  }[geoStatus] || '';

  return (
    <section className="settings">
      <div className="container">
        <div className="settings__head">
          <span className="how__eyebrow">Configure</span>
          <h1>Safety settings</h1>
          <p>Control how the platform listens and responds. All triggers run in your browser — your data is only sent when an alert fires.</p>
          <div className={`settings__backend ${backendOnline ? 'is-online' : ''}`}>
            <span className="settings__backend-dot" />
            {backendOnline ? 'Server connected — SMS dispatch is live' : 'Offline mode — alerts stay on this device only'}
          </div>
        </div>

        <div className="settings__grid">

          {/* Location */}
          <div className="settings__card">
            <div className="settings__card-head">
              <MapPin size={18} />
              <div>
                <h3>GPS location</h3>
                <p>Used in every alert. Continuous watch keeps it fresh while the app is open.</p>
              </div>
            </div>
            <div className="settings__row">
              <button className="btn btn--ghost settings__action" onClick={requestLiveLocation}>
                One-shot fix
              </button>
              <button className="btn btn--ghost settings__action" onClick={() => {
                if (settings.locationWatch) { stopLocationWatch(); updateSettings({ locationWatch: false }); }
                else { startLocationWatch(); updateSettings({ locationWatch: true }); }
              }}>
                {settings.locationWatch ? '⏹ Stop continuous watch' : '▶ Start continuous watch'}
              </button>
            </div>
            <span className="settings__status">{geoLabel}</span>
          </div>

          {/* Shake */}
          <div className="settings__card">
            <div className="settings__card-head">
              <Smartphone size={18} />
              <div>
                <h3>Shake to trigger SOS</h3>
                <p>Firm shake fires an alert — works even if you can't look at the screen. iOS requires explicit permission.</p>
              </div>
            </div>
            {motionStatus !== 'granted' && !settings.shakeEnabled ? (
              <button className="btn btn--ghost settings__action" onClick={requestMotionPermission}>
                Enable shake (grant motion access)
              </button>
            ) : (
              <Toggle
                checked={settings.shakeEnabled}
                onChange={(v) => updateSettings({ shakeEnabled: v })}
              />
            )}
            <span className="settings__status">
              {motionStatus === 'denied' ? 'Motion permission denied — check your iOS settings.' :
               motionStatus === 'granted' || settings.shakeEnabled ? 'Motion access granted.' :
               'Tap above to request motion permission (required on iOS 13+).'}
            </span>
          </div>

          {/* Voice */}
          <div className="settings__card">
            <div className="settings__card-head">
              <Mic size={18} />
              <div>
                <h3>Voice safe word</h3>
                <p>Say your chosen phrase out loud to fire an SOS hands-free.</p>
              </div>
            </div>
            <label className="settings__label">
              Your safe word / phrase
              <input
                className="settings__input"
                value={safeWordDraft}
                onChange={(e) => setSafeWordDraft(e.target.value)}
                onBlur={() => updateSettings({ safeWord: safeWordDraft })}
                placeholder="e.g. help me now"
              />
            </label>
            <Toggle
              checked={settings.voiceEnabled}
              onChange={(v) => updateSettings({ voiceEnabled: v, safeWord: safeWordDraft })}
              disabled={!speechSupported}
            />
            <span className="settings__status">
              {speechSupported
                ? settings.voiceEnabled ? `Listening for "${settings.safeWord}"` : 'Toggle on to start listening.'
                : 'Web Speech API not supported in this browser. Try Chrome.'}
            </span>
          </div>

          {/* Evidence */}
          <div className="settings__card">
            <div className="settings__card-head">
              <Video size={18} />
              <div>
                <h3>Record audio evidence</h3>
                <p>Mic starts automatically when SOS fires. Recording downloads when you mark yourself safe.</p>
              </div>
            </div>
            <Toggle checked={settings.recordEvidence} onChange={(v) => updateSettings({ recordEvidence: v })} />
            <span className="settings__status">
              {settings.recordEvidence
                ? 'Audio will be captured and offered as a download when the alert ends.'
                : 'Recording disabled.'}
            </span>
          </div>

        </div>

        <div className="settings__twilio-card">
          <h3>Real SMS dispatch (Twilio)</h3>
          <p>To send real SMS alerts to your contacts, add these to <code>server/.env</code>:</p>
          <div className="settings__code-block">
            <code>TWILIO_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx</code>
            <code>TWILIO_AUTH_TOKEN=your_auth_token_here</code>
            <code>TWILIO_FROM_NUMBER=+1xxxxxxxxxx</code>
          </div>
          <p>Get these free from <strong>twilio.com/console</strong> — a trial account sends SMS immediately with no charge for the first few hundred messages.</p>
          <div className={`settings__sms-status ${backendOnline ? 'is-live' : ''}`}>
            {backendOnline
              ? <><CheckCircle2 size={14} /> Server connected — check terminal to see if Twilio is active.</>
              : <><ShieldAlert size={14} /> Backend not detected — run <code>npm run dev:full</code></>}
          </div>
        </div>

      </div>
    </section>
  );
}

function Toggle({ checked, onChange, disabled }) {
  return (
    <button
      className={`settings__toggle ${checked ? 'is-on' : ''}`}
      onClick={() => !disabled && onChange(!checked)}
      disabled={disabled}
      role="switch"
      aria-checked={checked}
    >
      <span className="settings__toggle-knob" />
    </button>
  );
}
