import { Router, Response } from 'express';
import bcrypt from 'bcryptjs';
import { getDb, rows, row } from '../db/database.js';
import { authenticate, authorize, AuthRequest } from '../middleware/auth.js';

const PROFILE_COLS = `id, name, email, role, phone, bio, avatar_url, batting_style, bowling_style, created_at,
  date_of_birth, jersey_number, jersey_label,
  whites_tshirt_size, whites_lower_size, whites_sleeve,
  colored_tshirt_size, colored_lower_size, colored_sleeve,
  membership_start, membership_end`;

const VALID_ROLES = ['player', 'manager', 'selector', 'admin'];
const router = Router();

// Active members list — includes their roles array
router.get('/', authenticate, async (_req: AuthRequest, res: Response) => {
  const db = getDb();
  const usersResult = await db.execute(`SELECT id, name, email, role, phone, avatar_url, created_at, membership_start, membership_end FROM users WHERE status = 'active' ORDER BY name`);
  const userList = rows(usersResult.rows);

  // Fetch roles for all users in one query
  const rolesResult = await db.execute(`SELECT user_id, role FROM user_roles WHERE user_id IN (SELECT id FROM users WHERE status = 'active')`);
  const rolesMap: Record<number, string[]> = {};
  for (const r of rows(rolesResult.rows)) {
    if (!rolesMap[r.user_id]) rolesMap[r.user_id] = [];
    rolesMap[r.user_id].push(r.role);
  }

  res.json(userList.map(u => ({
    ...u,
    roles: rolesMap[u.id]?.length ? rolesMap[u.id] : [u.role],
  })));
});

// Pending registrations (manager/admin)
router.get('/pending', authenticate, authorize('manager', 'admin'), async (_req: AuthRequest, res: Response) => {
  const result = await getDb().execute(`SELECT id, name, email, phone, created_at FROM users WHERE status = 'pending' ORDER BY created_at ASC`);
  res.json(rows(result.rows));
});

// Approve a registration — sets status active and assigns 'player' role
router.patch('/:id/approve', authenticate, authorize('manager', 'admin'), async (req: AuthRequest, res: Response) => {
  const db = getDb();
  const user = row((await db.execute({ sql: 'SELECT id, status, role FROM users WHERE id = ?', args: [req.params.id] })).rows[0]);
  if (!user) { res.status(404).json({ error: 'User not found' }); return; }
  if (user.status !== 'pending') { res.status(400).json({ error: 'User is not pending approval' }); return; }
  await db.execute({
    sql: `UPDATE users SET status='active', membership_start=DATE('now'), membership_end=DATE('now', '+1 year') WHERE id=?`,
    args: [req.params.id],
  });
  // Add default 'player' role to user_roles
  await db.execute({ sql: 'INSERT OR IGNORE INTO user_roles (user_id, role) VALUES (?,?)', args: [req.params.id, 'player'] });
  res.json({ message: 'User approved' });
});

// Reject a registration
router.patch('/:id/reject', authenticate, authorize('manager', 'admin'), async (req: AuthRequest, res: Response) => {
  const db = getDb();
  const user = row((await db.execute({ sql: 'SELECT id, status FROM users WHERE id = ?', args: [req.params.id] })).rows[0]);
  if (!user) { res.status(404).json({ error: 'User not found' }); return; }
  if (user.status !== 'pending') { res.status(400).json({ error: 'User is not pending approval' }); return; }
  await db.execute({ sql: `UPDATE users SET status = 'rejected' WHERE id = ?`, args: [req.params.id] });
  res.json({ message: 'User rejected' });
});

// Add a role to a user (admin only)
router.post('/:id/roles/:role', authenticate, authorize('admin'), async (req: AuthRequest, res: Response) => {
  const { id, role } = req.params;
  if (!VALID_ROLES.includes(role)) { res.status(400).json({ error: 'Invalid role' }); return; }
  if (!(await getDb().execute({ sql: 'SELECT id FROM users WHERE id = ?', args: [id] })).rows[0]) {
    res.status(404).json({ error: 'User not found' }); return;
  }
  await getDb().execute({ sql: 'INSERT OR IGNORE INTO user_roles (user_id, role) VALUES (?,?)', args: [id, role] });
  res.json({ message: 'Role added' });
});

