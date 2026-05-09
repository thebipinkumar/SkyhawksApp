import { createClient, Client, Row } from '@libsql/client';
import bcrypt from 'bcryptjs';

let client: Client;
let initialized = false;

export function getDb(): Client {
  if (!client) {
    client = createClient({
      url:       process.env.TURSO_DATABASE_URL || 'file:./skyhawks.db',
      authToken: process.env.TURSO_AUTH_TOKEN,
    });
  }
  return client;
}

/** Convert a libsql Row to a plain JS object safe for JSON.stringify */
export function row(r: Row | null | undefined): any {
  return r ? Object.fromEntries(Object.entries(r)) : null;
}

/** Convert an array of libsql Rows to plain objects */
export function rows(rs: Row[]): any[] {
  return rs.map(r => Object.fromEntries(Object.entries(r)));
}

export async function initDb(): Promise<void> {
  if (initialized) return;
  const db = getDb();
  await db.executeMultiple(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'player' CHECK(role IN ('player','manager','selector','admin')),
      phone TEXT,
      bio TEXT,
      avatar_url TEXT,
      avatar_public_id TEXT,
      batting_style TEXT,
      bowling_style TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS matches (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      opponent TEXT NOT NULL,
      venue TEXT NOT NULL,
      match_date TEXT NOT NULL,
      match_time TEXT NOT NULL,
      match_type TEXT NOT NULL DEFAULT 'T20' CHECK(match_type IN ('T20','ODI','Test','Practice')),
      status TEXT NOT NULL DEFAULT 'scheduled' CHECK(status IN ('scheduled','completed','cancelled')),
      result TEXT,
      notes TEXT,
      created_by INTEGER NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (created_by) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS team_selections (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      match_id INTEGER NOT NULL,
      player_id INTEGER NOT NULL,
      role_in_match TEXT DEFAULT 'player',
      is_captain INTEGER DEFAULT 0,
      is_vice_captain INTEGER DEFAULT 0,
      selected_by INTEGER NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (match_id) REFERENCES matches(id),
      FOREIGN KEY (player_id) REFERENCES users(id),
      FOREIGN KEY (selected_by) REFERENCES users(id),
      UNIQUE(match_id, player_id)
    );

    CREATE TABLE IF NOT EXISTS announcements (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      match_id INTEGER NOT NULL,
      message TEXT NOT NULL,
      sent_by INTEGER NOT NULL,
      sent_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (match_id) REFERENCES matches(id),
      FOREIGN KEY (sent_by) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS budget_entries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT NOT NULL CHECK(type IN ('revenue','expense')),
      category TEXT NOT NULL,
      amount REAL NOT NULL,
      description TEXT NOT NULL,
      entry_date TEXT NOT NULL,
      created_by INTEGER NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (created_by) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS club_settings (
      id INTEGER PRIMARY KEY CHECK(id = 1),
      club_name TEXT NOT NULL DEFAULT 'Skyhawks Cricket Club',
      tagline TEXT NOT NULL DEFAULT 'Play Hard. Fly High.',
      founded TEXT NOT NULL DEFAULT '2018',
      description TEXT NOT NULL DEFAULT 'Skyhawks Cricket Club is a passionate amateur cricket community.',
      contact_email TEXT NOT NULL DEFAULT 'info@skyhawks.com',
      ground TEXT NOT NULL DEFAULT 'Skyhawks Cricket Ground, City Sports Complex',
      achievements TEXT NOT NULL DEFAULT '[]',
      logo_url TEXT,
      logo_public_id TEXT,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS banner_images (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      image_url TEXT NOT NULL,
      public_id TEXT,
      caption TEXT,
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_by INTEGER NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (created_by) REFERENCES users(id)
    );
  `);

  // Seed default club_settings row
  const settingsRow = await db.execute('SELECT COUNT(*) as n FROM club_settings');
  if (Number(settingsRow.rows[0][0]) === 0) {
    await db.execute('INSERT INTO club_settings (id) VALUES (1)');
  }

  // Seed demo accounts
  const userRow = await db.execute('SELECT COUNT(*) as n FROM users');
  if (Number(userRow.rows[0][0]) === 0) {
    const seed = [
      { name: 'Admin User',     email: 'admin@skyhawks.com',    pass: 'Admin@123',    role: 'admin' },
      { name: 'Team Manager',   email: 'manager@skyhawks.com',  pass: 'Manager@123',  role: 'manager' },
      { name: 'Chief Selector', email: 'selector@skyhawks.com', pass: 'Selector@123', role: 'selector' },
    ];
    for (const s of seed) {
      await db.execute({
        sql: 'INSERT INTO users (name, email, password_hash, role) VALUES (?,?,?,?)',
        args: [s.name, s.email, bcrypt.hashSync(s.pass, 10), s.role],
      });
    }
    console.log('\nSeeded demo accounts:');
    console.log('  Admin:    admin@skyhawks.com / Admin@123');
    console.log('  Manager:  manager@skyhawks.com / Manager@123');
    console.log('  Selector: selector@skyhawks.com / Selector@123\n');
  }

  initialized = true;
  console.log('Database ready.');
}
