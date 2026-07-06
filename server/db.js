import { readFile, writeFile, access } from 'fs/promises';
import { fileURLToPath } from 'url';
import path from 'path';
import bcrypt from 'bcryptjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = path.join(__dirname, 'db.json');

// Default demo admin — change the password after first login in a real deployment.
export const DEFAULT_ADMIN_EMAIL = 'admin@rakshalink.app';
const DEFAULT_ADMIN_PASSWORD = 'Admin@123';

const DEFAULTS = {
  users: [],
  contacts: [
    { id: 'c1', name: 'Aanya Kapoor', relation: 'Sister', phone: '+91 98765 43210' },
    { id: 'c2', name: 'Rohan Mehta', relation: 'Friend', phone: '+91 91234 56780' },
    { id: 'c3', name: 'Mom', relation: 'Parent', phone: '+91 99887 76655' },
  ],
  history: [],
  alerts: [],
  routeReviews: [],
};

// Builds a fresh admin account (hashed password) — used both for a brand-new
// db.json and to backfill an older db.json that predates the users table.
async function seedAdmin() {
  const passwordHash = await bcrypt.hash(DEFAULT_ADMIN_PASSWORD, 10);
  return {
    id: 'u_admin',
    name: 'Platform Admin',
    email: DEFAULT_ADMIN_EMAIL,
    passwordHash,
    role: 'admin',
    createdAt: new Date().toISOString(),
    lastLoginAt: null,
  };
}

async function ensureDb() {
  try {
    await access(DB_PATH);
  } catch {
    const seeded = { ...DEFAULTS, users: [await seedAdmin()] };
    await writeFile(DB_PATH, JSON.stringify(seeded, null, 2));
  }
}

export async function readDb() {
  await ensureDb();
  const raw = await readFile(DB_PATH, 'utf-8');
  const data = JSON.parse(raw);
  // Fill in any collections an older db.json on disk predates (e.g. routeReviews).
  let changed = false;
  for (const key of Object.keys(DEFAULTS)) {
    if (!(key in data)) { data[key] = DEFAULTS[key]; changed = true; }
  }
  // Older db.json files won't have a users table at all — backfill one admin
  // account so the platform always has at least one admin login available.
  if (!Array.isArray(data.users) || data.users.length === 0) {
    data.users = [await seedAdmin()];
    changed = true;
  }
  if (changed) await writeFile(DB_PATH, JSON.stringify(data, null, 2));
  return data;
}

export async function writeDb(data) {
  await writeFile(DB_PATH, JSON.stringify(data, null, 2));
}
