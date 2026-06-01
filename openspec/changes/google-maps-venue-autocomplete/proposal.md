## Why

Venue is currently a plain text field — members receive no map link in notifications, making it hard to navigate to grounds they haven't visited before. Adding Google Maps autocomplete at scheduling time gives managers a fast, accurate way to capture venue details and automatically enriches every email notification with a one-tap "Open in Maps" link.

## What Changes

- Replace the plain venue text input in the Schedule Match form with a Google Places Autocomplete field
- Store two new fields alongside the existing `venue` name: `venue_address` (full formatted address) and `venue_maps_url` (direct Google Maps link)
- Embed a clickable "Open in Google Maps" button in match schedule notification emails and team announcement emails when a map URL is present
- Add `VITE_GOOGLE_MAPS_API_KEY` to the frontend environment; no backend API key needed

## Capabilities

### New Capabilities

- `venue-autocomplete`: Google Places Autocomplete on the venue input — suggests real locations as the manager types, captures place name, formatted address, and a Google Maps URL on selection
- `venue-map-link`: Display a Google Maps deep-link in match notification and team announcement emails wherever a `venue_maps_url` is stored

### Modified Capabilities

<!-- None — no existing spec files to delta against -->

## Impact

**Frontend**
- `src/pages/Matches.tsx` — venue `<input>` replaced with `VenueAutocomplete` component; form state gains `venue_address` and `venue_maps_url` fields
- New component `src/components/VenueAutocomplete.tsx`
- `index.html` — Google Maps JS SDK script tag (loaded conditionally via `VITE_GOOGLE_MAPS_API_KEY`)
- `frontend/.env` / Vercel env vars — `VITE_GOOGLE_MAPS_API_KEY`

**Backend**
- `src/db/database.ts` — migration adds `venue_address TEXT` and `venue_maps_url TEXT` nullable columns to `matches`
- `src/routes/matches.ts` — `POST /matches` and `PUT /matches/:id` accept and persist new fields; both email data objects include `venue_maps_url`
- `src/utils/email.ts` — `MatchNotificationData` and `AnnouncementEmailData` gain optional `venue_maps_url`; both HTML builders render a Maps CTA button when the field is present

**Dependencies**
- No new npm packages required (Google Maps JS API loaded via CDN script tag)
- Google Cloud project: Maps JavaScript API + Places API enabled; browser key restricted to Vercel domain
