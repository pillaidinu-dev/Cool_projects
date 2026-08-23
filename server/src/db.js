import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import bcrypt from 'bcryptjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = process.env.DB_PATH || path.join(__dirname, '..', 'plansync.db');

export const db = new DatabaseSync(DB_PATH);

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    name TEXT NOT NULL,
    bio TEXT DEFAULT '',
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS plans (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    host_id INTEGER NOT NULL REFERENCES users(id),
    title TEXT NOT NULL,
    description TEXT DEFAULT '',
    activity_type TEXT NOT NULL,
    location TEXT NOT NULL,
    plan_time TEXT NOT NULL,
    capacity INTEGER NOT NULL DEFAULT 1,
    status TEXT NOT NULL DEFAULT 'open',
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS plan_joins (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    plan_id INTEGER NOT NULL REFERENCES plans(id),
    user_id INTEGER NOT NULL REFERENCES users(id),
    status TEXT NOT NULL DEFAULT 'pending',
    created_at TEXT DEFAULT (datetime('now')),
    UNIQUE(plan_id, user_id)
  );

  CREATE TABLE IF NOT EXISTS plan_attendance (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    plan_id INTEGER NOT NULL REFERENCES plans(id),
    confirmer_id INTEGER NOT NULL REFERENCES users(id),
    confirmed_user_id INTEGER NOT NULL REFERENCES users(id),
    created_at TEXT DEFAULT (datetime('now')),
    UNIQUE(plan_id, confirmer_id, confirmed_user_id)
  );

  CREATE TABLE IF NOT EXISTS matches (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    plan_id INTEGER NOT NULL REFERENCES plans(id),
    user_a_id INTEGER NOT NULL REFERENCES users(id),
    user_b_id INTEGER NOT NULL REFERENCES users(id),
    created_at TEXT DEFAULT (datetime('now')),
    UNIQUE(plan_id, user_a_id, user_b_id)
  );

  CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    match_id INTEGER NOT NULL REFERENCES matches(id),
    sender_id INTEGER NOT NULL REFERENCES users(id),
    body TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now'))
  );
`);

function seedIfEmpty() {
  const { count } = db.prepare('SELECT COUNT(*) AS count FROM users').get();
  if (count > 0) return;

  const insertUser = db.prepare(
    'INSERT INTO users (email, password_hash, name, bio) VALUES (?, ?, ?, ?)'
  );
  const demoUsers = [
    ['maya@example.com', 'Loves bouldering and terrible puns.', 'Maya'],
    ['leo@example.com', 'Always down for sushi and live jazz.', 'Leo'],
    ['priya@example.com', 'Trail runs on weekends, chai enthusiast.', 'Priya'],
    ['sam@example.com', 'Board game nerd, amateur baker.', 'Sam'],
  ];
  const passwordHash = bcrypt.hashSync('password123', 10);
  const ids = demoUsers.map(([email, bio, name]) =>
    Number(insertUser.run(email, passwordHash, name, bio).lastInsertRowid)
  );

  const insertPlan = db.prepare(`
    INSERT INTO plans (host_id, title, description, activity_type, location, plan_time, capacity)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  const inDays = (n) => new Date(Date.now() + n * 86400000).toISOString();

  insertPlan.run(
    ids[0],
    'Saturday morning bouldering',
    "Beginner-friendly, I'll show you the ropes (well, no ropes in bouldering, but you get it).",
    'climbing',
    'Brooklyn Boulders',
    inDays(3),
    1
  );
  insertPlan.run(
    ids[1],
    'Omakase + jazz trio',
    'Dinner at 7, then a short walk to a jazz set. Casual, no pressure.',
    'food',
    'Lower East Side',
    inDays(5),
    1
  );
  insertPlan.run(
    ids[2],
    '6am trail run before work',
    'Easy 5k pace, coffee after if you survive.',
    'fitness',
    'Prospect Park',
    inDays(2),
    2
  );
  insertPlan.run(
    ids[3],
    'Board game night: Wingspan',
    'I own the game, just bring snacks and mild competitiveness.',
    'games',
    'Astoria',
    inDays(6),
    3
  );

  console.log('Seeded demo data. Demo login: maya@example.com / password123 (all demo users share this password).');
}

seedIfEmpty();
