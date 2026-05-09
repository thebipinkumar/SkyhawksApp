import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { getDb, row, rows } from '../db/database.js';
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
  const result = await db.execute({
    sql: 'INSERT INTO users (name, email, password_hash, role, phone, status) VALUES (?,?,?,?,?,?)',
    args: [name, email.toLowerCase(), hash, 'player', phone || null, 'pending'],
  });
  // New registrations default to 'player' role (added to user_roles when approved)
  res.status(201).json({ pending: true, message: 'Registration submitted! A manager or admin will review your request. You will be able to log in once approved.' });
});

router.post('/login', async (req: Request, res: Response) => {
  const { email, password } = req.body;
  if (!email || !password) { res.status(400).json({ error: 'Email and password are required' }); return; }
  const db = getDb();
  const user = row((await db.execute({ sql: 'SELECT * FROM users WHERE email = ?', args: [email.toLowerCase()] })).rows[0]);
  if (!user || !bcrypt.compareSync(password, user.password_hash)) { res.status(401).json({ error: 'Invalid email or password' }); return; }
  if (user.status === 'pending') { res.status(403).json({ error: 'Your account is awaiting approval from a manager or admin.' }); return; }
  if (user.status === 'rejected') { res.status(403).json({ error: 'Your registration was not approved. Please contact the club admin.' }); return; }

  // Fetch all roles for this user
  const roleRows = await db.execute({ sql: 'SELECT role FROM user_roles WHERE user_id = ?', args: [user.id] });
  const userRoles = rows(roleRows.rows).map(r => r.role as string);
  // Fall back to legacy role column if user_roles is empty
  const roles = userRoles.length > 0 ? userRoles : [user.role];

  const token = signToken({ id: user.id, email: user.email, roles, name: user.name });
  res.json({ token, user: { id: user.id, name: user.name, email: user.email, roles } });
});

router.get('/me', authenticate, async (req: AuthRequest, res: Response) => {
  const db = getDb();
  const user = row((await db.execute({ sql: 'SELECT id, name, email, role, phone, bio, avatar_url, batting_style, bowling_style, created_at FROM users WHERE id = ?', args: [req.user!.id] })).rows[0]);
  const roleRows = await db.execute({ sql: 'SELECT role FROM user_roles WHERE user_id = ?', args: [req.user!.id] });
  const roles = rows(roleRows.rows).map(r => r.role as string);
  res.json({ ...user, roles: roles.length > 0 ? roles : [user.role] });
});

export default router;
