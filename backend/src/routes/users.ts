import { Router, Response } from 'express';
import { getDb, rows } from '../db/database.js';
import { authenticate, authorize, AuthRequest } from '../middleware/auth.js';

const router = Router();

router.get('/', authenticate, authorize('admin', 'manager', 'selector'), async (_req: AuthRequest, res: Response) => {
  const result = await getDb().execute('SELECT id, name, email, role, phone, avatar_url, created_at FROM users ORDER BY name');
  res.json(rows(result.rows));
});

router.patch('/:id/role', authenticate, authorize('admin'), async (req: AuthRequest, res: Response) => {
  const { role } = req.body;
  if (!['player','manager','selector','admin'].includes(role)) { res.status(400).json({ error: 'Invalid role' }); return; }
  const db = getDb();
  const existing = (await db.execute({ sql: 'SELECT id FROM users WHERE id = ?', args: [req.params.id] })).rows[0];
  if (!existing) { res.status(404).json({ error: 'User not found' }); return; }
  await db.execute({ sql: 'UPDATE users SET role = ? WHERE id = ?', args: [role, req.params.id] });
  res.json({ message: 'Role updated' });
});

router.delete('/:id', authenticate, authorize('admin'), async (req: AuthRequest, res: Response) => {
  await getDb().execute({ sql: 'DELETE FROM users WHERE id = ?', args: [req.params.id] });
  res.json({ message: 'User deleted' });
});

export default router;
