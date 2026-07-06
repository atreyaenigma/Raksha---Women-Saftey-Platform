import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { nanoid } from 'nanoid';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { readDb, writeDb } from './db.js';
import { dispatchAlert } from './notify.js';

const app = express();
const PORT = process.env.PORT || 4000;
const ALLOWED_ORIGIN = process.env.FRONTEND_URL || 'http://localhost:5173';
const JWT_SECRET = process.env.JWT_SECRET || 'raksha-dev-secret-change-me';
const TOKEN_TTL = '7d';

// Strips the password hash before a user record ever leaves the server.
function publicUser(u) {
  const { passwordHash, ...safe } = u;
  return safe;
}

function signToken(u) {
  return jwt.sign({ id: u.id, name: u.name, email: u.email, role: u.role }, JWT_SECRET, { expiresIn: TOKEN_TTL });
}

// Reads + verifies the Bearer token on a request, if any. Returns null (never throws)
// so routes that only *optionally* care about the caller's identity can use it freely.
function getAuthedUser(req) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return null;
  try { return jwt.verify(token, JWT_SECRET); } catch { return null; }
}

function requireAuth(req, res, next) {
  const user = getAuthedUser(req);
  if (!user) return res.status(401).json({ error: 'Please log in to continue.' });
  req.authUser = user;
  next();
}

function requireAdmin(req, res, next) {
  const user = getAuthedUser(req);
  if (!user) return res.status(401).json({ error: 'Please log in to continue.' });
  if (user.role !== 'admin') return res.status(403).json({ error: 'Admin access required.' });
  req.authUser = user;
  next();
}

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
// AUTH — user + admin accounts, JWT-based sessions
// ============================================================
const authLimiter = rateLimit({ windowMs: 60_000, max: 20, message: { error: 'Too many attempts. Please wait a moment and try again.' } });

