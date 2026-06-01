## ADDED Requirements

### Requirement: Match notification emails include a Google Maps link
When a match has a `venue_maps_url`, the match scheduled notification email and the availability reminder email SHALL include a clearly styled "Open in Google Maps" link below the venue detail row.

#### Scenario: Map link rendered in match scheduled email
- **WHEN** a match notification email is sent for a match with a non-null `venue_maps_url`
- **THEN** the email SHALL include a styled anchor button linking to `venue_maps_url`
- **THEN** the button text SHALL be "Open in Google Maps" (with a 📍 icon)
- **THEN** the link SHALL open in a new tab (`target="_blank"`)

#### Scenario: Map link rendered in availability reminder email
- **WHEN** an availability reminder email is sent (re-triggered notification) for a match with a non-null `venue_maps_url`
- **THEN** the email SHALL include the same "Open in Google Maps" button

#### Scenario: No map link when venue_maps_url is absent
- **WHEN** a match notification or reminder email is sent for a match where `venue_maps_url` is null or empty
- **THEN** the email SHALL NOT include a map button
- **THEN** the venue SHALL be displayed as plain text, identical to current behaviour

### Requirement: Team announcement emails include a Google Maps link
When a match has a `venue_maps_url`, the team selection announcement email SHALL include a "Open in Google Maps" link below the venue row.

#### Scenario: Map link rendered in team announcement email
- **WHEN** a team announcement email is sent for a match with a non-null `venue_maps_url`
- **THEN** the email SHALL include a styled anchor button linking to `venue_maps_url`
- **THEN** the button SHALL be visually consistent with the match notification email style

#### Scenario: No map link in announcement for matches without a URL
- **WHEN** a team announcement is sent for a match where `venue_maps_url` is null
- **THEN** the venue SHALL appear as plain text with no map button

### Requirement: Venue address displayed in emails when available
When a match has a `venue_address`, both the match notification and team announcement emails SHALL display the full formatted address below the short venue name.

#### Scenario: Full address shown below venue name
- **WHEN** an email is sent for a match where `venue_address` is non-null
- **THEN** the email SHALL display `venue_address` in a smaller muted style directly below the venue name

#### Scenario: Only venue name shown when address is absent
- **WHEN** an email is sent for a match where `venue_address` is null
- **THEN** only the existing `venue` (place name) SHALL be shown, with no empty line
