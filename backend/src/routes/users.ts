import { Router, Response } from 'express';
import { getDb, rows, row } from '../db/database.js';
import { authenticate, authorize, AuthRequest } from '../middleware/auth.js';

const router = Router();

// Active members list
router.get('/', authenticate, authorize('admin', 'manager', 'selector'), async (_req: AuthRequest, res: Response) => {
  const result = await getDb().execute(`SELECT id, name, email, role, phone, avatar_url, created_at FROM users WHERE status = 'active' ORDER BY name`);
  res.json(rows(result.rows));
});

// Pending registrations (manager/admin)
router.get('/pending', authenticate, authorize('manager', 'admin'), async (_req: AuthRequest, res: Response) => {
  const result = await getDb().execute(`SELECT id, name, email, phone, created_at FROM users WHERE status = 'pending' ORDER BY created_at ASC`);
  res.json(rows(result.rows));
});

// Approve a registration (manager/admin)
router.patch('/:id/approve', authenticate, authorize('manager', 'admin'), async (req: AuthRequest, res: Response) => {
  const db = getDb();
  const user = row((await db.execute({ sql: 'SELECT id, status FROM users WHERE id = ?', args: [req.params.id] })).rows[0]);
  if (!user) { res.status(404).json({ error: 'User not found' }); return; }
  if (user.status !== 'pending') { res.status(400).json({ error: 'User is not pending approval' }); return; }
  await db.execute({ sql: `UPDATE users SET status = 'active' WHERE id = ?`, args: [req.params.id] });
  res.json({ message: 'User approved' });
});

// Reject a registration (manager/admin)
router.patch('/:id/reject', authenticate, authorize('manager', 'admin'), async (req: AuthRequest, res: Response) => {
  const db = getDb();
  const user = row((await db.execute({ sql: 'SELECT id, status FROM users WHERE id = ?', args: [req.params.id] })).rows[0]);
  if (!user) { res.status(404).json({ error: 'User not found' }); return; }
  if (user.status !== 'pending') { res.status(400).json({ error: 'User is not pending approval' }); return; }
  await db.execute({ sql: `UPDATE users SET status = 'rejected' WHERE id = ?`, args: [req.params.id] });
  res.json({ message: 'User rejected' });
});

// Update role (admin only)
router.patch('/:id/role', authenticate, authorize('admin'), async (req: AuthRequest, res: Response) => {
  const { role } = req.body;
  if (!['player', 'manager', 'selector', 'admin'].includes(role)) { res.status(400).json({ error: 'Invalid role' }); return; }
  const db = getDb();
  if (!(await db.execute({ sql: 'SELECT id FROM users WHERE id = ?', args: [req.params.id] })).rows[0]) { res.status(404).json({ error: 'User not found' }); return; }
  await db.execute({ sql: 'UPDATE users SET role = ? WHERE id = ?', args: [role, req.params.id] });
  res.json({ message: 'Role updated' });
});

// Delete user (admin only)
router.delete('/:id', authenticate, authorize('admin'), async (req: AuthRequest, res: Response) => {
  await getDb().execute({ sql: 'DELETE FROM users WHERE id = ?', args: [req.params.id] });
  res.json({ message: 'User deleted' });
});

export default router;
