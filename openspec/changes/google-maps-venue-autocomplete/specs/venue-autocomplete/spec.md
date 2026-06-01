## ADDED Requirements

### Requirement: Venue input uses Google Places Autocomplete
When `VITE_GOOGLE_MAPS_API_KEY` is configured, the venue field in the Schedule Match and Edit Match forms SHALL present a Google Places Autocomplete-enabled input that suggests real locations as the manager types.

#### Scenario: Autocomplete suggestions appear while typing
- **WHEN** a manager types at least 2 characters into the venue field
- **THEN** a dropdown of matching Google Places suggestions SHALL appear below the input

#### Scenario: Selecting a suggestion populates venue fields
- **WHEN** a manager selects a suggestion from the autocomplete dropdown
- **THEN** the `venue` field SHALL be set to the place's name (short display name)
- **THEN** the `venue_address` field SHALL be set to the place's full formatted address
- **THEN** the `venue_maps_url` field SHALL be set to `https://www.google.com/maps/place/?q=place_id:<place_id>`

#### Scenario: Manager types freely without selecting a suggestion
- **WHEN** a manager types a venue name and does not pick an autocomplete suggestion
- **THEN** the `venue` field SHALL contain the typed text
- **THEN** `venue_address` and `venue_maps_url` SHALL remain null/empty
- **THEN** the form SHALL submit successfully with no map link attached

#### Scenario: API key is absent (graceful fallback)
- **WHEN** `VITE_GOOGLE_MAPS_API_KEY` is not set in the environment
- **THEN** the venue field SHALL render as a plain text input
- **THEN** no Google Maps SDK SHALL be loaded
- **THEN** the form SHALL behave identically to the current plain-text venue input

#### Scenario: Venue fields are persisted on match creation
- **WHEN** a manager submits the Schedule Match form with an autocomplete-selected venue
- **THEN** the API SHALL store `venue`, `venue_address`, and `venue_maps_url` in the `matches` table
- **THEN** the match detail response SHALL include all three fields

#### Scenario: Venue fields are persisted on match edit
- **WHEN** a manager edits a match and re-selects a venue via autocomplete
- **THEN** the updated `venue`, `venue_address`, and `venue_maps_url` SHALL be stored
- **WHEN** a manager edits a match and clears the venue field manually
- **THEN** `venue_address` and `venue_maps_url` SHALL be set to null