// Remove a role from a user (admin only)
router.delete('/:id/roles/:role', authenticate, authorize('admin'), async (req: AuthRequest, res: Response) => {
  const { id, role } = req.params;
  // Prevent removing the last role
  const remaining = (await getDb().execute({ sql: 'SELECT COUNT(*) as n FROM user_roles WHERE user_id = ?', args: [id] })).rows[0];
  if (Number(remaining[0]) <= 1) { res.status(400).json({ error: 'Cannot remove the last role from a user' }); return; }
  await getDb().execute({ sql: 'DELETE FROM user_roles WHERE user_id = ? AND role = ?', args: [id, role] });
  res.json({ message: 'Role removed' });
});

// Admin update membership expiry date
router.patch('/:id/membership-expiry', authenticate, authorize('admin'), async (req: AuthRequest, res: Response) => {
  const { membership_end } = req.body;
  if (!membership_end) { res.status(400).json({ error: 'membership_end is required' }); return; }
  await getDb().execute({ sql: `UPDATE users SET membership_end=? WHERE id=?`, args: [membership_end, req.params.id] });
  res.json({ message: 'Membership expiry updated' });
});

// Admin view any member's full profile
router.get('/:id/profile', authenticate, authorize('admin'), async (req: AuthRequest, res: Response) => {
  const db = getDb();
  const user = row((await db.execute({ sql: `SELECT ${PROFILE_COLS} FROM users WHERE id=?`, args: [req.params.id] })).rows[0]);
  if (!user) { res.status(404).json({ error: 'User not found' }); return; }
  const roleRows = await db.execute({ sql: 'SELECT role FROM user_roles WHERE user_id=?', args: [req.params.id] });
  const roles = rows(roleRows.rows).map((r: any) => r.role as string);
  res.json({ ...user, roles: roles.length > 0 ? roles : [user.role] });
});

// Admin edit any member's profile
router.put('/:id/profile', authenticate, authorize('admin'), async (req: AuthRequest, res: Response) => {
  const { name, phone, bio, batting_style, bowling_style,
    date_of_birth, jersey_number, jersey_label,
    whites_tshirt_size, whites_lower_size, whites_sleeve,
    colored_tshirt_size, colored_lower_size, colored_sleeve,
    membership_end } = req.body;
  if (!name?.trim()) { res.status(400).json({ error: 'Name is required' }); return; }
  const db = getDb();
  if (!(await db.execute({ sql: 'SELECT id FROM users WHERE id=?', args: [req.params.id] })).rows[0]) {
    res.status(404).json({ error: 'User not found' }); return;
  }
  await db.execute({
    sql: `UPDATE users SET name=?,phone=?,bio=?,batting_style=?,bowling_style=?,
          date_of_birth=?,jersey_number=?,jersey_label=?,
          whites_tshirt_size=?,whites_lower_size=?,whites_sleeve=?,
          colored_tshirt_size=?,colored_lower_size=?,colored_sleeve=?,
          membership_end=?
          WHERE id=?`,
    args: [name.trim(), phone||null, bio||null, batting_style||null, bowling_style||null,
           date_of_birth||null, jersey_number||null, jersey_label||null,
           whites_tshirt_size||null, whites_lower_size||null, whites_sleeve||null,
           colored_tshirt_size||null, colored_lower_size||null, colored_sleeve||null,
           membership_end||null, req.params.id],
  });
  const updated = row((await db.execute({ sql: `SELECT ${PROFILE_COLS} FROM users WHERE id=?`, args: [req.params.id] })).rows[0]);
  res.json(updated);
});

// Admin reset a member's password
router.post('/:id/reset-password', authenticate, authorize('admin'), async (req: AuthRequest, res: Response) => {
  const { password } = req.body;
  if (!password || password.length < 6) { res.status(400).json({ error: 'Password must be at least 6 characters' }); return; }
  const hash = bcrypt.hashSync(password, 10);
  await getDb().execute({ sql: `UPDATE users SET password_hash = ?, reset_token = NULL, reset_token_expires = NULL WHERE id = ?`, args: [hash, req.params.id] });
  res.json({ message: 'Password updated' });
});

// Delete user (admin only)
router.delete('/:id', authenticate, authorize('admin'), async (req: AuthRequest, res: Response) => {
  await getDb().execute({ sql: 'DELETE FROM users WHERE id = ?', args: [req.params.id] });
  res.json({ message: 'User deleted' });
});

export default router;
