import { Router, Response } from 'express';
import { getDb, row, rows } from '../db/database.js';
import { authenticate, authorize, AuthRequest } from '../middleware/auth.js';

const router = Router();

function logEmail(to: string[], subject: string, body: string) {
  console.log('\n====== EMAIL ANNOUNCEMENT ======');
  console.log(`To: ${to.join(', ')}`);
  console.log(`Subject: ${subject}`);
  console.log(`Body:\n${body}`);
  console.log('================================\n');
}

router.post('/matches/:matchId/select', authenticate, authorize('selector', 'admin'), async (req: AuthRequest, res: Response) => {
  const { players } = req.body;
  if (!Array.isArray(players) || players.length === 0) { res.status(400).json({ error: 'Players array is required' }); return; }
  const db = getDb();
  if (!(await db.execute({ sql: 'SELECT id FROM matches WHERE id = ?', args: [req.params.matchId] })).rows[0]) { res.status(404).json({ error: 'Match not found' }); return; }

  await db.execute({ sql: 'DELETE FROM team_selections WHERE match_id = ?', args: [req.params.matchId] });
  for (const p of players) {
    await db.execute({ sql: `INSERT INTO team_selections (match_id,player_id,role_in_match,is_captain,is_vice_captain,selected_by) VALUES (?,?,?,?,?,?)`, args: [req.params.matchId, p.player_id, p.role_in_match || 'player', p.is_captain ? 1 : 0, p.is_vice_captain ? 1 : 0, req.user!.id] });
  }
  const selections = rows((await db.execute({ sql: `SELECT ts.*, u.name as player_name, u.email as player_email FROM team_selections ts JOIN users u ON ts.player_id = u.id WHERE ts.match_id = ?`, args: [req.params.matchId] })).rows);
  res.status(201).json(selections);
});

router.post('/matches/:matchId/announce', authenticate, authorize('selector', 'admin'), async (req: AuthRequest, res: Response) => {
  const db = getDb();
  const match = row((await db.execute({ sql: 'SELECT * FROM matches WHERE id = ?', args: [req.params.matchId] })).rows[0]);
  if (!match) { res.status(404).json({ error: 'Match not found' }); return; }

  const selections = rows((await db.execute({ sql: `SELECT ts.*, u.name as player_name, u.email as player_email FROM team_selections ts JOIN users u ON ts.player_id = u.id WHERE ts.match_id = ? ORDER BY ts.is_captain DESC, ts.is_vice_captain DESC, u.name`, args: [req.params.matchId] })).rows);
  if (selections.length === 0) { res.status(400).json({ error: 'No players selected for this match' }); return; }

  const allMembers = rows((await db.execute('SELECT email FROM users')).rows);
  const emailList = allMembers.map((m: any) => m.email);
  const captain    = selections.find((s: any) => s.is_captain);
  const viceCap    = selections.find((s: any) => s.is_vice_captain);
  const roster     = selections.map((s: any) => `  - ${s.player_name}${s.is_captain ? ' (Captain)' : s.is_vice_captain ? ' (Vice-Captain)' : ''} — ${s.role_in_match}`).join('\n');

  const body = `Skyhawks Cricket Club — Team Announcement\n\nMatch: ${match.title}\nOpponent: ${match.opponent}\nVenue: ${match.venue}\nDate: ${match.match_date} at ${match.match_time}\nFormat: ${match.match_type}\n\nSelected Squad:\n${roster}\n\n${captain ? `Captain: ${captain.player_name}` : ''}\n${viceCap ? `Vice-Captain: ${viceCap.player_name}` : ''}\n\nAnnounced by ${req.user!.name}`.trim();
  logEmail(emailList, `Team Announcement: ${match.title} vs ${match.opponent}`, body);

  await db.execute({ sql: 'INSERT INTO announcements (match_id, message, sent_by) VALUES (?,?,?)', args: [req.params.matchId, `Team announced for ${match.title} vs ${match.opponent} on ${match.match_date}`, req.user!.id] });
  res.json({ message: `Announcement sent to ${emailList.length} members`, recipients: emailList.length });
});

router.get('/announcements', authenticate, async (_req: AuthRequest, res: Response) => {
  const result = await getDb().execute(`SELECT a.*, u.name as sent_by_name, m.title as match_title, m.opponent FROM announcements a JOIN users u ON a.sent_by = u.id JOIN matches m ON a.match_id = m.id ORDER BY a.sent_at DESC`);
  res.json(rows(result.rows));
});

export default router;
