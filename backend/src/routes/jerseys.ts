import { Router, Response } from 'express';
import { getDb, rows } from '../db/database.js';
import { authenticate, authorize, AuthRequest } from '../middleware/auth.js';

const router = Router();

const JERSEY_COLS = `id, name, jersey_number, jersey_label,
  whites_tshirt_size, whites_lower_size, whites_sleeve, whites_jersey_status,
  colored_tshirt_size, colored_lower_size, colored_sleeve, colored_jersey_status`;

// GET /jerseys — all authenticated users can view (players read-only)
router.get('/', authenticate, async (_req: AuthRequest, res: Response) => {
  const db = getDb();

  const members = rows((await db.execute(
    `SELECT ${JERSEY_COLS}, 0 as is_dummy FROM users WHERE status = 'active' ORDER BY name`
  )).rows);

  const extras = rows((await db.execute(
    `SELECT ${JERSEY_COLS}, 1 as is_dummy FROM merchandise_extras ORDER BY name`
  )).rows);

  res.json([...members, ...extras].sort((a, b) => (a.name as string).localeCompare(b.name as string)));
});

// GET /jerseys/check-number — check if jersey number is already taken
router.get('/check-number', authenticate, async (req: AuthRequest, res: Response) => {
  const { number, skip_user_id, skip_extra_id } = req.query as Record<string, string>;
  if (!number) { res.json({ taken: false }); return; }
  const db = getDb();

  const userRow = rows((await db.execute({
    sql: `SELECT id, name FROM users WHERE jersey_number = ? AND status = 'active' AND id != ?`,
    args: [number, skip_user_id || 0],
  })).rows);

  const extraRow = rows((await db.execute({
    sql: `SELECT id, name FROM merchandise_extras WHERE jersey_number = ? AND id != ?`,
    args: [number, skip_extra_id || 0],
  })).rows);

  const conflict = [...userRow, ...extraRow][0];
  if (conflict) {
    res.json({ taken: true, by: (conflict as any).name });
  } else {
    res.json({ taken: false });
  }
});

// PATCH /jerseys/:id/status — toggle status for a real member
router.patch('/:id/status', authenticate, authorize('admin', 'manager'), async (req: AuthRequest, res: Response) => {
  const { attire, status } = req.body;
  if (!['whites', 'colored'].includes(attire)) { res.status(400).json({ error: 'attire must be whites or colored' }); return; }
  if (!['required', 'not_required'].includes(status)) { res.status(400).json({ error: 'status must be required or not_required' }); return; }
  const col = attire === 'whites' ? 'whites_jersey_status' : 'colored_jersey_status';
  await getDb().execute({ sql: `UPDATE users SET ${col} = ? WHERE id = ?`, args: [status, req.params.id] });
  res.json({ message: 'Status updated' });
});

// POST /jerseys/dummy — create a dummy/extra merchandise entry
router.post('/dummy', authenticate, authorize('admin', 'manager'), async (req: AuthRequest, res: Response) => {
  const {
    name, jersey_number, jersey_label,
    whites_tshirt_size, whites_lower_size, whites_sleeve, whites_jersey_status,
    colored_tshirt_size, colored_lower_size, colored_sleeve, colored_jersey_status,
  } = req.body;

  if (!name) { res.status(400).json({ error: 'Name is required' }); return; }

  const db = getDb();

  // Jersey number uniqueness check
  if (jersey_number) {
    const conflict = rows((await db.execute({
      sql: `SELECT name FROM users WHERE jersey_number = ? AND status = 'active'
            UNION ALL SELECT name FROM merchandise_extras WHERE jersey_number = ?`,
      args: [jersey_number, jersey_number],
    })).rows);
    if (conflict.length) {
      res.status(409).json({ error: `Jersey number ${jersey_number} is already assigned to ${(conflict[0] as any).name}` });
      return;
    }
  }

  await db.execute({
    sql: `INSERT INTO merchandise_extras
          (name, jersey_number, jersey_label,
           whites_tshirt_size, whites_lower_size, whites_sleeve, whites_jersey_status,
           colored_tshirt_size, colored_lower_size, colored_sleeve, colored_jersey_status, created_by)
          VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
    args: [
      name, jersey_number || null, jersey_label || null,
      whites_tshirt_size || null, whites_lower_size || null, whites_sleeve || null,
      whites_jersey_status || 'required',
      colored_tshirt_size || null, colored_lower_size || null, colored_sleeve || null,
      colored_jersey_status || 'required', req.user!.id,
    ],
  });
  res.status(201).json({ message: 'Dummy entry created' });
});

// PATCH /jerseys/dummy/:id/status — toggle status for a dummy entry
router.patch('/dummy/:id/status', authenticate, authorize('admin', 'manager'), async (req: AuthRequest, res: Response) => {
  const { attire, status } = req.body;
  if (!['whites', 'colored'].includes(attire)) { res.status(400).json({ error: 'attire must be whites or colored' }); return; }
  if (!['required', 'not_required'].includes(status)) { res.status(400).json({ error: 'status must be required or not_required' }); return; }
  const col = attire === 'whites' ? 'whites_jersey_status' : 'colored_jersey_status';
  const db = getDb();
  if (!(await db.execute({ sql: 'SELECT id FROM merchandise_extras WHERE id = ?', args: [req.params.id] })).rows[0]) {
    res.status(404).json({ error: 'Entry not found' }); return;
  }
  await db.execute({ sql: `UPDATE merchandise_extras SET ${col} = ? WHERE id = ?`, args: [status, req.params.id] });
  res.json({ message: 'Status updated' });
});

// DELETE /jerseys/dummy/:id — remove a dummy entry
router.delete('/dummy/:id', authenticate, authorize('admin', 'manager'), async (req: AuthRequest, res: Response) => {
  const db = getDb();
  if (!(await db.execute({ sql: 'SELECT id FROM merchandise_extras WHERE id = ?', args: [req.params.id] })).rows[0]) {
    res.status(404).json({ error: 'Entry not found' }); return;
  }
  await db.execute({ sql: 'DELETE FROM merchandise_extras WHERE id = ?', args: [req.params.id] });
  res.json({ message: 'Entry deleted' });
});

export default router;
