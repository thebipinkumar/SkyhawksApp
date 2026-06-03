import { Router, Response } from 'express';
import multer from 'multer';
import { getDb, row, rows } from '../db/database.js';
import { authenticate, authorize, AuthRequest } from '../middleware/auth.js';
import { sendCustomAnnouncementEmail } from '../utils/email.js';
import { uploadImage, deleteImage } from '../db/cloudinary.js';

const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
  fileFilter: (_req, file, cb) => (/^image\//.test(file.mimetype) ? cb(null, true) : cb(new Error('Images only'))),
});

// GET / — merged list of team-selection + custom announcements (newest first)
// Returns image_url and image_position for custom type
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
           m.opponent,
           NULL    AS image_url,
           NULL    AS image_position
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
           NULL     AS opponent,
           ca.image_url,
           ca.image_position
    FROM custom_announcements ca
    JOIN users u ON ca.sent_by = u.id

    ORDER BY sent_at DESC
  `);
  res.json(rows(result.rows));
});

// GET /members — active members list for receiver picker (selector/manager/admin)
router.get('/members', authenticate, authorize('selector', 'manager', 'admin'), async (_req: AuthRequest, res: Response) => {
  const result = await getDb().execute(
    `SELECT id, name, email, avatar_url, broadcast_email FROM users WHERE status = 'active' ORDER BY name`
  );
  res.json(rows(result.rows));
});

// POST / — send custom broadcast, with optional image attachment (selector/manager/admin)
// Accepts multipart/form-data: subject, content, recipient_ids, image_position?, image (file, optional)
router.post('/', authenticate, authorize('selector', 'manager', 'admin'), (req: AuthRequest, res: Response) => {
  upload.single('image')(req as any, res as any, async (err: any) => {
    if (err) { res.status(400).json({ error: err.message }); return; }

    const { subject, content, image_position = 'below' } = req.body;
    const rawRecipients = req.body.recipient_ids;
    const imageFile = (req as any).file as Express.Multer.File | undefined;

    if (!subject?.trim()) { res.status(400).json({ error: 'Subject is required' }); return; }
    if (!content?.trim()) { res.status(400).json({ error: 'Content is required' });  return; }

    const db = getDb();

    // Sender name
    const senderRow = (await db.execute({ sql: `SELECT name FROM users WHERE id = ?`, args: [req.user!.id] })).rows[0];
    const sentByName = senderRow ? String(Object.values(senderRow)[0]) : 'Skyhawks Management';

    // Parse recipient_ids (arrives as form string)
    let recipient_ids: string | number[];
    if (!rawRecipients || rawRecipients === 'all') {
      recipient_ids = 'all';
    } else {
      try { recipient_ids = JSON.parse(rawRecipients); } catch { recipient_ids = 'all'; }
    }

    // Build email list
    let emailQuery: string;
    let emailArgs: any[] = [];

    if (recipient_ids === 'all' || (Array.isArray(recipient_ids) && recipient_ids.length === 0)) {
      emailQuery = `SELECT email FROM users WHERE status = 'active' AND broadcast_email = 1`;
    } else {
      const placeholders = (recipient_ids as number[]).map(() => '?').join(',');
      emailQuery = `SELECT email FROM users WHERE id IN (${placeholders}) AND status = 'active' AND broadcast_email = 1`;
      emailArgs = recipient_ids as number[];
    }

    const emailRows = rows((await db.execute({ sql: emailQuery, args: emailArgs })).rows);
    const emailList = emailRows.map((r: any) => r.email as string);

    // Upload image to Cloudinary if provided
    let imageUrl: string | null = null;
    let imagePublicId: string | null = null;
    if (imageFile) {
      try {
        const result = await uploadImage(imageFile.buffer, 'skyhawks/announcements');
        imageUrl = result.url;
        imagePublicId = result.publicId;
      } catch (e: any) {
        res.status(500).json({ error: `Image upload failed: ${e.message}` }); return;
      }
    }

    // Fetch club contact email for CC
    const settingsRow = row((await db.execute({ sql: `SELECT contact_email FROM club_settings WHERE id=1`, args: [] })).rows[0]);
    const clubCc = settingsRow?.contact_email as string | undefined;

    const pos = (image_position === 'above' || image_position === 'below') ? image_position : 'below';

    // Persist record immediately with recipient count — don't wait for delivery
    const sentTo = recipient_ids === 'all' || (Array.isArray(recipient_ids) && recipient_ids.length === 0)
      ? 'all'
      : JSON.stringify(recipient_ids);

    await db.execute({
      sql: `INSERT INTO custom_announcements
              (subject, content, sent_to, recipient_count, sent_by, image_url, image_public_id, image_position)
            VALUES (?,?,?,?,?,?,?,?)`,
      args: [subject.trim(), content.trim(), sentTo, emailList.length, req.user!.id, imageUrl, imagePublicId, pos],
    });

    // Fire-and-forget: emails sent in small batches (4 per batch) with a
    // 6-minute gap to warm up the new sending domain — respond immediately.
    const totalBatches = Math.ceil(emailList.length / 4);
    const estMinutes   = (totalBatches - 1) * 6;
    (async () => {
      const { sent, error: emailError } = await sendCustomAnnouncementEmail(
        emailList, subject.trim(), content.trim(), sentByName, imageUrl, pos, clubCc,
      );
      if (emailError) console.error('Custom announcement send error:', emailError);
      else console.log(`[announce] Custom delivery complete — ${sent} sent`);
    })();

    res.status(201).json({
      message: `Announcement queued for ${emailList.length} member${emailList.length !== 1 ? 's' : ''}. Emails will be delivered in small batches over ~${estMinutes || 1} minute${estMinutes !== 1 ? 's' : ''}.`,
      recipients: emailList.length,
    });
  });
});

// DELETE /team/:id — delete a team-selection announcement (manager/admin)
router.delete('/team/:id', authenticate, authorize('manager', 'admin'), async (req: AuthRequest, res: Response) => {
  const db = getDb();
  const existing = (await db.execute({ sql: `SELECT id FROM announcements WHERE id = ?`, args: [req.params.id] })).rows[0];
  if (!existing) { res.status(404).json({ error: 'Announcement not found' }); return; }
  await db.execute({ sql: `DELETE FROM announcements WHERE id = ?`, args: [req.params.id] });
  res.json({ message: 'Announcement deleted' });
});

// DELETE /custom/:id — delete a custom broadcast announcement (manager/admin)
router.delete('/custom/:id', authenticate, authorize('manager', 'admin'), async (req: AuthRequest, res: Response) => {
  const db = getDb();
  const existing = row((await db.execute({ sql: `SELECT id, image_public_id FROM custom_announcements WHERE id = ?`, args: [req.params.id] })).rows[0]);
  if (!existing) { res.status(404).json({ error: 'Announcement not found' }); return; }
  // Delete image from Cloudinary if present
  if (existing.image_public_id) {
    deleteImage(existing.image_public_id).catch(console.error);
  }
  await db.execute({ sql: `DELETE FROM custom_announcements WHERE id = ?`, args: [req.params.id] });
  res.json({ message: 'Announcement deleted' });
});

// GET /broadcast-settings — full member list with broadcast_email flag (admin)
router.get('/broadcast-settings', authenticate, authorize('admin'), async (_req: AuthRequest, res: Response) => {
  const result = await getDb().execute(
    `SELECT id, name, email, avatar_url, broadcast_email FROM users WHERE status = 'active' ORDER BY name`
  );
  res.json(rows(result.rows));
});

// PATCH /broadcast-settings/:userId — toggle broadcast_email (admin)
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
