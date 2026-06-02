## ADDED Requirements

### Requirement: User sees own last login on Profile page
The Profile page SHALL display the authenticated user's `last_login` in the Account Info section, formatted as a human-readable date and 12-hour time (e.g. "3 Jun 2026 at 9:00 AM").

#### Scenario: Last login shown when available
- **WHEN** a user visits their Profile page and `last_login` is non-null
- **THEN** the Account Info section SHALL display "Last login: <date> at <time AM/PM>"

#### Scenario: Never logged in shown when null
- **WHEN** a user visits their Profile page and `last_login` is null
- **THEN** the Account Info section SHALL display "Last login: Never logged in"

### Requirement: Admin sees last login on member cards in Users page
The Users page (admin view) SHALL display each member's `last_login` on their card alongside the existing "Joined" date.

#### Scenario: Last seen shown on member card
- **WHEN** an admin views the Users page and a member has a non-null `last_login`
- **THEN** the member card SHALL show "Last seen: <date> at <time AM/PM>"

#### Scenario: Never logged in shown on member card
- **WHEN** an admin views the Users page and a member has a null `last_login`
- **THEN** the member card SHALL show "Last seen: Never"

### Requirement: Admin sees last login on Admin Member Profile page
The Admin Member Profile page SHALL display the selected member's `last_login` in the account details block.

#### Scenario: Last login shown in member detail
- **WHEN** an admin opens a member's profile and `last_login` is non-null
- **THEN** the account details block SHALL include "Last login: <date> at <time AM/PM>"

#### Scenario: Never logged in shown in member detail
- **WHEN** an admin opens a member's profile and `last_login` is null
- **THEN** the account details block SHALL display "Last login: Never logged in"

### Requirement: Last login date/time format is consistent
All display sites SHALL format `last_login` using the same pattern used elsewhere in the app: day/month/year in en-GB locale for the date, and 12-hour AM/PM for the time.

#### Scenario: Format matches app convention
- **WHEN** `last_login` is "2026-06-03T09:00:00"
- **THEN** it SHALL be displayed as "3 Jun 2026 at 9:00 AM" (not "06/03/2026 09:00")
