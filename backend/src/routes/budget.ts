import { Router, Response } from 'express';
import { getDb, row, rows } from '../db/database.js';
import { authenticate, authorize, AuthRequest } from '../middleware/auth.js';

const router = Router();

router.get('/', authenticate, authorize('manager', 'admin', 'account_manager'), async (_req: AuthRequest, res: Response) => {
  const db = getDb();
  const entries = rows((await db.execute(`SELECT b.*, u.name as created_by_name FROM budget_entries b JOIN users u ON b.created_by = u.id ORDER BY b.entry_date DESC, b.created_at DESC`)).rows);
  const summaryRow = (await db.execute(`SELECT SUM(CASE WHEN type='revenue' THEN amount ELSE 0 END) as total_revenue, SUM(CASE WHEN type='expense' THEN amount ELSE 0 END) as total_expense, SUM(CASE WHEN type='revenue' THEN amount ELSE -amount END) as net_balance FROM budget_entries`)).rows[0];
  res.json({ entries, summary: row(summaryRow) });
});

router.post('/', authenticate, authorize('manager', 'admin', 'account_manager'), async (req: AuthRequest, res: Response) => {
  const { type, category, amount, description, entry_date } = req.body;
  if (!type || !category || !amount || !description || !entry_date) { res.status(400).json({ error: 'All fields are required' }); return; }
  if (!['revenue','expense'].includes(type)) { res.status(400).json({ error: 'Type must be revenue or expense' }); return; }
  if (amount <= 0) { res.status(400).json({ error: 'Amount must be positive' }); return; }
  const db = getDb();
  const result = await db.execute({ sql: `INSERT INTO budget_entries (type,category,amount,description,entry_date,created_by) VALUES (?,?,?,?,?,?)`, args: [type, category, parseFloat(amount), description, entry_date, req.user!.id] });
  res.status(201).json(row((await db.execute({ sql: 'SELECT * FROM budget_entries WHERE id = ?', args: [Number(result.lastInsertRowid)] })).rows[0]));
});

router.put('/:id', authenticate, authorize('manager', 'admin', 'account_manager'), async (req: AuthRequest, res: Response) => {
  const { type, category, amount, description, entry_date } = req.body;
  const db = getDb();
  if (!(await db.execute({ sql: 'SELECT id FROM budget_entries WHERE id = ?', args: [req.params.id] })).rows[0]) { res.status(404).json({ error: 'Entry not found' }); return; }
  await db.execute({ sql: `UPDATE budget_entries SET type=?,category=?,amount=?,description=?,entry_date=? WHERE id=?`, args: [type, category, parseFloat(amount), description, entry_date, req.params.id] });
  res.json(row((await db.execute({ sql: 'SELECT * FROM budget_entries WHERE id = ?', args: [req.params.id] })).rows[0]));
});

router.delete('/:id', authenticate, authorize('admin'), async (req: AuthRequest, res: Response) => {
  await getDb().execute({ sql: 'DELETE FROM budget_entries WHERE id = ?', args: [req.params.id] });
  res.json({ message: 'Entry deleted' });
});

export default router;
