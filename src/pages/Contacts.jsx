import { useState } from 'react';
import { UserPlus, Trash2, Phone } from 'lucide-react';
import { useApp } from '../context/AppContext';
import './Contacts.css';

export default function Contacts() {
  const { contacts, addContact, removeContact } = useApp();
  const [form, setForm] = useState({ name: '', relation: '', phone: '' });
  const [error, setError] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.name.trim() || !form.phone.trim()) {
      setError('Name and phone number are required.');
      return;
    }
    addContact(form);
    setForm({ name: '', relation: '', phone: '' });
    setError('');
  };

  return (
    <section className="contacts">
      <div className="container">
        <div className="contacts__head">
          <span className="how__eyebrow">Trusted circle</span>
          <h1>Manage emergency contacts</h1>
          <p>These are the people notified the instant you trigger an SOS alert — along with your live location.</p>
        </div>

        <div className="contacts__grid">
          <form className="contacts__form" onSubmit={handleSubmit}>
            <h3><UserPlus size={16} /> Add a contact</h3>

            <label>
              Full name
              <input
                type="text"
                placeholder="e.g. Priya Sharma"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </label>

            <label>
              Relationship
              <input
                type="text"
                placeholder="e.g. Sister, Friend, Colleague"
                value={form.relation}
                onChange={(e) => setForm({ ...form, relation: e.target.value })}
              />
            </label>

            <label>
              Phone number
              <input
                type="tel"
                placeholder="+91 00000 00000"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
              />
            </label>

            {error && <span className="contacts__error">{error}</span>}

            <button type="submit" className="btn btn--primary contacts__submit">
              <UserPlus size={16} /> Add to trusted circle
            </button>
          </form>

          <div className="contacts__list-wrap">
            <h3>{contacts.length} contact{contacts.length !== 1 ? 's' : ''} in your circle</h3>
            {contacts.length === 0 ? (
              <p className="dash__empty">No contacts added yet — they won't be notified during an alert until you add at least one.</p>
            ) : (
              <ul className="contacts__list">
                {contacts.map((c) => (
                  <li key={c.id} className="contacts__item">
                    <div className="sosc__avatar">{c.name.charAt(0)}</div>
                    <div className="contacts__item-meta">
                      <strong>{c.name}</strong>
                      <span>{c.relation || 'Trusted contact'}</span>
                      <a href={`tel:${c.phone}`} className="contacts__phone"><Phone size={12} /> {c.phone}</a>
                    </div>
                    <button
                      className="contacts__remove"
                      onClick={() => removeContact(c.id)}
                      aria-label={`Remove ${c.name}`}
                    >
                      <Trash2 size={16} />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
