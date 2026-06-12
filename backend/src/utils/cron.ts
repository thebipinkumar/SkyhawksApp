import cron from 'node-cron';
import { getDb } from '../db/database.js';

export function startCronJobs() {
  // Midnight SGT every day: auto-complete scheduled matches whose date has passed
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

  console.log('[cron] Jobs scheduled.');
}
