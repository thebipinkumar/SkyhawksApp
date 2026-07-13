import cron from 'node-cron';
import { getDb, row, rows } from '../db/database.js';
import { sendAvailabilityReminderEmail, ReminderMatch } from './email.js';

export function startCronJobs() {
  // ── Midnight SGT: auto-complete past scheduled matches ──────────────────────
  cron.schedule('0 0 * * *', async () => {
    try {
      const db = getDb();
      const result = await db.execute(`
        UPDATE matches
        SET status = 'completed'
        WHERE status = 'scheduled'
          AND match_date < DATE('now', '+8 hours')
      `);
      const changed = Number(result.rowsAffected ?? 0);
      if (changed > 0) console.log(`[cron] Auto-completed ${changed} past match(es).`);
    } catch (err) {
      console.error('[cron] Auto-complete matches failed:', err);
    }
  }, { timezone: 'Asia/Singapore' });

  // ── Hourly: availability reminder (fires at top of each SGT hour) ───────────
  cron.schedule('0 * * * *', async () => {
    try {
      const db = getDb();
      const settings = row((await db.execute(
        `SELECT avail_reminder_enabled, avail_reminder_hour, avail_reminder_last_sent, contact_email
         FROM club_settings WHERE id = 1`
      )).rows[0]);

      if (!settings?.avail_reminder_enabled) return;

      // Current hour in SGT (UTC+8)
      const nowSGT = new Date(Date.now() + 8 * 60 * 60 * 1000);
      const currentHour = nowSGT.getUTCHours();
      if (currentHour !== Number(settings.avail_reminder_hour)) return;

      // Only send once per SGT day
      const todaySGT = nowSGT.toISOString().slice(0, 10);
      if (settings.avail_reminder_last_sent === todaySGT) return;

      // Upcoming scheduled matches where team has NOT been announced yet
      const matchesRes = await db.execute(`
        SELECT id, title, opponent, venue, match_date, match_time, match_type
        FROM matches
        WHERE status = 'scheduled' AND match_date >= DATE('now', '+8 hours') AND is_announced = 0
        ORDER BY match_date ASC, match_time ASC
      `);
      const matches = rows(matchesRes.rows) as (ReminderMatch & { id: number })[];
      if (matches.length === 0) return;

      // Collect member IDs who haven't responded to at least one upcoming match
      const memberIds = new Set<number>();
      for (const match of matches) {
        const res = await db.execute({
          sql: `SELECT u.id FROM users u
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
          args: [match.id, match.id],
        });
        for (const r of rows(res.rows)) memberIds.add(r.id as number);
      }

      if (memberIds.size === 0) {
        console.log('[cron] Availability reminder: all members have responded, skipping.');
        await db.execute({ sql: `UPDATE club_settings SET avail_reminder_last_sent = ? WHERE id = 1`, args: [todaySGT] });
        return;
      }

      // Fetch emails
      const idList = Array.from(memberIds);
      const placeholders = idList.map(() => '?').join(',');
      const emailRes = await db.execute({
        sql: `SELECT email FROM users WHERE id IN (${placeholders}) AND email IS NOT NULL`,
        args: idList,
      });
      const emails = rows(emailRes.rows).map((r: any) => r.email as string).filter(Boolean);

      sendAvailabilityReminderEmail(emails, matches, settings.contact_email as string | undefined);

      // Record that we've sent for today so we don't double-send
      await db.execute({ sql: `UPDATE club_settings SET avail_reminder_last_sent = ? WHERE id = 1`, args: [todaySGT] });

      console.log(`[cron] Availability reminder queued for ${emails.length} member(s), ${matches.length} match(es).`);
    } catch (err) {
      console.error('[cron] Availability reminder failed:', err);
    }
  }, { timezone: 'Asia/Singapore' });

  console.log('[cron] Jobs scheduled (midnight auto-complete + hourly availability reminder).');
}
