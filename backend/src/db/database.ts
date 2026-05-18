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
      match_type TEXT NOT NULL DEFAULT 'T20',
      status TEXT NOT NULL DEFAULT 'scheduled' CHECK(status IN ('scheduled','completed','cancelled')),
      result TEXT,
      notes TEXT,
      ball_type TEXT NOT NULL DEFAULT 'White',
      attire TEXT NOT NULL DEFAULT 'Colored',
      match_fee REAL,
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

    CREATE TABLE IF NOT EXISTS match_availability (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      match_id INTEGER NOT NULL,
      player_id INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'not_responded' CHECK(status IN ('available','not_available','maybe','not_responded')),
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (match_id) REFERENCES matches(id),
      FOREIGN KEY (player_id) REFERENCES users(id),
      UNIQUE(match_id, player_id)
    );

    CREATE TABLE IF NOT EXISTS user_roles (
      user_id INTEGER NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('player','manager','selector','admin')),
      PRIMARY KEY (user_id, role),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS merchandise_extras (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      jersey_number TEXT,
      jersey_label TEXT,
      whites_tshirt_size TEXT,
      whites_lower_size TEXT,
      whites_sleeve TEXT,
      whites_jersey_status TEXT NOT NULL DEFAULT 'required',
      colored_tshirt_size TEXT,
      colored_lower_size TEXT,
      colored_sleeve TEXT,
      colored_jersey_status TEXT NOT NULL DEFAULT 'required',
      created_by INTEGER NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (created_by) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS tournaments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      format TEXT,
      start_date TEXT,
      end_date TEXT,
      description TEXT,
      created_by INTEGER NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (created_by) REFERENCES users(id)
    );
  `);

  // Migrate: add status column to users for existing databases
  try {
    await db.execute(`ALTER TABLE users ADD COLUMN status TEXT NOT NULL DEFAULT 'active'`);
  } catch { /* column already exists */ }

  // Migrate: add password reset token columns
  try { await db.execute(`ALTER TABLE users ADD COLUMN reset_token TEXT`); } catch { /* exists */ }
  try { await db.execute(`ALTER TABLE users ADD COLUMN reset_token_expires DATETIME`); } catch { /* exists */ }

  // Migrate: jersey & kit preference columns
  const jerseyMigrations = [
    `ALTER TABLE users ADD COLUMN date_of_birth TEXT`,
    `ALTER TABLE users ADD COLUMN jersey_number TEXT`,
    `ALTER TABLE users ADD COLUMN jersey_label TEXT`,
    `ALTER TABLE users ADD COLUMN whites_tshirt_size TEXT`,
    `ALTER TABLE users ADD COLUMN whites_lower_size TEXT`,
    `ALTER TABLE users ADD COLUMN whites_sleeve TEXT`,
    `ALTER TABLE users ADD COLUMN colored_tshirt_size TEXT`,
    `ALTER TABLE users ADD COLUMN colored_lower_size TEXT`,
    `ALTER TABLE users ADD COLUMN colored_sleeve TEXT`,
    `ALTER TABLE users ADD COLUMN whites_jersey_status TEXT NOT NULL DEFAULT 'required'`,
    `ALTER TABLE users ADD COLUMN colored_jersey_status TEXT NOT NULL DEFAULT 'required'`,
  ];
  for (const sql of jerseyMigrations) { try { await db.execute(sql); } catch { /* exists */ } }

  // Migrate: membership dates on users
  try { await db.execute(`ALTER TABLE users ADD COLUMN membership_start TEXT`); } catch { /* exists */ }
  try { await db.execute(`ALTER TABLE users ADD COLUMN membership_end TEXT`); } catch { /* exists */ }

  // Migrate: social media links on club_settings
  try { await db.execute(`ALTER TABLE club_settings ADD COLUMN instagram_url TEXT`); } catch { /* exists */ }
  try { await db.execute(`ALTER TABLE club_settings ADD COLUMN facebook_url TEXT`); } catch { /* exists */ }

  // Migrate: scorecard link on matches
  try { await db.execute(`ALTER TABLE matches ADD COLUMN scorecard_url TEXT`); } catch { /* exists */ }

  // Migrate: tournament link + announcement flag on matches
  try { await db.execute(`ALTER TABLE matches ADD COLUMN tournament_id INTEGER REFERENCES tournaments(id)`); } catch { /* exists */ }
  try { await db.execute(`ALTER TABLE matches ADD COLUMN is_announced INTEGER NOT NULL DEFAULT 0`); } catch { /* exists */ }

  // Migrate: add ball_type, attire, match_fee to matches + remove old match_type CHECK constraint
  try {
    await db.execute('SELECT ball_type FROM matches LIMIT 1');
  } catch {
    await db.execute(`CREATE TABLE IF NOT EXISTS matches_new (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      opponent TEXT NOT NULL,
      venue TEXT NOT NULL,
      match_date TEXT NOT NULL,
      match_time TEXT NOT NULL,
      match_type TEXT NOT NULL DEFAULT 'T20',
      status TEXT NOT NULL DEFAULT 'scheduled' CHECK(status IN ('scheduled','completed','cancelled')),
      result TEXT,
      notes TEXT,
      ball_type TEXT NOT NULL DEFAULT 'White',
      attire TEXT NOT NULL DEFAULT 'Colored',
      match_fee REAL,
      created_by INTEGER NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (created_by) REFERENCES users(id)
    )`);
    await db.execute(`INSERT INTO matches_new
      SELECT id,title,opponent,venue,match_date,match_time,match_type,status,result,notes,'White','Colored',NULL,created_by,created_at
      FROM matches`);
    await db.execute('DROP TABLE matches');
    await db.execute('ALTER TABLE matches_new RENAME TO matches');
  }

  // Migrate: populate user_roles from existing role column (run once)
  const roleCount = await db.execute('SELECT COUNT(*) as n FROM user_roles');
  const userCount = await db.execute(`SELECT COUNT(*) as n FROM users WHERE status = 'active'`);
  if (Number(roleCount.rows[0][0]) === 0 && Number(userCount.rows[0][0]) > 0) {
    await db.execute(`INSERT OR IGNORE INTO user_roles (user_id, role) SELECT id, role FROM users WHERE status = 'active'`);
  }

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
