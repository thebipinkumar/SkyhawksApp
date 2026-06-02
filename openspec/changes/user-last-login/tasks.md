## 1. Database Migration

- [x] 1.1 Add migration in `backend/src/db/database.ts` to add `last_login DATETIME` nullable column to the `users` table using the existing try/catch pattern

## 2. Backend — Record Last Login

- [x] 2.1 In `backend/src/routes/auth.ts` `POST /login`, after successful credential verification and before returning the token, add `UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?` wrapped in try/catch so a write failure cannot block the login response

## 3. Backend — Expose Last Login in API Responses

- [x] 3.1 In `backend/src/routes/auth.ts` `GET /me`, add `last_login` to the SELECT column list so users can read their own last login
- [x] 3.2 In `backend/src/routes/users.ts`, add `last_login` to the `PROFILE_COLS` constant used by `GET /:id`
- [x] 3.3 In `backend/src/routes/users.ts`, add `last_login` to the `GET /` active-users list query so the admin member list includes it

## 4. Frontend — Type Definition

- [x] 4.1 Add `last_login?: string | null` to the `User` interface in `frontend/src/types/index.ts`

## 5. Frontend — Helper Function

- [x] 5.1 Add a `formatLastLogin(value: string | null | undefined): string` helper in `frontend/src/pages/Profile.tsx` (or a shared utils file) that returns `"Never logged in"` for null/undefined, or a formatted `"3 Jun 2026 at 9:00 AM"` string using en-GB locale date + 12-hour AM/PM time

## 6. Frontend — Profile Page (self view)

- [x] 6.1 In `frontend/src/pages/Profile.tsx`, add a "Last login" row in the Account Info section below the "Member since" row, calling `formatLastLogin(profile?.last_login)`

## 7. Frontend — Users Page (admin member list)

- [x] 7.1 In `frontend/src/pages/Users.tsx`, add a "Last seen" line on each active member card alongside the existing "Joined" date, showing `formatLastLogin(u.last_login)` (abbreviated to date only on the card, e.g. "Never" or the date without the time for compact display)

## 8. Frontend — Admin Member Profile Page

- [x] 8.1 In `frontend/src/pages/AdminMemberProfile.tsx`, read and display `last_login` from the fetched member data in the account details block, using `formatLastLogin` for formatting

## 9. Verification

- [x] 9.1 Run `npx tsc --noEmit` in both `frontend/` and `backend/` — zero errors
- [ ] 9.2 Log in with a test account and confirm `last_login` is written to the DB and returned by `/me`
- [ ] 9.3 Confirm Profile page shows the correct last login timestamp after logging in
- [ ] 9.4 Confirm Users page (admin) shows "Last seen" on member cards
- [ ] 9.5 Confirm Admin Member Profile page shows "Last login" in the detail block
- [ ] 9.6 Confirm a user with `last_login = NULL` shows "Never logged in" / "Never" in all three locations
