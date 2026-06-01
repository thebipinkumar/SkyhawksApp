## Context

The Skyhawks app is a React + Vite frontend (Vercel) with an Express + TypeScript backend (Render) using Turso/LibSQL. The match scheduling form has a plain `<input>` for venue. Venue is stored as a single `TEXT` column and rendered as plain text in email notifications. No mapping library is currently used.

The Google Maps JavaScript API provides a `places.Autocomplete` widget that attaches to any `<input>` and emits structured place data (name, formatted address, `place_id`, lat/lng) — entirely client-side, no backend API calls required.

## Goals / Non-Goals

**Goals:**
- Autocomplete venue names as the manager types using Google Places
- Capture and persist `venue_address` (full formatted address) and `venue_maps_url` (Google Maps deep-link) alongside the existing `venue` name
- Render a "Open in Google Maps" CTA button in match notification and team announcement emails when a map URL is present
- Remain fully backward-compatible — existing matches with no map URL degrade gracefully to the current plain-text display

**Non-Goals:**
- Embedding an interactive map in the app UI (the autocomplete widget is sufficient for scheduling)
- Showing a map preview in the match detail view (can be a future enhancement)
- Geocoding free-text venue entries that were saved before this feature
- Using server-side Google Maps APIs

## Decisions

### D1: Load Google Maps SDK via CDN script tag, not an npm package

**Decision:** Add a conditional `<script>` tag in `index.html` that loads `https://maps.googleapis.com/maps/api/js?key=VITE_GOOGLE_MAPS_API_KEY&libraries=places` only when the env var is set (injected at build time by Vite).

**Alternatives considered:**
- `@googlemaps/js-api-loader` npm package — adds ~30 KB and extra abstraction for something we only use in one component; CDN approach is lighter
- `react-google-autocomplete` — wraps the SDK but pins us to a third-party package that lags Google's API updates

**Rationale:** CDN is the official recommended approach for the Maps JS API and keeps the npm dependency tree clean.

### D2: Store venue name, address, and maps URL as three separate columns

**Decision:**
- `venue` (existing) — short place name, e.g. "Jurong West Sports Centre". Kept as-is for all existing display (cards, PDFs, availability emails).
- `venue_address` (new, nullable TEXT) — full formatted address from Places API, e.g. "61 Jurong West Ave 3, Singapore 649327".
- `venue_maps_url` (new, nullable TEXT) — Google Maps URL constructed from `place_id`: `https://www.google.com/maps/place/?q=place_id:<id>`

**Alternatives considered:**
- Store only `place_id` and reconstruct URLs at render time — adds coupling to Google's URL format in multiple places; storing the URL is simpler and portable
- Concatenate address into `venue` — breaks the existing short-name display on match cards and PDFs

**Rationale:** Clean separation keeps existing UX unchanged while the new columns power the email enhancements.

### D3: VenueAutocomplete component owns the Maps SDK interaction

**Decision:** Create `src/components/VenueAutocomplete.tsx` that:
1. Reads `import.meta.env.VITE_GOOGLE_MAPS_API_KEY` to decide whether to attach autocomplete
2. Attaches `google.maps.places.Autocomplete` to the input ref on mount
3. On `place_changed`, calls `onPlaceSelect({ venue, venue_address, venue_maps_url })`
4. Falls back to a plain `<input>` if the env var is absent — feature is opt-in

**Rationale:** Keeps `Matches.tsx` clean and makes the Google dependency easy to swap or remove.

### D4: Email map link as a styled anchor button, not an `<img>` map

**Decision:** Render a simple `<a>` button styled inline (consistent with existing email template style) rather than embedding a static map image.

**Alternatives considered:**
- Google Static Maps API image — requires another API + billing concern; adds visual weight to the email
- Plain text URL — less prominent, harder to tap on mobile

**Rationale:** Anchor button matches the existing CTA style in both email templates and requires zero additional API calls.

## Risks / Trade-offs

| Risk | Mitigation |
|---|---|
| API key exposed in frontend bundle | Browser key restricted to Vercel domain(s) in Google Cloud Console; Places API only (no geocoding/directions enabled on this key) |
| Google disables free tier or raises prices | Feature is entirely optional — if key is removed, component degrades to plain text input; no data loss |
| Manager types venue manually without picking a suggestion | `venue_address` and `venue_maps_url` remain null; email renders without map link — same as today |
| Autocomplete dropdown blocked by modal z-index | Google renders `.pac-container` at `z-index: 1000` by default; verify it clears the modal overlay (which uses Tailwind's `z-50` = 50); may need `z-[1001]` override on `.pac-container` |
| CDN script tag blocks page render | Script loaded with `async` + `defer`; component guards against `google` not yet defined at mount time |

## Migration Plan

1. Enable Maps JavaScript API + Places API in Google Cloud Console; generate browser key restricted to `skyhawkscricketclub.com` and `localhost`
2. Add `VITE_GOOGLE_MAPS_API_KEY` to Vercel project environment variables and local `.env`
3. Deploy backend first (DB migration runs on startup; new nullable columns are invisible to old frontend code)
4. Deploy frontend — new `VenueAutocomplete` component activates once env var is present

**Rollback:** Remove `VITE_GOOGLE_MAPS_API_KEY` from Vercel → component falls back to plain input. DB columns stay but are harmless.

## Open Questions

- Should the formatted address be shown below the venue name on the match detail card in the app UI? (Not in scope today but would reuse `venue_address`.)
- Should we backfill `venue_maps_url` for historically scheduled matches that have a well-known venue string? (Out of scope — manual edit can trigger autocomplete for any match going forward.)
