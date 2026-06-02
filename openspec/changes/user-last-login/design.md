## Context

The Skyhawks app uses a standard JWT auth flow: `POST /login` verifies credentials and returns a token. The `users` table in Turso/LibSQL has no `last_login` column. The frontend `User` type and all three display pages (Profile, Users, AdminMemberProfile) are unaware of any last-login concept. The change is purely additive — one new nullable column, one extra UPDATE on login, and display-only additions in the frontend.

## Goals / Non-Goals

**Goals:**
- Record `last_login = CURRENT_TIMESTAMP` on every successful `POST /login`
- Expose it through `/me`, the admin member list, and individual member profile APIs
- Display it on the Profile page (self), Users page (admin list), and Admin Member Profile page
- Handle `NULL` gracefully everywhere ("Never logged in" label)

**Non-Goals:**
- Full login history / audit log (only the most recent login is stored)
- Tracking token refreshes or API usage as "activity" — only explicit logins count
- Session management, concurrent session detection, or forced logout
- Storing IP address or device info alongside the timestamp

## Decisions

### D1: Store last_login on the users row (not a separate table)

**Decision:** A single nullable `DATETIME` column `last_login` on `users`.

**Alternatives considered:**
- Separate `login_events` audit table — overkill for the requirement; adds JOIN complexity everywhere; the ask is "last login", not "login history"

**Rationale:** One column, one UPDATE per login, zero joins needed anywhere. Completely reversible.

### D2: Write last_login non-blockingly inside the login handler

**Decision:** `UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?` is awaited inline in the login handler, but wrapped in a try/catch so a DB write failure cannot block the login response.

**Alternatives considered:**
- Fire-and-forget (no await) — harder to reason about, masks real errors
- Middleware — unnecessary abstraction for a single UPDATE

**Rationale:** Inline with try/catch gives visibility into errors without ever blocking the user from logging in.

### D3: Display format — "3 Jun 2026 at 9:00 AM"

**Decision:** Use the same `toLocaleDateString('en-GB', {...})` pattern already used throughout the app, combined with the `formatTime12h` helper already in `email.ts` (or a local equivalent in the frontend) for the AM/PM time.

**Rationale:** Consistent with existing date formatting across match cards, profile, and emails.

### D4: NULL shown as "Never logged in"

**Decision:** When `last_login` is `null` (new column, or user approved but never logged in), all three display sites show the string "Never logged in" rather than a dash or empty space.

**Rationale:** More informative for admins scanning for inactive members.

## Risks / Trade-offs

| Risk | Mitigation |
|---|---|
| DB write on every login adds latency | UPDATE by primary key on an indexed column — effectively free on LibSQL |
| Existing `users` rows have `last_login = NULL` after migration | Handled by "Never logged in" display in all three UI locations |
| Multiple concurrent logins could cause a write conflict | LibSQL serialises writes; last writer wins — acceptable for a "last seen" field |
| Admin sees last login of members who never logged in | Clear "Never logged in" label prevents confusion |

## Migration Plan

1. Migration runs automatically on backend startup via `initDb()` try/catch pattern
2. All existing rows get `last_login = NULL` — no data backfill needed
3. Frontend handles `null` gracefully before deploy; no flag day required
4. Rollback: remove the column display from frontend; the column on the DB is harmless if unused
