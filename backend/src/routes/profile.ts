import { Router, Response } from 'express';
import multer from 'multer';
import { getDb, row } from '../db/database.js';
import { uploadImage, deleteImage } from '../db/cloudinary.js';
import { authenticate, AuthRequest } from '../middleware/auth.js';

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 }, fileFilter: (_r, f, cb) => (/^image\//.test(f.mimetype) ? cb(null, true) : cb(new Error('Images only'))) });

const router = Router();

router.get('/', authenticate, async (req: AuthRequest, res: Response) => {
  const user = row((await getDb().execute({ sql: 'SELECT id, name, email, role, phone, bio, avatar_url, batting_style, bowling_style, created_at FROM users WHERE id = ?', args: [req.user!.id] })).rows[0]);
  res.json(user);
});

router.put('/', authenticate, async (req: AuthRequest, res: Response) => {
  const { name, phone, bio, batting_style, bowling_style } = req.body;
  if (!name?.trim()) { res.status(400).json({ error: 'Name is required' }); return; }
  const db = getDb();
  await db.execute({ sql: `UPDATE users SET name=?, phone=?, bio=?, batting_style=?, bowling_style=? WHERE id=?`, args: [name.trim(), phone || null, bio || null, batting_style || null, bowling_style || null, req.user!.id] });
  res.json(row((await db.execute({ sql: 'SELECT id, name, email, role, phone, bio, avatar_url, batting_style, bowling_style, created_at FROM users WHERE id = ?', args: [req.user!.id] })).rows[0]));
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

export default router;
