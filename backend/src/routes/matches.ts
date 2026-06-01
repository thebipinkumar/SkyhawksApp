import { Router, Response } from 'express';
import { getDb, row, rows } from '../db/database.js';
import { authenticate, authorize, AuthRequest } from '../middleware/auth.js';
import { sendMatchScheduledEmail, MatchNotificationData } from '../utils/email.js';

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

// GET /my-pending — scheduled upcoming matches where current user hasn't responded to availability
router.get('/my-pending', authenticate, async (req: AuthRequest, res: Response) => {
  const db = getDb();
  const result = await db.execute({
    sql: `SELECT m.id, m.title, m.opponent, m.venue, m.match_date, m.match_time, m.match_type,
                 t.name as tournament_name
          FROM matches m
          LEFT JOIN tournaments t ON m.tournament_id = t.id
          WHERE m.status = 'scheduled'
            AND m.match_date >= DATE('now')
            AND (
              NOT EXISTS (
                SELECT 1 FROM match_availability ma
                WHERE ma.match_id = m.id AND ma.player_id = ?
              )
              OR EXISTS (
                SELECT 1 FROM match_availability ma
                WHERE ma.match_id = m.id AND ma.player_id = ? AND ma.status = 'not_responded'
              )
            )
          ORDER BY m.match_date ASC, m.match_time ASC`,
    args: [req.user!.id, req.user!.id],
  });
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

  const memberTeam = rows((await db.execute({
    sql: `SELECT ts.id, ts.match_id, ts.player_id, ts.role_in_match, ts.is_captain, ts.is_vice_captain,
                 u.name as player_name, u.email as player_email, u.avatar_url as player_avatar,
                 0 as is_guest, NULL as guest_id
          FROM team_selections ts JOIN users u ON ts.player_id = u.id
          WHERE ts.match_id = ?
          ORDER BY ts.is_captain DESC, ts.is_vice_captain DESC, u.name`,
    args: [req.params.id],
  })).rows);
  const guestTeam = rows((await db.execute({
    sql: `SELECT id as guest_id, match_id, NULL as player_id, role_in_match, is_captain, is_vice_captain,
                 name as player_name, NULL as player_email, NULL as player_avatar,
                 1 as is_guest
          FROM team_selection_guests WHERE match_id = ?
          ORDER BY is_captain DESC, is_vice_captain DESC, name`,
    args: [req.params.id],
  })).rows);
  const team = [...memberTeam, ...guestTeam];
  res.json({ ...match, team });
});

