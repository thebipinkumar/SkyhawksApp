import { Router, Response } from 'express';
import { getDb, row, rows } from '../db/database.js';
import { authenticate, authorize, AuthRequest } from '../middleware/auth.js';

const router = Router();

router.get('/', authenticate, async (_req: AuthRequest, res: Response) => {
  const result = await getDb().execute(
    `SELECT t.*, u.name as created_by_name FROM tournaments t JOIN users u ON t.created_by = u.id ORDER BY t.start_date DESC, t.created_at DESC`
  );
  res.json(rows(result.rows));
});

router.post('/', authenticate, authorize('manager', 'admin'), async (req: AuthRequest, res: Response) => {
  const { name, format, start_date, end_date, description } = req.body;
  if (!name) { res.status(400).json({ error: 'Tournament name is required' }); return; }
  const db = getDb();
  const result = await db.execute({
    sql: `INSERT INTO tournaments (name, format, start_date, end_date, description, created_by) VALUES (?,?,?,?,?,?)`,
    args: [name, format || null, start_date || null, end_date || null, description || null, req.user!.id],
  });
  const tournament = row((await db.execute({ sql: 'SELECT * FROM tournaments WHERE id = ?', args: [Number(result.lastInsertRowid)] })).rows[0]);
  res.status(201).json(tournament);
});

router.put('/:id', authenticate, authorize('manager', 'admin'), async (req: AuthRequest, res: Response) => {
  const { name, format, start_date, end_date, description } = req.body;
  if (!name) { res.status(400).json({ error: 'Tournament name is required' }); return; }
  const db = getDb();
  if (!(await db.execute({ sql: 'SELECT id FROM tournaments WHERE id = ?', args: [req.params.id] })).rows[0]) {
    res.status(404).json({ error: 'Tournament not found' }); return;
  }
  await db.execute({
    sql: `UPDATE tournaments SET name=?, format=?, start_date=?, end_date=?, description=? WHERE id=?`,
    args: [name, format || null, start_date || null, end_date || null, description || null, req.params.id],
  });
  res.json(row((await db.execute({ sql: 'SELECT * FROM tournaments WHERE id = ?', args: [req.params.id] })).rows[0]));
});

router.delete('/:id', authenticate, authorize('admin'), async (req: AuthRequest, res: Response) => {
  const db = getDb();
  if (!(await db.execute({ sql: 'SELECT id FROM tournaments WHERE id = ?', args: [req.params.id] })).rows[0]) {
    res.status(404).json({ error: 'Tournament not found' }); return;
  }
  await db.execute({ sql: 'UPDATE matches SET tournament_id = NULL WHERE tournament_id = ?', args: [req.params.id] });
  await db.execute({ sql: 'DELETE FROM tournaments WHERE id = ?', args: [req.params.id] });
  res.json({ message: 'Tournament deleted' });
});

export default router;