app.post('/api/auth/register', authLimiter, async (req, res) => {
  const { name, email, password } = req.body || {};
  if (!name?.trim()) return res.status(400).json({ error: 'Name is required.' });
  if (!email?.trim() || !/^\S+@\S+\.\S+$/.test(email)) return res.status(400).json({ error: 'Enter a valid email address.' });
  if (!password || password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters.' });

  const db = await readDb();
  if (db.users.some((u) => u.email.toLowerCase() === email.trim().toLowerCase()))
    return res.status(409).json({ error: 'An account with this email already exists.' });

  const passwordHash = await bcrypt.hash(password, 10);
  const user = {
    id: nanoid(10),
    name: name.trim(),
    email: email.trim().toLowerCase(),
    passwordHash,
    role: 'user', // sign-up always creates a regular user — admin accounts are provisioned separately
    createdAt: new Date().toISOString(),
    lastLoginAt: null,
  };
  db.users.push(user);
  await writeDb(db);

  res.status(201).json({ token: signToken(user), user: publicUser(user) });
});

app.post('/api/auth/login', authLimiter, async (req, res) => {
  const { email, password, role } = req.body || {};
  if (!email?.trim() || !password) return res.status(400).json({ error: 'Email and password are required.' });

  const db = await readDb();
  const user = db.users.find((u) => u.email.toLowerCase() === email.trim().toLowerCase());
  if (!user) return res.status(401).json({ error: 'Invalid email or password.' });

  const match = await bcrypt.compare(password, user.passwordHash);
  if (!match) return res.status(401).json({ error: 'Invalid email or password.' });

  if (role && role !== user.role)
    return res.status(403).json({ error: `This account is registered as ${user.role === 'admin' ? 'an Admin' : 'a User'}. Switch tabs and try again.` });

  user.lastLoginAt = new Date().toISOString();
  await writeDb(db);

  res.json({ token: signToken(user), user: publicUser(user) });
});

app.get('/api/auth/me', requireAuth, async (req, res) => {
  const db = await readDb();
  const user = db.users.find((u) => u.id === req.authUser.id);
  if (!user) return res.status(404).json({ error: 'User not found.' });
  res.json(publicUser(user));
});

// ============================================================
// ADMIN — read-only visibility into every registered user, their
// profile, and their SOS/incident history.
// ============================================================
app.get('/api/admin/users', requireAdmin, async (_req, res) => {
  const db = await readDb();
  const users = db.users.map((u) => ({
    ...publicUser(u),
    historyCount: db.history.filter((h) => h.userId === u.id).length,
    alertCount: db.alerts.filter((a) => a.userId === u.id).length,
  }));
  res.json(users);
});

app.get('/api/admin/users/:id', requireAdmin, async (req, res) => {
  const db = await readDb();
  const user = db.users.find((u) => u.id === req.params.id);
  if (!user) return res.status(404).json({ error: 'User not found.' });

  res.json({
    user: publicUser(user),
    history: db.history.filter((h) => h.userId === user.id),
    alerts: db.alerts.filter((a) => a.userId === user.id),
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
  const authUser = getAuthedUser(req);
  const entry = { id: nanoid(8), time: new Date().toISOString(), status: 'resolved', userId: authUser?.id || null, ...req.body };
  db.history.unshift(entry);
  await writeDb(db);
  res.status(201).json(entry);
});

// ============================================================
// ALERTS — the real SOS trigger
// ============================================================
app.post('/api/alerts/trigger', sosLimiter, async (req, res) => {
  const { lat, lng, locationLabel, triggeredBy, accuracy, note } = req.body || {};

  if (!lat || !lng)
    return res.status(400).json({ error: 'lat and lng are required' });

  const db = await readDb();
  const authUser = getAuthedUser(req);
  const alert = {
    id: nanoid(8),
    time: new Date().toISOString(),
    lat: Number(lat),
    lng: Number(lng),
    accuracy: accuracy ? Number(accuracy) : null,
    locationLabel: locationLabel || `${lat}, ${lng}`,
    triggeredBy: triggeredBy || 'manual',
    note: note || null,
    status: 'active',
    ip: req.ip,
    userId: authUser?.id || null,
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
    userId: alert.userId,
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
// ROUTE REVIEWS — community safety ratings for roads/paths people have
// actually walked, so others can check a route before they take it.
// ============================================================
const RATING_FIELDS = ['safety', 'lighting', 'crowd', 'roadCondition', 'policePresence'];

function haversineKm(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

app.get('/api/routes/reviews', async (req, res) => {
  const db = await readDb();
  const { lat, lng, radiusKm } = req.query;
  let reviews = db.routeReviews;
  if (lat && lng) {
    const radius = radiusKm ? Number(radiusKm) : 5;
    reviews = reviews.filter((r) => haversineKm(Number(lat), Number(lng), r.midLat, r.midLng) <= radius);
  }
  res.json(reviews);
});

app.post('/api/routes/reviews', async (req, res) => {
  const { startLat, startLng, endLat, endLng, routeName, ratings, comment, travelMode } = req.body || {};

  const coordsOk = [startLat, startLng, endLat, endLng].every((v) => Number.isFinite(Number(v)));
  if (!coordsOk)
    return res.status(400).json({ error: 'startLat, startLng, endLat and endLng are required numbers' });

  const ratingsOk = ratings && RATING_FIELDS.every((f) => Number(ratings[f]) >= 1 && Number(ratings[f]) <= 5);
  if (!ratingsOk)
    return res.status(400).json({ error: `ratings.{${RATING_FIELDS.join(', ')}} are required, each 1-5` });

  const db = await readDb();
  const review = {
    id: nanoid(8),
    time: new Date().toISOString(),
    routeName: routeName?.trim() || null,
    startLat: Number(startLat), startLng: Number(startLng),
    endLat: Number(endLat), endLng: Number(endLng),
    midLat: (Number(startLat) + Number(endLat)) / 2,
    midLng: (Number(startLng) + Number(endLng)) / 2,
    travelMode: travelMode || 'walk',
    ratings: Object.fromEntries(RATING_FIELDS.map((f) => [f, Number(ratings[f])])),
    comment: comment?.trim().slice(0, 500) || '',
  };
  db.routeReviews.unshift(review);
  await writeDb(db);
  res.status(201).json(review);
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
