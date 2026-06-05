import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { getDb, row, rows } from '../db/database.js';
import { signToken, authenticate, AuthRequest } from '../middleware/auth.js';
import { sendPasswordResetEmail, sendNewMemberNotification } from '../utils/email.js';

const router = Router();

router.post('/register', async (req: Request, res: Response) => {
  const { name, email, password, phone, date_of_birth, jersey_number, jersey_label,
    whites_tshirt_size, whites_lower_size, whites_sleeve,
    colored_tshirt_size, colored_lower_size, colored_sleeve } = req.body;
  if (!name || !email || !password) { res.status(400).json({ error: 'Name, email and password are required' }); return; }
  if (password.length < 6) { res.status(400).json({ error: 'Password must be at least 6 characters' }); return; }
  const db = getDb();
  const existing = row((await db.execute({ sql: 'SELECT id FROM users WHERE email = ?', args: [email.toLowerCase()] })).rows[0]);
  if (existing) { res.status(409).json({ error: 'Email already registered' }); return; }
  const hash = bcrypt.hashSync(password, 10);
  await db.execute({
    sql: `INSERT INTO users (name, email, password_hash, role, phone, status,
            date_of_birth, jersey_number, jersey_label,
            whites_tshirt_size, whites_lower_size, whites_sleeve,
            colored_tshirt_size, colored_lower_size, colored_sleeve)
          VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    args: [name, email.toLowerCase(), hash, 'player', phone||null, 'pending',
           date_of_birth||null, jersey_number||null, jersey_label||null,
           whites_tshirt_size||null, whites_lower_size||null, whites_sleeve||null,
           colored_tshirt_size||null, colored_lower_size||null, colored_sleeve||null],
  });
  res.status(201).json({ pending: true, message: 'Registration submitted! A manager or admin will review your request. You will be able to log in once approved.' });

  // Notify all active admins and managers — non-blocking so registration is never delayed
  (async () => {
    try {
      const adminRes = await db.execute({
        sql: `SELECT DISTINCT u.email FROM users u
              JOIN user_roles ur ON ur.user_id = u.id
              WHERE u.status = 'active'
                AND ur.role IN ('admin', 'manager')
                AND u.email IS NOT NULL`,
        args: [],
      });
      const adminEmails = rows(adminRes.rows).map((r: any) => r.email as string).filter(Boolean);
      await sendNewMemberNotification(adminEmails, { name, email: email.toLowerCase(), phone: phone || null });
    } catch (err) { console.error('New member notification error:', err); }
  })();
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

  // Record last login — non-blocking; a failure must not prevent the login response
  try {
    await db.execute({ sql: 'UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?', args: [user.id] });
  } catch (err) { console.error('Failed to update last_login:', err); }

  res.json({ token, user: { id: user.id, name: user.name, email: user.email, role: user.role, roles, avatar_url: user.avatar_url ?? null, membership_end: user.membership_end ?? null } });
});

router.get('/me', authenticate, async (req: AuthRequest, res: Response) => {
  const db = getDb();
  const user = row((await db.execute({ sql: 'SELECT id, name, email, role, phone, bio, avatar_url, batting_style, bowling_style, created_at, membership_start, membership_end, last_login FROM users WHERE id = ?', args: [req.user!.id] })).rows[0]);
  const roleRows = await db.execute({ sql: 'SELECT role FROM user_roles WHERE user_id = ?', args: [req.user!.id] });
  const roles = rows(roleRows.rows).map(r => r.role as string);
  res.json({ ...user, roles: roles.length > 0 ? roles : [user.role] });
});

router.post('/forgot-password', async (req: Request, res: Response) => {
  const { email } = req.body;
  if (!email) { res.status(400).json({ error: 'Email is required' }); return; }
  const db = getDb();
  const user = row((await db.execute({ sql: `SELECT id, name, email, status FROM users WHERE email = ?`, args: [email.toLowerCase()] })).rows[0]);
  // Always respond OK to avoid user enumeration
  if (!user || user.status !== 'active') { res.json({ message: 'If that email is registered, a reset link has been sent.' }); return; }

  const token = crypto.randomBytes(32).toString('hex');
  const expires = new Date(Date.now() + 60 * 60 * 1000).toISOString(); // 1 hour
  await db.execute({ sql: `UPDATE users SET reset_token = ?, reset_token_expires = ? WHERE id = ?`, args: [token, expires, user.id] });

  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
  await sendPasswordResetEmail(user.email, user.name, `${frontendUrl}/reset-password?token=${token}`);
  res.json({ message: 'If that email is registered, a reset link has been sent.' });
});

router.post('/reset-password', async (req: Request, res: Response) => {
  const { token, password } = req.body;
  if (!token || !password) { res.status(400).json({ error: 'Token and new password are required' }); return; }
  if (password.length < 6) { res.status(400).json({ error: 'Password must be at least 6 characters' }); return; }
  const db = getDb();
  const user = row((await db.execute({ sql: `SELECT id, reset_token_expires FROM users WHERE reset_token = ?`, args: [token] })).rows[0]);
  if (!user) { res.status(400).json({ error: 'Invalid or expired reset link' }); return; }
  if (new Date(user.reset_token_expires) < new Date()) { res.status(400).json({ error: 'Reset link has expired. Please request a new one.' }); return; }

  const hash = bcrypt.hashSync(password, 10);
  await db.execute({ sql: `UPDATE users SET password_hash = ?, reset_token = NULL, reset_token_expires = NULL WHERE id = ?`, args: [hash, user.id] });
  res.json({ message: 'Password reset successfully. You can now log in.' });
});

export default router;
