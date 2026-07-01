import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { nanoid } from 'nanoid';
import { readDb, writeDb } from './db.js';
import { dispatchAlert } from './notify.js';

const app = express();
const PORT = process.env.PORT || 4000;
const ALLOWED_ORIGIN = process.env.FRONTEND_URL || 'http://localhost:5173';

// --- Security headers ---
app.use(helmet());

// --- CORS: only allow your frontend ---
app.use(cors({
  origin: [ALLOWED_ORIGIN, 'http://localhost:5173'],
  methods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type'],
}));

app.use(express.json());

// --- Rate limiting ---
// General API: 100 req/min
app.use('/api/', rateLimit({ windowMs: 60_000, max: 100, standardHeaders: true, legacyHeaders: false }));

// SOS trigger: max 10 per 5 minutes per IP (prevents spam)
const sosLimiter = rateLimit({ windowMs: 5 * 60_000, max: 10, message: { error: 'Too many SOS requests. Please call 112 directly.' } });

// --- Health check ---
app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    twilio: !!(process.env.TWILIO_SID && process.env.TWILIO_AUTH_TOKEN),
    timestamp: new Date().toISOString(),
  });
});

// ============================================================
// CONTACTS
// ============================================================
app.get('/api/contacts', async (_req, res) => {
  const db = await readDb();
  res.json(db.contacts);
});

app.post('/api/contacts', async (req, res) => {
  const { name, relation, phone } = req.body || {};
  if (!name?.trim() || !phone?.trim())
    return res.status(400).json({ error: 'name and phone are required' });

  const db = await readDb();
  const contact = { id: nanoid(8), name: name.trim(), relation: relation?.trim() || 'Trusted contact', phone: phone.trim() };
  db.contacts.push(contact);
  await writeDb(db);
  res.status(201).json(contact);
});

app.delete('/api/contacts/:id', async (req, res) => {
  const db = await readDb();
  db.contacts = db.contacts.filter((c) => c.id !== req.params.id);
  await writeDb(db);
  res.status(204).end();
});

// ============================================================
// HISTORY
// ============================================================
app.get('/api/history', async (_req, res) => {
  const db = await readDb();
  res.json(db.history);
});

app.post('/api/history', async (req, res) => {
  const db = await readDb();
  const entry = { id: nanoid(8), time: new Date().toISOString(), status: 'resolved', ...req.body };
  db.history.unshift(entry);
  await writeDb(db);
  res.status(201).json(entry);
});

// ============================================================
// ALERTS — the real SOS trigger
// ============================================================
app.post('/api/alerts/trigger', sosLimiter, async (req, res) => {
  const { lat, lng, locationLabel, triggeredBy, accuracy } = req.body || {};

  if (!lat || !lng)
    return res.status(400).json({ error: 'lat and lng are required' });

  const db = await readDb();
  const alert = {
    id: nanoid(8),
    time: new Date().toISOString(),
    lat: Number(lat),
    lng: Number(lng),
    accuracy: accuracy ? Number(accuracy) : null,
    locationLabel: locationLabel || `${lat}, ${lng}`,
    triggeredBy: triggeredBy || 'manual',
    status: 'active',
    ip: req.ip,
  };

  console.log(`\n🚨 SOS TRIGGERED — ${alert.locationLabel} (via ${alert.triggeredBy}) at ${alert.time}`);

  // Fan out to all contacts
  const dispatchResults = await dispatchAlert(db.contacts, alert);
  alert.notified = dispatchResults;
  alert.notifiedCount = dispatchResults.filter((r) => r.status === 'sent').length;

  // Persist alert + history entry
  db.alerts.unshift(alert);
  db.history.unshift({
    id: nanoid(8),
    time: alert.time,
    type: 'SOS Triggered',
    location: alert.locationLabel,
    trigger: alert.triggeredBy,
    status: 'active',
    alertId: alert.id,
  });
  await writeDb(db);

  res.status(201).json(alert);
});

app.post('/api/alerts/:id/resolve', async (req, res) => {
  const db = await readDb();
  const alert = db.alerts.find((a) => a.id === req.params.id);
  if (alert) alert.status = 'resolved';
  const histEntry = db.history.find((h) => h.alertId === req.params.id);
  if (histEntry) histEntry.status = 'resolved';
  await writeDb(db);

  // Optionally notify contacts that person is safe
  if (alert && db.contacts.length) {
    const safeMsg = `✅ RakshaLink: The person who triggered an SOS alert is now safe. Alert ID: ${alert.id}`;
    if (process.env.TWILIO_SID) {
      const twilio = (await import('twilio')).default;
      const client = twilio(process.env.TWILIO_SID, process.env.TWILIO_AUTH_TOKEN);
      await Promise.all(db.contacts.map((c) =>
        client.messages.create({ to: c.phone, from: process.env.TWILIO_FROM_NUMBER, body: safeMsg }).catch(() => {})
      ));
    }
  }

  res.json(alert || { error: 'Alert not found' });
});

app.get('/api/alerts', async (_req, res) => {
  const db = await readDb();
  res.json(db.alerts);
});

// ============================================================
// TWILIO WEBHOOK — incoming "SAFE" reply from a contact
// ============================================================
app.post('/api/webhooks/twilio-reply', express.urlencoded({ extended: false }), async (req, res) => {
  const body = (req.body?.Body || '').trim().toUpperCase();
  const from = req.body?.From || '';
  console.log(`[webhook] SMS from ${from}: "${body}"`);

  if (body === 'SAFE') {
    const db = await readDb();
    const contact = db.contacts.find((c) => c.phone === from || c.phone.replace(/\s/g, '') === from.replace(/\s/g, ''));
    if (contact) {
      db.history.unshift({
        id: nanoid(8),
        time: new Date().toISOString(),
        type: 'Contact replied SAFE',
        location: 'via SMS',
        trigger: `Reply from ${contact.name}`,
        status: 'closed',
      });
      await writeDb(db);
    }
  }

  // Twilio expects TwiML response
  res.set('Content-Type', 'text/xml');
  res.send('<Response></Response>');
});

app.listen(PORT, () => {
  console.log(`\n✅ RakshaLink API running on port ${PORT}`);
  console.log(`   Twilio SMS: ${process.env.TWILIO_SID ? '✓ configured' : '✗ not set (mock mode)'}`);
  console.log(`   Frontend:   ${ALLOWED_ORIGIN}\n`);
});
