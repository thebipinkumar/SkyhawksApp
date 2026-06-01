## 1. Google Cloud Setup (Manual Pre-step)

- [x] 1.1 Create or open a Google Cloud project and enable "Maps JavaScript API" and "Places API"
- [x] 1.2 Generate a browser API key; restrict it to HTTP referrers matching your Vercel domain and `localhost`
- [x] 1.3 Add `VITE_GOOGLE_MAPS_API_KEY=<key>` to `frontend/.env` (local) and Vercel project environment variables

## 2. Database Migration

- [x] 2.1 Add migration in `backend/src/db/database.ts` to add `venue_address TEXT` nullable column to `matches`
- [x] 2.2 Add migration in `backend/src/db/database.ts` to add `venue_maps_url TEXT` nullable column to `matches`

## 3. Backend Route Updates

- [x] 3.1 Update `POST /matches` in `backend/src/routes/matches.ts` to destructure and persist `venue_address` and `venue_maps_url` from request body
- [x] 3.2 Update `PUT /matches/:id` in `backend/src/routes/matches.ts` to accept and persist `venue_address` and `venue_maps_url`
- [x] 3.3 Update the `MatchNotificationData` interface in `backend/src/utils/email.ts` to add optional `venue_address?: string | null` and `venue_maps_url?: string | null`
- [x] 3.4 Update the `AnnouncementEmailData` interface in `backend/src/utils/email.ts` to add optional `venue_address?: string | null` and `venue_maps_url?: string | null`
- [x] 3.5 Pass `venue_address` and `venue_maps_url` from match row into the notification data object in the `POST /matches` notify block and the `POST /matches/:id/notify` route
- [x] 3.6 Pass `venue_address` and `venue_maps_url` from match row into the announcement data object in `backend/src/routes/selections.ts` announce route

## 4. Email Template Updates

- [x] 4.1 Update `buildMatchNotificationHtml()` in `email.ts` to show `venue_address` (muted small text) below the venue name row when present
- [x] 4.2 Update `buildMatchNotificationHtml()` in `email.ts` to render a styled "📍 Open in Google Maps" anchor button after the venue row when `venue_maps_url` is present
- [x] 4.3 Update `buildHtml()` (team announcement) in `email.ts` to show `venue_address` below the venue name row when present
- [x] 4.4 Update `buildHtml()` (team announcement) in `email.ts` to render a styled "📍 Open in Google Maps" anchor button after the venue row when `venue_maps_url` is present

## 5. Frontend — VenueAutocomplete Component

- [x] 5.1 Add Google Maps JS SDK `<script>` tag to `frontend/index.html`, injecting `VITE_GOOGLE_MAPS_API_KEY` at build time (load with `async defer`, only render tag when key is defined)
- [x] 5.2 Create `frontend/src/components/VenueAutocomplete.tsx` with props: `value`, `onChange(venue: string)`, `onPlaceSelect({ venue, venue_address, venue_maps_url })`, `placeholder`, `required`
- [x] 5.3 In `VenueAutocomplete`, attach `google.maps.places.Autocomplete` to the input ref on mount (guard against `window.google` not yet available)
- [x] 5.4 On `place_changed` event, extract place name, `formatted_address`, and construct `venue_maps_url` from `place.place_id`; call `onPlaceSelect`
- [x] 5.5 Add CSS override so `.pac-container` (Google autocomplete dropdown) renders above modal overlays (z-index fix)
- [x] 5.6 Fall back to a plain `<input>` when `import.meta.env.VITE_GOOGLE_MAPS_API_KEY` is absent

## 6. Frontend — Matches Page Integration

- [x] 6.1 Add `venue_address` and `venue_maps_url` to the form state type and `emptyMatch` / `openEdit` initializers in `frontend/src/pages/Matches.tsx`
- [x] 6.2 Replace the plain venue `<input>` with `<VenueAutocomplete>` in the Schedule/Edit Match form; wire `onPlaceSelect` to update all three venue fields in form state
- [x] 6.3 Include `venue_address` and `venue_maps_url` in the POST body when creating a match
- [x] 6.4 Include `venue_address` and `venue_maps_url` in the PUT body when editing a match
- [x] 6.5 When `openEdit` is called, populate `venue_address` and `venue_maps_url` from the existing match data so editing preserves the map link unless the manager changes the venue

## 7. Verification

- [x] 7.1 Run `npx tsc --noEmit` in both `frontend/` and `backend/` — zero errors
- [ ] 7.2 Schedule a test match using autocomplete: confirm `venue`, `venue_address`, `venue_maps_url` are all saved in the DB
- [ ] 7.3 Trigger a match notification and confirm the email contains the "Open in Google Maps" button with the correct URL
- [ ] 7.4 Announce a team for the test match and confirm the announcement email also contains the map button
- [ ] 7.5 Schedule a match by typing a venue without selecting an autocomplete suggestion: confirm it saves without error and emails render the plain venue name with no map button
- [ ] 7.6 Remove `VITE_GOOGLE_MAPS_API_KEY` locally and confirm the venue field falls back to a plain text input with no JS errors
