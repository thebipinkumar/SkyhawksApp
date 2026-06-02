const TZ = 'Asia/Singapore';

/**
 * Parse a date string from the backend/DB correctly.
 *
 * SQLite's CURRENT_TIMESTAMP returns "YYYY-MM-DD HH:MM:SS" (UTC, no Z).
 * new Date("2026-06-02 09:00:00") is non-ISO and browsers treat it as
 * LOCAL time — wrong. Force UTC by converting to ISO 8601 with Z suffix.
 *
 * ISO dates ("2026-06-02") and already-correct strings pass through safely.
 */
function parseUTC(value: string): Date {
  // "YYYY-MM-DD HH:MM:SS" → "YYYY-MM-DDTHH:MM:SSZ"
  const normalised = value.includes('T') ? value : value.replace(' ', 'T');
  const withZ = normalised.endsWith('Z') || normalised.includes('+') ? normalised : normalised + 'Z';
  return new Date(withZ);
}

/** Format a last_login DB string as "3 Jun 2026 at 5:08 PM", or "Never logged in" if null. */
export function formatLastLogin(value: string | null | undefined): string {
  if (!value) return 'Never logged in';
  const d = parseUTC(value);
  const date = d.toLocaleDateString('en-GB', { timeZone: TZ, day: 'numeric', month: 'short', year: 'numeric' });
  const time = d.toLocaleTimeString('en-US', { timeZone: TZ, hour: 'numeric', minute: '2-digit', hour12: true });
  return `${date} at ${time}`;
}

/** Compact version for tight spaces: "3 Jun 2026" or "Never". */
export function formatLastLoginShort(value: string | null | undefined): string {
  if (!value) return 'Never';
  return parseUTC(value).toLocaleDateString('en-GB', { timeZone: TZ, day: 'numeric', month: 'short', year: 'numeric' });
}

/** Format any DB date string as "3 June 2026" in SGT. */
export function formatDate(value: string | null | undefined): string {
  if (!value) return '—';
  return parseUTC(value).toLocaleDateString('en-GB', { timeZone: TZ, day: 'numeric', month: 'long', year: 'numeric' });
}

/** Format any DB date string as "Sat, 3 Jun 2026" in SGT. */
export function formatDateShort(value: string | null | undefined): string {
  if (!value) return '—';
  return parseUTC(value).toLocaleDateString('en-GB', { timeZone: TZ, weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
}

/** Check if a DB date string has passed, evaluated in SGT. */
export function isExpiredSGT(value: string | null | undefined): boolean {
  if (!value) return false;
  return parseUTC(value) < new Date();
}