router.post('/', authenticate, authorize('manager', 'admin'), async (req: AuthRequest, res: Response) => {
  const { title, opponent, venue, venue_address, venue_maps_url, match_date, match_time, match_type, notes, ball_type, attire, match_fee, scorecard_url, tournament_id, notify_members } = req.body;
  if (!title || !opponent || !venue || !match_date || !match_time) {
    res.status(400).json({ error: 'Title, opponent, venue, date and time are required' }); return;
  }
  const db = getDb();
  const result = await db.execute({
    sql: `INSERT INTO matches (title,opponent,venue,venue_address,venue_maps_url,match_date,match_time,match_type,notes,ball_type,attire,match_fee,scorecard_url,tournament_id,created_by)
          VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    args: [title, opponent, venue, venue_address || null, venue_maps_url || null,
           match_date, match_time, match_type || 'T20', notes || null,
           ball_type || 'White', attire || 'Colored', match_fee ?? null, scorecard_url || null,
           tournament_id || null, req.user!.id],
  });
  const match = row((await db.execute({ sql: 'SELECT * FROM matches WHERE id = ?', args: [Number(result.lastInsertRowid)] })).rows[0]);

  // Send notification email to all members if requested (non-blocking)
  if (notify_members) {
    (async () => {
      try {
        const [membersRes, settingsRes, tournamentRes] = await Promise.all([
          db.execute({ sql: `SELECT email FROM users WHERE status='active' AND broadcast_email=1`, args: [] }),
          db.execute({ sql: `SELECT contact_email FROM club_settings WHERE id=1`, args: [] }),
          tournament_id ? db.execute({ sql: `SELECT name FROM tournaments WHERE id=?`, args: [tournament_id] }) : Promise.resolve(null),
        ]);
        const emails  = rows(membersRes.rows).map((r: any) => r.email as string).filter(Boolean);
        const settings = row(settingsRes.rows[0]);
        const cc      = settings?.contact_email as string | undefined;
        const tName   = tournamentRes ? (row(tournamentRes.rows[0])?.name as string | null) : null;

        const data: MatchNotificationData = {
          matchTitle: title, opponent, venue, venueAddress: venue_address || null,
          venueMapsUrl: venue_maps_url || null, matchDate: match_date, matchTime: match_time,
          matchType: match_type || 'T20', ballType: ball_type, attire, matchFee: match_fee ?? null,
          tournament: tName, notes: notes || null,
        };
        await sendMatchScheduledEmail(emails, data, cc);
      } catch (err) { console.error('Match notification error:', err); }
    })();
  }

  res.status(201).json(match);
});

// Re-trigger match notification to all members (manager/admin)
router.post('/:id/notify', authenticate, authorize('manager', 'admin'), async (req: AuthRequest, res: Response) => {
  const db = getDb();
  const match = row((await db.execute({
    sql: `SELECT m.*, t.name as tournament_name FROM matches m
          LEFT JOIN tournaments t ON m.tournament_id = t.id
          WHERE m.id = ?`,
    args: [req.params.id],
  })).rows[0]);
  if (!match) { res.status(404).json({ error: 'Match not found' }); return; }

  const [membersRes, settingsRes] = await Promise.all([
    // Only members who have NOT responded (no row, or status = 'not_responded')
    db.execute({
      sql: `SELECT u.email FROM users u
            WHERE u.status = 'active' AND u.broadcast_email = 1
              AND (
                NOT EXISTS (
                  SELECT 1 FROM match_availability ma
                  WHERE ma.match_id = ? AND ma.player_id = u.id
                )
                OR EXISTS (
                  SELECT 1 FROM match_availability ma
                  WHERE ma.match_id = ? AND ma.player_id = u.id AND ma.status = 'not_responded'
                )
              )`,
      args: [req.params.id, req.params.id],
    }),
    db.execute({ sql: `SELECT contact_email FROM club_settings WHERE id=1`, args: [] }),
  ]);
  const emails   = rows(membersRes.rows).map((r: any) => r.email as string).filter(Boolean);
  const settings = row(settingsRes.rows[0]);
  const cc       = settings?.contact_email as string | undefined;

  if (emails.length === 0) {
    res.json({ message: 'All members have already responded — no notification sent.', sent: 0 });
    return;
  }

  const data: MatchNotificationData = {
    matchTitle:   match.title as string,
    opponent:     match.opponent as string,
    venue:        match.venue as string,
    venueAddress: match.venue_address as string | null,
    venueMapsUrl: match.venue_maps_url as string | null,
    matchDate:    match.match_date as string,
    matchTime:    match.match_time as string,
    matchType:    match.match_type as string,
    isReminder:   true,   // re-trigger → send as availability reminder
    ballType:     match.ball_type as string | undefined,
    attire:       match.attire as string | undefined,
    matchFee:     match.match_fee as number | null,
    tournament:   match.tournament_name as string | null,
    notes:        match.notes as string | null,
  };

  const result = await sendMatchScheduledEmail(emails, data, cc);
  if (result.error) { res.status(500).json({ error: result.error }); return; }
  res.json({ message: `Availability reminder sent to ${result.sent} member${result.sent !== 1 ? 's' : ''} who hadn't responded`, sent: result.sent });
});

router.put('/:id', authenticate, authorize('manager', 'admin'), async (req: AuthRequest, res: Response) => {
  const { title, opponent, venue, venue_address, venue_maps_url, match_date, match_time, match_type, status, result: matchResult, notes, ball_type, attire, match_fee, scorecard_url, tournament_id } = req.body;
  const db = getDb();
  if (!(await db.execute({ sql: 'SELECT id FROM matches WHERE id = ?', args: [req.params.id] })).rows[0]) {
    res.status(404).json({ error: 'Match not found' }); return;
  }
  await db.execute({
    sql: `UPDATE matches SET title=?,opponent=?,venue=?,venue_address=?,venue_maps_url=?,match_date=?,match_time=?,match_type=?,status=?,result=?,notes=?,ball_type=?,attire=?,match_fee=?,scorecard_url=?,tournament_id=? WHERE id=?`,
    args: [title, opponent, venue, venue_address || null, venue_maps_url || null,
           match_date, match_time, match_type, status, matchResult || null,
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
  await db.execute({ sql: 'DELETE FROM announcements            WHERE match_id = ?', args: [req.params.id] });
  await db.execute({ sql: 'DELETE FROM team_selections           WHERE match_id = ?', args: [req.params.id] });
  await db.execute({ sql: 'DELETE FROM team_selection_guests     WHERE match_id = ?', args: [req.params.id] });
  await db.execute({ sql: 'DELETE FROM match_availability        WHERE match_id = ?', args: [req.params.id] });
  await db.execute({ sql: 'DELETE FROM matches                   WHERE id = ?',       args: [req.params.id] });
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
