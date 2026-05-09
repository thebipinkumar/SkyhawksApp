import { Router, Request, Response } from 'express';
import { getDb, row, rows } from '../db/database.js';

const router = Router();

router.get('/banners', async (_req: Request, res: Response) => {
  const result = await getDb().execute('SELECT id, image_url, caption, sort_order FROM banner_images ORDER BY sort_order ASC, created_at ASC');
  res.json(rows(result.rows));
});

router.get('/members', async (_req: Request, res: Response) => {
  const db = getDb();
  const usersResult = await db.execute(`SELECT id, name, role, batting_style, bowling_style, bio, avatar_url, created_at FROM users WHERE status = 'active' ORDER BY name`);
  const userList = rows(usersResult.rows);

  const rolesResult = await db.execute(`SELECT user_id, role FROM user_roles WHERE user_id IN (SELECT id FROM users WHERE status = 'active')`);
  const rolesMap: Record<number, string[]> = {};
  for (const r of rows(rolesResult.rows)) {
    if (!rolesMap[r.user_id]) rolesMap[r.user_id] = [];
    rolesMap[r.user_id].push(r.role);
  }

  res.json(userList.map(u => ({
    ...u,
    roles: rolesMap[u.id]?.length ? rolesMap[u.id] : [u.role],
  })));
});

router.get('/matches', async (_req: Request, res: Response) => {
  const result = await getDb().execute(`
    SELECT m.id, m.title, m.opponent, m.venue, m.match_date, m.match_time,
           m.match_type, m.status, m.result, m.notes, u.name as created_by_name
    FROM matches m JOIN users u ON m.created_by = u.id
    WHERE m.status = 'scheduled'
    ORDER BY m.match_date ASC, m.match_time ASC
  `);
  res.json(rows(result.rows));
});

router.get('/about', async (_req: Request, res: Response) => {
  const db = getDb();
  const settings  = row((await db.execute('SELECT * FROM club_settings WHERE id = 1')).rows[0]);
  const memberRow = (await db.execute('SELECT COUNT(*) as n FROM users')).rows[0];
  const matchRow  = (await db.execute('SELECT COUNT(*) as n FROM matches')).rows[0];
  const wonRow    = (await db.execute(`SELECT COUNT(*) as n FROM matches WHERE status='completed' AND result LIKE 'Won%'`)).rows[0];
  res.json({
    club_name:     settings?.club_name     || 'Skyhawks Cricket Club',
    tagline:       settings?.tagline       || 'Play Hard. Fly High.',
    founded:       settings?.founded       || '2018',
    description:   settings?.description   || '',
    contact_email: settings?.contact_email || 'info@skyhawks.com',
    ground:        settings?.ground        || '',
    logo_url:      settings?.logo_url      || null,
    achievements:  JSON.parse((settings?.achievements as string) || '[]'),
    stats: {
      members: Number((memberRow as any).n),
      matches: Number((matchRow as any).n),
      wins:    Number((wonRow as any).n),
    },
  });
});

export default router;
