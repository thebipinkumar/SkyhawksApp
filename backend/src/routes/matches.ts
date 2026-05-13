import { Router, Response } from 'express';
import { getDb, row, rows } from '../db/database.js';
import { authenticate, authorize, AuthRequest } from '../middleware/auth.js';

const router = Router();

const MATCH_LIST_SQL = `
  SELECT m.*, u.name as created_by_name, t.name as tournament_name
  FROM matches m
  JOIN users u ON m.created_by = u.id
  LEFT JOIN tournaments t ON m.tournament_id = t.id
  ORDER BY m.match_date DESC, m.match_time DESC
`;

router.get('/', authenticate, async (_req: AuthRequest, res: Response) => {
  const result = await getDb().execute(MATCH_LIST_SQL);
  res.json(rows(result.rows));
});

router.get('/:id', authenticate, async (req: AuthRequest, res: Response) => {
  const db = getDb();
  const match = row((await db.execute({
    sql: `SELECT m.*, u.name as created_by_name, t.name as tournament_name
          FROM matches m JOIN users u ON m.created_by = u.id
          LEFT JOIN tournaments t ON m.tournament_id = t.id
          WHERE m.id = ?`,
    args: [req.params.id],
  })).rows[0]);
  if (!match) { res.status(404).json({ error: 'Match not found' }); return; }

  const team = rows((await db.execute({
    sql: `SELECT ts.*, u.name as player_name, u.email as player_email, u.avatar_url as player_avatar
          FROM team_selections ts JOIN users u ON ts.player_id = u.id
          WHERE ts.match_id = ?
          ORDER BY ts.is_captain DESC, ts.is_vice_captain DESC, u.name`,
    args: [req.params.id],
  })).rows);
  res.json({ ...match, team });
});

router.post('/', authenticate, authorize('manager', 'admin'), async (req: AuthRequest, res: Response) => {
  const { title, opponent, venue, match_date, match_time, match_type, notes, ball_type, attire, match_fee, scorecard_url, tournament_id } = req.body;
  if (!title || !opponent || !venue || !match_date || !match_time) {
    res.status(400).json({ error: 'Title, opponent, venue, date and time are required' }); return;
  }
  const db = getDb();
  const result = await db.execute({
    sql: `INSERT INTO matches (title,opponent,venue,match_date,match_time,match_type,notes,ball_type,attire,match_fee,scorecard_url,tournament_id,created_by)
          VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    args: [title, opponent, venue, match_date, match_time, match_type || 'T20', notes || null,
           ball_type || 'White', attire || 'Colored', match_fee ?? null, scorecard_url || null,
           tournament_id || null, req.user!.id],
  });
  const match = row((await db.execute({ sql: 'SELECT * FROM matches WHERE id = ?', args: [Number(result.lastInsertRowid)] })).rows[0]);
  res.status(201).json(match);
});

router.put('/:id', authenticate, authorize('manager', 'admin'), async (req: AuthRequest, res: Response) => {
  const { title, opponent, venue, match_date, match_time, match_type, status, result: matchResult, notes, ball_type, attire, match_fee, scorecard_url, tournament_id } = req.body;
  const db = getDb();
  if (!(await db.execute({ sql: 'SELECT id FROM matches WHERE id = ?', args: [req.params.id] })).rows[0]) {
    res.status(404).json({ error: 'Match not found' }); return;
  }
  await db.execute({
    sql: `UPDATE matches SET title=?,opponent=?,venue=?,match_date=?,match_time=?,match_type=?,status=?,result=?,notes=?,ball_type=?,attire=?,match_fee=?,scorecard_url=?,tournament_id=? WHERE id=?`,
    args: [title, opponent, venue, match_date, match_time, match_type, status, matchResult || null,
           notes || null, ball_type || 'White', attire || 'Colored', match_fee ?? null,
           scorecard_url || null, tournament_id || null, req.params.id],
  });
  res.json(row((await db.execute({ sql: 'SELECT * FROM matches WHERE id = ?', args: [req.params.id] })).rows[0]));
});

router.delete('/:id', authenticate, authorize('admin'), async (req: AuthRequest, res: Response) => {
  const db = getDb();
  if (!(await db.execute({ sql: 'SELECT id FROM matches WHERE id = ?', args: [req.params.id] })).rows[0]) {
    res.status(404).json({ error: 'Match not found' }); return;
  }
  await db.execute({ sql: 'DELETE FROM announcements WHERE match_id = ?', args: [req.params.id] });
  await db.execute({ sql: 'DELETE FROM team_selections WHERE match_id = ?', args: [req.params.id] });
  await db.execute({ sql: 'DELETE FROM match_availability WHERE match_id = ?', args: [req.params.id] });
  await db.execute({ sql: 'DELETE FROM matches WHERE id = ?', args: [req.params.id] });
  res.json({ message: 'Match deleted' });
});

router.put('/:matchId/availability', authenticate, async (req: AuthRequest, res: Response) => {
  const { status } = req.body;
  if (!['available', 'not_available', 'maybe'].includes(status)) {
    res.status(400).json({ error: 'Status must be available, not_available, or maybe' }); return;
  }
  const db = getDb();
  if (!(await db.execute({ sql: 'SELECT id FROM matches WHERE id = ?', args: [req.params.matchId] })).rows[0]) {
    res.status(404).json({ error: 'Match not found' }); return;
  }
  await db.execute({
    sql: `INSERT INTO match_availability (match_id, player_id, status) VALUES (?,?,?)
          ON CONFLICT(match_id, player_id) DO UPDATE SET status=excluded.status, updated_at=CURRENT_TIMESTAMP`,
    args: [req.params.matchId, req.user!.id, status],
  });
  res.json({ message: 'Availability updated' });
});

router.get('/:matchId/availability', authenticate, async (req: AuthRequest, res: Response) => {
  const db = getDb();
  if (!(await db.execute({ sql: 'SELECT id FROM matches WHERE id = ?', args: [req.params.matchId] })).rows[0]) {
    res.status(404).json({ error: 'Match not found' }); return;
  }
  const result = await db.execute({
    sql: `SELECT u.id as player_id, u.name as player_name, u.avatar_url,
          COALESCE(ma.status, 'not_responded') as status, ma.updated_at
          FROM users u
          LEFT JOIN match_availability ma ON ma.player_id = u.id AND ma.match_id = ?
          WHERE u.status = 'active' AND EXISTS (SELECT 1 FROM user_roles ur WHERE ur.user_id = u.id AND ur.role = 'player')
          ORDER BY u.name`,
    args: [req.params.matchId],
  });
  res.json(rows(result.rows));
});

export default router;
