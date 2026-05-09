import { Router, Response } from 'express';
import multer from 'multer';
import { getDb, row, rows } from '../db/database.js';
import { uploadImage, deleteImage } from '../db/cloudinary.js';
import { authenticate, authorize, AuthRequest } from '../middleware/auth.js';

const upload       = multer({ storage: multer.memoryStorage(), limits: { fileSize: 2 * 1024 * 1024 }, fileFilter: (_r, f, cb) => (/^image\//.test(f.mimetype) ? cb(null, true) : cb(new Error('Images only'))) });
const uploadBanner = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 }, fileFilter: (_r, f, cb) => (/^image\//.test(f.mimetype) ? cb(null, true) : cb(new Error('Images only'))) });

const router = Router();

router.get('/', authenticate, authorize('admin'), async (_req: AuthRequest, res: Response) => {
  const db = getDb();
  const settings = row((await db.execute('SELECT * FROM club_settings WHERE id = 1')).rows[0]);
  if (settings) settings.achievements = JSON.parse(settings.achievements || '[]');
  res.json(settings);
});

router.put('/', authenticate, authorize('admin'), async (req: AuthRequest, res: Response) => {
  const { club_name, tagline, founded, description, contact_email, ground, achievements, instagram_url, facebook_url } = req.body;
  if (!club_name?.trim()) { res.status(400).json({ error: 'Club name is required' }); return; }
  const achievementsJson = JSON.stringify(Array.isArray(achievements) ? achievements.filter(Boolean) : []);
  const db = getDb();
  await db.execute({
    sql: `UPDATE club_settings SET club_name=?,tagline=?,founded=?,description=?,contact_email=?,ground=?,achievements=?,instagram_url=?,facebook_url=?,updated_at=CURRENT_TIMESTAMP WHERE id=1`,
    args: [club_name.trim(), tagline || '', founded || '', description || '', contact_email || '', ground || '', achievementsJson, instagram_url || null, facebook_url || null],
  });
  const settings = row((await db.execute('SELECT * FROM club_settings WHERE id = 1')).rows[0]);
  if (settings) settings.achievements = JSON.parse(settings.achievements || '[]');
  res.json(settings);
});

router.post('/logo', authenticate, authorize('admin'), (req: AuthRequest, res: Response) => {
  upload.single('logo')(req as any, res as any, async (err: any) => {
    if (err) { res.status(400).json({ error: err.message || 'Upload failed' }); return; }
    const file = (req as any).file as Express.Multer.File;
    if (!file) { res.status(400).json({ error: 'No file uploaded' }); return; }
    const db = getDb();
    const current = row((await db.execute('SELECT logo_public_id FROM club_settings WHERE id = 1')).rows[0]);
    if (current?.logo_public_id) await deleteImage(current.logo_public_id);
    const { url, publicId } = await uploadImage(file.buffer, 'skyhawks/logos', 'club-logo');
    await db.execute({ sql: 'UPDATE club_settings SET logo_url=?,logo_public_id=?,updated_at=CURRENT_TIMESTAMP WHERE id=1', args: [url, publicId] });
    res.json({ logo_url: url });
  });
});

router.delete('/logo', authenticate, authorize('admin'), async (_req: AuthRequest, res: Response) => {
  const db = getDb();
  const current = row((await db.execute('SELECT logo_public_id FROM club_settings WHERE id = 1')).rows[0]);
  if (current?.logo_public_id) await deleteImage(current.logo_public_id);
  await db.execute({ sql: 'UPDATE club_settings SET logo_url=NULL,logo_public_id=NULL,updated_at=CURRENT_TIMESTAMP WHERE id=1', args: [] });
  res.json({ message: 'Logo removed' });
});

router.get('/banners', authenticate, authorize('admin'), async (_req: AuthRequest, res: Response) => {
  const result = await getDb().execute('SELECT * FROM banner_images ORDER BY sort_order ASC, created_at ASC');
  res.json(rows(result.rows));
});

router.post('/banners', authenticate, authorize('admin'), (req: AuthRequest, res: Response) => {
  uploadBanner.single('banner')(req as any, res as any, async (err: any) => {
    if (err) { res.status(400).json({ error: err.message || 'Upload failed' }); return; }
    const file = (req as any).file as Express.Multer.File;
    if (!file) { res.status(400).json({ error: 'No file uploaded' }); return; }
    const { caption } = req.body;
    const db = getDb();
    const maxRow = (await db.execute('SELECT MAX(sort_order) as m FROM banner_images')).rows[0];
    const maxOrder = (maxRow as any)?.m ?? -1;
    const { url, publicId } = await uploadImage(file.buffer, 'skyhawks/banners');
    const result = await db.execute({
      sql: 'INSERT INTO banner_images (image_url, public_id, caption, sort_order, created_by) VALUES (?,?,?,?,?)',
      args: [url, publicId, caption || null, Number(maxOrder) + 1, req.user!.id],
    });
    res.status(201).json(row((await db.execute({ sql: 'SELECT * FROM banner_images WHERE id = ?', args: [Number(result.lastInsertRowid)] })).rows[0]));
  });
});

router.put('/banners/:id', authenticate, authorize('admin'), async (req: AuthRequest, res: Response) => {
  const { caption, sort_order } = req.body;
  const db = getDb();
  if (!(await db.execute({ sql: 'SELECT id FROM banner_images WHERE id = ?', args: [req.params.id] })).rows[0]) { res.status(404).json({ error: 'Banner not found' }); return; }
  await db.execute({ sql: 'UPDATE banner_images SET caption=?,sort_order=? WHERE id=?', args: [caption || null, sort_order ?? 0, req.params.id] });
  res.json(row((await db.execute({ sql: 'SELECT * FROM banner_images WHERE id = ?', args: [req.params.id] })).rows[0]));
});

router.delete('/banners/:id', authenticate, authorize('admin'), async (req: AuthRequest, res: Response) => {
  const db = getDb();
  const banner = row((await db.execute({ sql: 'SELECT public_id FROM banner_images WHERE id = ?', args: [req.params.id] })).rows[0]);
  if (!banner) { res.status(404).json({ error: 'Banner not found' }); return; }
  if (banner.public_id) await deleteImage(banner.public_id);
  await db.execute({ sql: 'DELETE FROM banner_images WHERE id = ?', args: [req.params.id] });
  res.json({ message: 'Banner deleted' });
});

export default router;
