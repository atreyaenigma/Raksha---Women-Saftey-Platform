import { readFile, writeFile, access } from 'fs/promises';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = path.join(__dirname, 'db.json');

const DEFAULTS = {
  contacts: [
    { id: 'c1', name: 'Aanya Kapoor', relation: 'Sister', phone: '+91 98765 43210' },
    { id: 'c2', name: 'Rohan Mehta', relation: 'Friend', phone: '+91 91234 56780' },
    { id: 'c3', name: 'Mom', relation: 'Parent', phone: '+91 99887 76655' },
  ],
  history: [],
  alerts: [],
};

async function ensureDb() {
  try {
    await access(DB_PATH);
  } catch {
    await writeFile(DB_PATH, JSON.stringify(DEFAULTS, null, 2));
  }
}

export async function readDb() {
  await ensureDb();
  const raw = await readFile(DB_PATH, 'utf-8');
  return JSON.parse(raw);
}

export async function writeDb(data) {
  await writeFile(DB_PATH, JSON.stringify(data, null, 2));
}
