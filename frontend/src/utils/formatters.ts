const TZ = 'Asia/Singapore';

/** Format a last_login ISO string as "3 Jun 2026 at 9:00 AM SGT", or "Never logged in" if null. */
export function formatLastLogin(value: string | null | undefined): string {
  if (!value) return 'Never logged in';
  const d = new Date(value);
  const date = d.toLocaleDateString('en-GB', { timeZone: TZ, day: 'numeric', month: 'short', year: 'numeric' });
  const time = d.toLocaleTimeString('en-GB', { timeZone: TZ, hour: 'numeric', minute: '2-digit', hour12: true }).toUpperCase();
  return `${date} at ${time}`;
}

/** Compact version for tight spaces: "3 Jun 2026" or "Never". */
export function formatLastLoginShort(value: string | null | undefined): string {
  if (!value) return 'Never';
  return new Date(value).toLocaleDateString('en-GB', { timeZone: TZ, day: 'numeric', month: 'short', year: 'numeric' });
}

/** Format any date string as "3 Jun 2026" in Singapore time. */
export function formatDate(value: string | null | undefined): string {
  if (!value) return '—';
  return new Date(value).toLocaleDateString('en-GB', { timeZone: TZ, day: 'numeric', month: 'long', year: 'numeric' });
}

/** Format any date string as "Sat, 3 Jun 2026" in Singapore time. */
export function formatDateShort(value: string | null | undefined): string {
  if (!value) return '—';
  return new Date(value).toLocaleDateString('en-GB', { timeZone: TZ, weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
}

/** Check if a date string has passed, evaluated in Singapore time. */
export function isExpiredSGT(value: string | null | undefined): boolean {
  if (!value) return false;
  // Compare using SGT midnight via Intl
  const now = new Date(new Date().toLocaleString('en-US', { timeZone: TZ }));
  const exp = new Date(new Date(value).toLocaleString('en-US', { timeZone: TZ }));
  return exp < now;
}
