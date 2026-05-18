import { Router, Response } from 'express';
import { getDb, rows } from '../db/database.js';
import { authenticate, authorize, AuthRequest } from '../middleware/auth.js';
import { sendCustomAnnouncementEmail } from '../utils/email.js';

const router = Router();

// GET / — merged list: team-selection announcements + custom broadcasts (newest first)
router.get('/', authenticate, async (_req: AuthRequest, res: Response) => {
  const db = getDb();
  const result = await db.execute(`
    SELECT 'team_selection' AS type,
           a.id,
           m.title AS subject,
           ('Team announced for ' || m.title || ' vs ' || m.opponent || ' on ' || m.match_date) AS content,
           u.name  AS sent_by_name,
           a.sent_at,
           NULL    AS recipient_count,
           m.title AS match_title,
           m.opponent
    FROM announcements a
    JOIN users   u ON a.sent_by  = u.id
    JOIN matches m ON a.match_id = m.id

    UNION ALL

    SELECT 'custom'  AS type,
           ca.id,
           ca.subject,
           ca.content,
           u.name   AS sent_by_name,
           ca.sent_at,
           ca.recipient_count,
           NULL     AS match_title,
           NULL     AS opponent
    FROM custom_announcements ca
    JOIN users u ON ca.sent_by = u.id

    ORDER BY sent_at DESC
  `);
  res.json(rows(result.rows));
});

// GET /members — active members with broadcast status (selector/manager/admin — for receiver picker)
router.get('/members', authenticate, authorize('selector', 'manager', 'admin'), async (_req: AuthRequest, res: Response) => {
  const result = await getDb().execute(
    `SELECT id, name, email, avatar_url, broadcast_email FROM users WHERE status = 'active' ORDER BY name`
  );
  res.json(rows(result.rows));
});

// POST / — send a custom broadcast announcement (selector/manager/admin)
router.post('/', authenticate, authorize('selector', 'manager', 'admin'), async (req: AuthRequest, res: Response) => {
  const { subject, content, recipient_ids } = req.body;
  // recipient_ids: number[] | 'all'

  if (!subject?.trim())  { res.status(400).json({ error: 'Subject is required' }); return; }
  if (!content?.trim())  { res.status(400).json({ error: 'Content is required' });  return; }

  const db = getDb();

  // Fetch the sender's name for the email footer
  const senderRow = (await db.execute({ sql: `SELECT name FROM users WHERE id = ?`, args: [req.user!.id] })).rows[0];
  const sentByName = senderRow ? String(Object.values(senderRow)[0]) : 'Skyhawks Management';

  // Build recipient email list (only broadcast_email=1 members)
  let emailQuery: string;
  let emailArgs: any[] = [];

  if (!recipient_ids || recipient_ids === 'all' || (Array.isArray(recipient_ids) && recipient_ids.length === 0)) {
    emailQuery = `SELECT email FROM users WHERE status = 'active' AND broadcast_email = 1`;
  } else if (Array.isArray(recipient_ids) && recipient_ids.length > 0) {
    const placeholders = recipient_ids.map(() => '?').join(',');
    emailQuery = `SELECT email FROM users WHERE id IN (${placeholders}) AND status = 'active' AND broadcast_email = 1`;
    emailArgs = recipient_ids;
  } else {
    res.status(400).json({ error: 'Invalid recipient_ids' }); return;
  }

  const emailRows = rows((await db.execute({ sql: emailQuery, args: emailArgs })).rows);
  const emailList = emailRows.map((r: any) => r.email as string);

  const sentTo = (!recipient_ids || recipient_ids === 'all' || (Array.isArray(recipient_ids) && recipient_ids.length === 0))
    ? 'all'
    : JSON.stringify(recipient_ids);

  // Send emails
  const { sent, error: emailError } = await sendCustomAnnouncementEmail(
    emailList,
    subject.trim(),
    content.trim(),
    sentByName,
  );

  // Persist record
  await db.execute({
    sql: `INSERT INTO custom_announcements (subject, content, sent_to, recipient_count, sent_by) VALUES (?,?,?,?,?)`,
    args: [subject.trim(), content.trim(), sentTo, sent, req.user!.id],
  });

  res.status(201).json({
    message: `Announcement sent to ${sent} member${sent !== 1 ? 's' : ''}`,
    recipients: sent,
    ...(emailError && { emailWarning: emailError }),
  });
});

// GET /broadcast-settings — full member list with broadcast_email flag (admin only)
router.get('/broadcast-settings', authenticate, authorize('admin'), async (_req: AuthRequest, res: Response) => {
  const result = await getDb().execute(
    `SELECT id, name, email, avatar_url, broadcast_email FROM users WHERE status = 'active' ORDER BY name`
  );
  res.json(rows(result.rows));
});

// PATCH /broadcast-settings/:userId — toggle broadcast_email for a member (admin only)
router.patch('/broadcast-settings/:userId', authenticate, authorize('admin'), async (req: AuthRequest, res: Response) => {
  const { broadcast_email } = req.body;
  if (broadcast_email !== 0 && broadcast_email !== 1) {
    res.status(400).json({ error: 'broadcast_email must be 0 or 1' }); return;
  }
  const db = getDb();
  if (!(await db.execute({ sql: `SELECT id FROM users WHERE id = ? AND status = 'active'`, args: [req.params.userId] })).rows[0]) {
    res.status(404).json({ error: 'User not found' }); return;
  }
  await db.execute({ sql: `UPDATE users SET broadcast_email = ? WHERE id = ?`, args: [broadcast_email, req.params.userId] });
  res.json({ message: `Email notifications ${broadcast_email ? 'enabled' : 'disabled'} for member` });
});

export default router;
