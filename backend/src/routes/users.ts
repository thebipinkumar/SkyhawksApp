import { Router, Response } from 'express';
import { getDb, rows, row } from '../db/database.js';
import { authenticate, authorize, AuthRequest } from '../middleware/auth.js';

const VALID_ROLES = ['player', 'manager', 'selector', 'admin'];
const router = Router();

// Active members list — includes their roles array
router.get('/', authenticate, async (_req: AuthRequest, res: Response) => {
  const db = getDb();
  const usersResult = await db.execute(`SELECT id, name, email, role, phone, avatar_url, created_at FROM users WHERE status = 'active' ORDER BY name`);
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
  await db.execute({ sql: `UPDATE users SET status = 'active' WHERE id = ?`, args: [req.params.id] });
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

// Delete user (admin only)
router.delete('/:id', authenticate, authorize('admin'), async (req: AuthRequest, res: Response) => {
  await getDb().execute({ sql: 'DELETE FROM users WHERE id = ?', args: [req.params.id] });
  res.json({ message: 'User deleted' });
});

export default router;
