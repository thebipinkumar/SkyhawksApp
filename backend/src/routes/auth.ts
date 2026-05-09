import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { getDb, row } from '../db/database.js';
import { signToken, authenticate, AuthRequest } from '../middleware/auth.js';

const router = Router();

router.post('/register', async (req: Request, res: Response) => {
  const { name, email, password, phone } = req.body;
  if (!name || !email || !password) { res.status(400).json({ error: 'Name, email and password are required' }); return; }
  if (password.length < 6) { res.status(400).json({ error: 'Password must be at least 6 characters' }); return; }
  const db = getDb();
  const existing = row((await db.execute({ sql: 'SELECT id FROM users WHERE email = ?', args: [email.toLowerCase()] })).rows[0]);
  if (existing) { res.status(409).json({ error: 'Email already registered' }); return; }
  const hash = bcrypt.hashSync(password, 10);
  const result = await db.execute({ sql: 'INSERT INTO users (name, email, password_hash, role, phone) VALUES (?,?,?,?,?)', args: [name, email.toLowerCase(), hash, 'player', phone || null] });
  const user = row((await db.execute({ sql: 'SELECT id, name, email, role FROM users WHERE id = ?', args: [Number(result.lastInsertRowid)] })).rows[0]);
  res.status(201).json({ token: signToken(user), user });
});

router.post('/login', async (req: Request, res: Response) => {
  const { email, password } = req.body;
  if (!email || !password) { res.status(400).json({ error: 'Email and password are required' }); return; }
  const db = getDb();
  const user = row((await db.execute({ sql: 'SELECT * FROM users WHERE email = ?', args: [email.toLowerCase()] })).rows[0]);
  if (!user || !bcrypt.compareSync(password, user.password_hash)) { res.status(401).json({ error: 'Invalid credentials' }); return; }
  res.json({ token: signToken({ id: user.id, email: user.email, role: user.role, name: user.name }), user: { id: user.id, name: user.name, email: user.email, role: user.role } });
});

router.get('/me', authenticate, async (req: AuthRequest, res: Response) => {
  const user = row((await getDb().execute({ sql: 'SELECT id, name, email, role, phone, bio, avatar_url, batting_style, bowling_style, created_at FROM users WHERE id = ?', args: [req.user!.id] })).rows[0]);
  res.json(user);
});

export default router;
