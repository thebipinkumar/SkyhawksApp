import { Router, Response } from 'express';
import multer from 'multer';
import bcrypt from 'bcryptjs';
import { getDb, row } from '../db/database.js';
import { uploadImage, deleteImage } from '../db/cloudinary.js';
import { authenticate, AuthRequest } from '../middleware/auth.js';

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 }, fileFilter: (_r, f, cb) => (/^image\//.test(f.mimetype) ? cb(null, true) : cb(new Error('Images only'))) });

const router = Router();

const PROFILE_COLS = `id, name, email, role, phone, bio, avatar_url, batting_style, bowling_style, created_at,
  date_of_birth, jersey_number, jersey_label,
  whites_tshirt_size, whites_lower_size, whites_sleeve,
  colored_tshirt_size, colored_lower_size, colored_sleeve,
  membership_start, membership_end, last_login`;

router.get('/', authenticate, async (req: AuthRequest, res: Response) => {
  const user = row((await getDb().execute({ sql: `SELECT ${PROFILE_COLS} FROM users WHERE id = ?`, args: [req.user!.id] })).rows[0]);
  res.json(user);
});

router.put('/', authenticate, async (req: AuthRequest, res: Response) => {
  const { name, phone, bio, batting_style, bowling_style,
    date_of_birth, jersey_number, jersey_label,
    whites_tshirt_size, whites_lower_size, whites_sleeve,
    colored_tshirt_size, colored_lower_size, colored_sleeve } = req.body;
  if (!name?.trim()) { res.status(400).json({ error: 'Name is required' }); return; }
  const db = getDb();

  // Jersey number uniqueness check
  if (jersey_number) {
    const conflict = (await db.execute({
      sql: `SELECT name FROM users WHERE jersey_number = ? AND status = 'active' AND id != ?
            UNION ALL SELECT name FROM merchandise_extras WHERE jersey_number = ?`,
      args: [jersey_number, req.user!.id, jersey_number],
    })).rows[0];
    if (conflict) {
      const taken = Object.fromEntries(Object.entries(conflict));
      res.status(409).json({ error: `Jersey number ${jersey_number} is already assigned to ${taken.name}` }); return;
    }
  }

  await db.execute({
    sql: `UPDATE users SET name=?, phone=?, bio=?, batting_style=?, bowling_style=?,
          date_of_birth=?, jersey_number=?, jersey_label=?,
          whites_tshirt_size=?, whites_lower_size=?, whites_sleeve=?,
          colored_tshirt_size=?, colored_lower_size=?, colored_sleeve=?
          WHERE id=?`,
    args: [name.trim(), phone||null, bio||null, batting_style||null, bowling_style||null,
           date_of_birth||null, jersey_number||null, jersey_label||null,
           whites_tshirt_size||null, whites_lower_size||null, whites_sleeve||null,
           colored_tshirt_size||null, colored_lower_size||null, colored_sleeve||null,
           req.user!.id],
  });
  res.json(row((await db.execute({ sql: `SELECT ${PROFILE_COLS} FROM users WHERE id = ?`, args: [req.user!.id] })).rows[0]));
});

router.post('/avatar', authenticate, (req: AuthRequest, res: Response) => {
  upload.single('avatar')(req as any, res as any, async (err: any) => {
    if (err) { res.status(400).json({ error: err.message }); return; }
    const file = (req as any).file as Express.Multer.File;
    if (!file) { res.status(400).json({ error: 'No file uploaded' }); return; }
    const db = getDb();
    // Delete old avatar from Cloudinary
    const current = row((await db.execute({ sql: 'SELECT avatar_public_id FROM users WHERE id = ?', args: [req.user!.id] })).rows[0]);
    if (current?.avatar_public_id) await deleteImage(current.avatar_public_id);
    // Upload new
    const { url, publicId } = await uploadImage(file.buffer, 'skyhawks/avatars', `avatar-${req.user!.id}`);
    await db.execute({ sql: 'UPDATE users SET avatar_url=?, avatar_public_id=? WHERE id=?', args: [url, publicId, req.user!.id] });
    res.json({ avatar_url: url });
  });
});

router.delete('/avatar', authenticate, async (req: AuthRequest, res: Response) => {
  const db = getDb();
  const current = row((await db.execute({ sql: 'SELECT avatar_public_id FROM users WHERE id = ?', args: [req.user!.id] })).rows[0]);
  if (current?.avatar_public_id) await deleteImage(current.avatar_public_id);
  await db.execute({ sql: 'UPDATE users SET avatar_url=NULL, avatar_public_id=NULL WHERE id=?', args: [req.user!.id] });
  res.json({ message: 'Avatar removed' });
});

router.post('/change-password', authenticate, async (req: AuthRequest, res: Response) => {
  const { old_password, new_password } = req.body;
  if (!old_password || !new_password) { res.status(400).json({ error: 'Both old and new password are required' }); return; }
  if (new_password.length < 6) { res.status(400).json({ error: 'New password must be at least 6 characters' }); return; }

  const db = getDb();
  const user = row((await db.execute({ sql: 'SELECT password_hash FROM users WHERE id = ?', args: [req.user!.id] })).rows[0]);
  if (!bcrypt.compareSync(old_password, user.password_hash)) {
    res.status(400).json({ error: 'Current password is incorrect' }); return;
  }

  await db.execute({ sql: 'UPDATE users SET password_hash = ? WHERE id = ?', args: [bcrypt.hashSync(new_password, 10), req.user!.id] });
  res.json({ message: 'Password changed successfully' });
});

export default router;
