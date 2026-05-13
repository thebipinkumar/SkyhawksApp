import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM = 'Skyhawks Cricket Club <announcements@skyhawkscricketclub.com>';

export interface AnnouncementEmailData {
  matchTitle: string;
  opponent: string;
  venue: string;
  matchDate: string;
  matchTime: string;
  matchType: string;
  ballType?: string;
  attire?: string;
  matchFee?: number | null;
  tournament?: string;
  squad: { name: string; role: string; isCaptain: boolean; isViceCaptain: boolean }[];
  announcedBy: string;
}

function buildHtml(data: AnnouncementEmailData): string {
  const squadRows = data.squad.map(p => {
    const badge = p.isCaptain ? ' <span style="background:#1e3a8a;color:#fff;font-size:11px;padding:1px 6px;border-radius:9999px;">Captain</span>'
                : p.isViceCaptain ? ' <span style="background:#1e40af;color:#fff;font-size:11px;padding:1px 6px;border-radius:9999px;">Vice-Captain</span>'
                : '';
    const roleCell = p.role ? `<td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;color:#64748b;">${p.role}</td>`
                            : `<td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;color:#cbd5e1;">—</td>`;
    return `<tr>
      <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;">${p.name}${badge}</td>
      ${roleCell}
    </tr>`;
  }).join('');

  const extraBadges = [
    data.ballType ? `🏏 ${data.ballType} Ball` : null,
    data.attire   ? `👕 ${data.attire} Attire` : null,
    data.matchFee != null ? `💰 Match Fee: S$${data.matchFee}` : null,
  ].filter(Boolean).map(b =>
    `<span style="display:inline-block;background:#f1f5f9;color:#475569;font-size:12px;padding:3px 10px;border-radius:9999px;margin:2px 4px 2px 0;">${b}</span>`
  ).join('');

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:system-ui,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;padding:32px 16px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">

        <!-- Header -->
        <tr>
          <td style="background:linear-gradient(135deg,#1e3a8a,#1d4ed8);padding:32px 32px 24px;text-align:center;">
            <p style="margin:0 0 4px;color:#93c5fd;font-size:13px;letter-spacing:0.05em;text-transform:uppercase;">Skyhawks Cricket Club</p>
            <h1 style="margin:0;color:#fff;font-size:22px;font-weight:700;">Team Announcement</h1>
          </td>
        </tr>

        <!-- Match details -->
        <tr>
          <td style="padding:28px 32px 0;">
            <h2 style="margin:0 0 4px;font-size:18px;color:#0f172a;">${data.matchTitle}</h2>
            <p style="margin:0 0 16px;font-size:16px;color:#1d4ed8;font-weight:600;">vs ${data.opponent}</p>
            <table cellpadding="0" cellspacing="0" width="100%">
              <tr>
                <td style="padding:6px 0;color:#64748b;font-size:14px;">📍</td>
                <td style="padding:6px 0;font-size:14px;color:#334155;">${data.venue}</td>
              </tr>
              <tr>
                <td style="padding:6px 0;color:#64748b;font-size:14px;">📅</td>
                <td style="padding:6px 0;font-size:14px;color:#334155;">${new Date(data.matchDate).toLocaleDateString('en-GB', { weekday:'long', day:'numeric', month:'long', year:'numeric' })} at ${data.matchTime}</td>
              </tr>
              <tr>
                <td style="padding:6px 0;color:#64748b;font-size:14px;">🏏</td>
                <td style="padding:6px 0;font-size:14px;color:#334155;">${data.matchType}</td>
              </tr>
              ${data.tournament ? `<tr>
                <td style="padding:6px 0;color:#64748b;font-size:14px;">🏆</td>
                <td style="padding:6px 0;font-size:14px;color:#334155;font-weight:600;">${data.tournament}</td>
              </tr>` : ''}
            </table>
            ${extraBadges ? `<div style="margin-top:12px;">${extraBadges}</div>` : ''}
          </td>
        </tr>

        <!-- Squad -->
        <tr>
          <td style="padding:24px 32px 0;">
            <h3 style="margin:0 0 12px;font-size:15px;font-weight:700;color:#0f172a;text-transform:uppercase;letter-spacing:0.05em;">Selected Squad</h3>
            <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e2e8f0;border-radius:10px;overflow:hidden;">
              <tr style="background:#f8fafc;">
                <th style="padding:8px 12px;text-align:left;font-size:12px;color:#64748b;font-weight:600;text-transform:uppercase;letter-spacing:0.05em;">Player</th>
                <th style="padding:8px 12px;text-align:left;font-size:12px;color:#64748b;font-weight:600;text-transform:uppercase;letter-spacing:0.05em;">Role</th>
              </tr>
              ${squadRows}
            </table>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="padding:24px 32px 32px;">
            <p style="margin:0;font-size:13px;color:#94a3b8;">Announced by <strong style="color:#64748b;">${data.announcedBy}</strong></p>
            <hr style="border:none;border-top:1px solid #f1f5f9;margin:16px 0;">
            <p style="margin:0;font-size:12px;color:#cbd5e1;text-align:center;">Skyhawks Cricket Club · skyhawkscricketclub.com</p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

export async function sendAnnouncementEmails(
  recipients: string[],
  data: AnnouncementEmailData
): Promise<{ sent: number; error?: string }> {
  if (!process.env.RESEND_API_KEY) {
    console.warn('RESEND_API_KEY not set — skipping email send');
    return { sent: 0, error: 'Email not configured' };
  }
  if (recipients.length === 0) return { sent: 0 };

  try {
    // Resend free tier: send in batches of 50 to stay within rate limits
    const batchSize = 50;
    let sent = 0;
    for (let i = 0; i < recipients.length; i += batchSize) {
      const batch = recipients.slice(i, i + batchSize);
      await resend.emails.send({
        from: FROM,
        to: batch,
        subject: `Team Announcement: ${data.matchTitle} vs ${data.opponent}`,
        html: buildHtml(data),
      });
      sent += batch.length;
    }
    return { sent };
  } catch (err: any) {
    console.error('Resend error:', err);
    return { sent: 0, error: err.message };
  }
}

export async function sendPasswordResetEmail(to: string, name: string, resetUrl: string): Promise<void> {
  if (!process.env.RESEND_API_KEY) { console.warn('RESEND_API_KEY not set — skipping reset email'); return; }
  const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:system-ui,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;padding:32px 16px;">
    <tr><td align="center">
      <table width="520" cellpadding="0" cellspacing="0" style="max-width:520px;width:100%;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
        <tr><td style="background:linear-gradient(135deg,#1e3a8a,#1d4ed8);padding:28px 32px;text-align:center;">
          <p style="margin:0 0 4px;color:#93c5fd;font-size:13px;text-transform:uppercase;letter-spacing:0.05em;">Skyhawks Cricket Club</p>
          <h1 style="margin:0;color:#fff;font-size:20px;font-weight:700;">Password Reset</h1>
        </td></tr>
        <tr><td style="padding:32px;">
          <p style="margin:0 0 16px;color:#334155;">Hi <strong>${name}</strong>,</p>
          <p style="margin:0 0 24px;color:#64748b;line-height:1.6;">We received a request to reset your password. Click the button below to set a new password. This link expires in <strong>1 hour</strong>.</p>
          <div style="text-align:center;margin-bottom:24px;">
            <a href="${resetUrl}" style="display:inline-block;background:#1d4ed8;color:#fff;font-weight:700;padding:14px 32px;border-radius:10px;text-decoration:none;font-size:15px;">Reset My Password</a>
          </div>
          <p style="margin:0 0 8px;color:#94a3b8;font-size:13px;">If the button doesn't work, copy this link:</p>
          <p style="margin:0 0 24px;color:#64748b;font-size:12px;word-break:break-all;">${resetUrl}</p>
          <p style="margin:0;color:#94a3b8;font-size:12px;">If you didn't request this, you can safely ignore this email.</p>
          <hr style="border:none;border-top:1px solid #f1f5f9;margin:24px 0 12px;">
          <p style="margin:0;text-align:center;color:#cbd5e1;font-size:12px;">Skyhawks Cricket Club · skyhawkscricketclub.com</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;

  await resend.emails.send({ from: FROM, to, subject: 'Reset your Skyhawks password', html });
}
