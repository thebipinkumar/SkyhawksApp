## Why

There is currently no way to know when a club member last accessed the portal — admins cannot identify inactive or ghost accounts, and members have no visibility into their own session history. Tracking last login provides this at zero cost: one write per login, surfaced in two places.

## What Changes

- Record `last_login` timestamp in the `users` table on every successful login
- Expose `last_login` on the `/me` response so each user can see their own last login
- Include `last_login` in the admin member list and member profile API responses
- Display last login on the **Profile page** ("Last login: 3 Jun 2026 at 9:00 AM")
- Display last login on the **Users (admin) page** member cards ("Last seen …")
- Display last login on the **Admin Member Profile page** in the account details block
- Show "Never logged in" when `last_login` is `NULL` (existing accounts, new approvals)

## Capabilities

### New Capabilities

- `login-tracking`: Record and expose the timestamp of each user's most recent successful login
- `last-login-display`: Render last login date/time for the user themselves (Profile) and for admins (Users list, Admin Member Profile)

### Modified Capabilities

<!-- None — no existing spec files to delta against -->

## Impact

**Backend**
- `backend/src/db/database.ts` — migration adds `last_login DATETIME` nullable column to `users`
- `backend/src/routes/auth.ts` — `POST /login` writes `last_login = CURRENT_TIMESTAMP` after successful auth; `GET /me` includes `last_login` in SELECT
- `backend/src/routes/users.ts` — `PROFILE_COLS` constant and active-users list query both include `last_login`

**Frontend**
- `frontend/src/types/index.ts` — `User` interface gains `last_login?: string | null`
- `frontend/src/pages/Profile.tsx` — Account Info section shows user's own last login
- `frontend/src/pages/Users.tsx` — Member cards show "Last seen" for admin
- `frontend/src/pages/AdminMemberProfile.tsx` — Member detail block shows last login

**No breaking changes** — `last_login` is nullable; all display sites handle `null` gracefully.
