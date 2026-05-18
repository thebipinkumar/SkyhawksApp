import { Router, Response } from 'express';
import { getDb, row, rows } from '../db/database.js';
import { authenticate, authorize, AuthRequest } from '../middleware/auth.js';

const router = Router();

// GET /fees — list all yearly fee records (admin/manager)
router.get('/fees', authenticate, authorize('admin', 'manager'), async (_req: AuthRequest, res: Response) => {
  const result = await getDb().execute(`SELECT * FROM membership_fees ORDER BY year DESC`);
  res.json(rows(result.rows));
});

// PUT /fees/:year — upsert fee amount for a year (admin/manager)
router.put('/fees/:year', authenticate, authorize('admin', 'manager'), async (req: AuthRequest, res: Response) => {
  const year = Number(req.params.year);
  const { amount, currency = 'SGD' } = req.body;
  if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) {
    res.status(400).json({ error: 'Valid positive amount is required' }); return;
  }
  if (isNaN(year) || year < 2000 || year > 2100) {
    res.status(400).json({ error: 'Valid year is required' }); return;
  }
  const db = getDb();
  await db.execute({
    sql: `INSERT INTO membership_fees (year, amount, currency, created_by, updated_at)
          VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
          ON CONFLICT(year) DO UPDATE SET
            amount = excluded.amount,
            currency = excluded.currency,
            updated_at = CURRENT_TIMESTAMP`,
    args: [year, Number(amount), currency, req.user!.id],
  });
  const fee = row((await db.execute({ sql: `SELECT * FROM membership_fees WHERE year = ?`, args: [year] })).rows[0]);
  res.json(fee);
});

// GET /payments?year=YYYY — all members with payment status for a given year (admin/manager)
router.get('/payments', authenticate, authorize('admin', 'manager'), async (req: AuthRequest, res: Response) => {
  const year = req.query.year ? Number(req.query.year) : new Date().getFullYear();
  const db = getDb();
  const result = await db.execute({
    sql: `SELECT u.id as user_id, u.name, u.email, u.avatar_url,
                 COALESCE(mp.status, 'pending') as status,
                 mp.paid_date, mp.notes, mp.updated_at
          FROM users u
          LEFT JOIN membership_payments mp ON mp.user_id = u.id AND mp.year = ?
          WHERE u.status = 'active'
          ORDER BY u.name`,
    args: [year],
  });
  res.json(rows(result.rows));
});

// PATCH /payments/:userId — update or create payment record for a user+year (admin/manager)
router.patch('/payments/:userId', authenticate, authorize('admin', 'manager'), async (req: AuthRequest, res: Response) => {
  const userId = Number(req.params.userId);
  const year = req.body.year ? Number(req.body.year) : new Date().getFullYear();
  const { status, paid_date, notes } = req.body;

  if (!['paid', 'pending', 'waived'].includes(status)) {
    res.status(400).json({ error: 'Status must be paid, pending, or waived' }); return;
  }

  const db = getDb();

  // Verify user exists
  if (!(await db.execute({ sql: `SELECT id FROM users WHERE id = ? AND status = 'active'`, args: [userId] })).rows[0]) {
    res.status(404).json({ error: 'User not found' }); return;
  }

  await db.execute({
    sql: `INSERT INTO membership_payments (user_id, year, status, paid_date, notes, updated_by, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
          ON CONFLICT(user_id, year) DO UPDATE SET
            status = excluded.status,
            paid_date = excluded.paid_date,
            notes = excluded.notes,
            updated_by = excluded.updated_by,
            updated_at = CURRENT_TIMESTAMP`,
    args: [userId, year, status, paid_date || null, notes || null, req.user!.id],
  });
  res.json({ message: 'Payment status updated' });
});

// GET /my-payment — current user's payment status for current year
router.get('/my-payment', authenticate, async (req: AuthRequest, res: Response) => {
  const year = new Date().getFullYear();
  const db = getDb();

  const [paymentResult, feeResult] = await Promise.all([
    db.execute({ sql: `SELECT * FROM membership_payments WHERE user_id = ? AND year = ?`, args: [req.user!.id, year] }),
    db.execute({ sql: `SELECT * FROM membership_fees WHERE year = ?`, args: [year] }),
  ]);

  const payment = row(paymentResult.rows[0]);
  const fee = row(feeResult.rows[0]);

  res.json({
    year,
    status: payment?.status ?? 'pending',
    paid_date: payment?.paid_date ?? null,
    fee_amount: fee?.amount ?? null,
    fee_currency: fee?.currency ?? 'SGD',
  });
});

export default router;
