/** Format a last_login ISO string as "3 Jun 2026 at 9:00 AM", or "Never logged in" if null. */
export function formatLastLogin(value: string | null | undefined): string {
  if (!value) return 'Never logged in';
  const d = new Date(value);
  const date = d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  const h = d.getHours();
  const m = d.getMinutes();
  const period = h >= 12 ? 'PM' : 'AM';
  const hour = h % 12 || 12;
  const time = `${hour}:${String(m).padStart(2, '0')} ${period}`;
  return `${date} at ${time}`;
}

/** Compact version for tight spaces: "3 Jun 2026" or "Never". */
export function formatLastLoginShort(value: string | null | undefined): string {
  if (!value) return 'Never';
  return new Date(value).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}
