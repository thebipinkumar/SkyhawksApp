## ADDED Requirements

### Requirement: Last login is recorded on successful authentication
On every successful `POST /api/auth/login`, the system SHALL update the authenticated user's `last_login` column to the current UTC timestamp. A failure to write `last_login` SHALL NOT prevent the login response from being returned.

#### Scenario: Successful login records timestamp
- **WHEN** a user submits valid credentials to `POST /api/auth/login`
- **THEN** the `users.last_login` column for that user SHALL be set to the current timestamp
- **THEN** the login response (token + user object) SHALL be returned regardless of whether the timestamp write succeeded

#### Scenario: Failed login does not record timestamp
- **WHEN** a user submits invalid credentials or the account is pending/rejected
- **THEN** `last_login` SHALL NOT be updated

#### Scenario: Last login reflects most recent login only
- **WHEN** a user logs in multiple times
- **THEN** `last_login` SHALL contain only the timestamp of the most recent successful login

### Requirement: Last login is included in API responses
The system SHALL include `last_login` (ISO 8601 string or `null`) in:
- `GET /api/auth/me` — the authenticated user's own profile
- `GET /api/users` — the admin member list
- `GET /api/users/:id` — the individual member profile

#### Scenario: /me response includes last_login
- **WHEN** an authenticated user calls `GET /api/auth/me`
- **THEN** the response body SHALL include a `last_login` field (string or null)

#### Scenario: Admin member list includes last_login
- **WHEN** an admin fetches `GET /api/users`
- **THEN** each user object in the array SHALL include `last_login`

#### Scenario: Never-logged-in user returns null
- **WHEN** a user has been approved but has never successfully logged in
- **THEN** their `last_login` value SHALL be `null` in all API responses
