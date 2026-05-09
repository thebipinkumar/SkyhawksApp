import { Router, Response } from 'express';
import { getDb, rows } from '../db/database.js';
import { authenticate, authorize, AuthRequest } from '../middleware/auth.js';

const router = Router();

const JERSEY_COLS = `id, name, email, date_of_birth, jersey_number, jersey_label,
  whites_tshirt_size, whites_lower_size, whites_sleeve, whites_jersey_status,
  colored_tshirt_size, colored_lower_size, colored_sleeve, colored_jersey_status`;

router.get('/', authenticate, authorize('admin', 'manager', 'selector'), async (_req: AuthRequest, res: Response) => {
  const result = await getDb().execute(
    `SELECT ${JERSEY_COLS} FROM users WHERE status = 'active' ORDER BY name`
  );
  res.json(rows(result.rows));
});

router.patch('/:id/status', authenticate, authorize('admin', 'manager'), async (req: AuthRequest, res: Response) => {
  const { attire, status } = req.body;
  if (!['whites', 'colored'].includes(attire)) { res.status(400).json({ error: 'attire must be whites or colored' }); return; }
  if (!['required', 'not_required'].includes(status)) { res.status(400).json({ error: 'status must be required or not_required' }); return; }
  const col = attire === 'whites' ? 'whites_jersey_status' : 'colored_jersey_status';
  await getDb().execute({ sql: `UPDATE users SET ${col} = ? WHERE id = ?`, args: [status, req.params.id] });
  res.json({ message: 'Status updated' });
});

export default router;
