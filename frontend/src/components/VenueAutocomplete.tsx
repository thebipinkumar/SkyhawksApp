import { useEffect, useRef } from 'react';

export interface VenuePlaceData {
  venue: string;
  venue_address: string | null;
  venue_maps_url: string | null;
}

interface Props {
  value: string;
  onChange: (venue: string) => void;
  onPlaceSelect: (data: VenuePlaceData) => void;
  placeholder?: string;
  required?: boolean;
  className?: string;
}

declare global {
  interface Window {
    google?: typeof google;
  }
}

const MAPS_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string | undefined;

/**
 * Venue input with Google Places Autocomplete.
 *
 * Uses the classic google.maps.places.Autocomplete widget attached to a
 * controlled <input>.  Falls back silently to a plain <input> when:
 *  - VITE_GOOGLE_MAPS_API_KEY is not configured, or
 *  - the Maps SDK fails to load (invalid key, network error, etc.)
 *
 * NOTE: The API key must list your domain (Vercel URL + localhost) in Google
 * Cloud Console → Credentials → HTTP referrers, otherwise the widget will
 * attach but return no suggestions.
 */
export default function VenueAutocomplete({
  value,
  onChange,
  onPlaceSelect,
  placeholder = 'Ground name',
  required,
  className,
}: Props) {
  const inputRef        = useRef<HTMLInputElement>(null);
  const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null);

  useEffect(() => {
    // Bail if no key is configured AND SDK isn't already loaded
    if (!MAPS_KEY && !window.google?.maps?.places) return;

    const tryAttach = () => {
      if (!window.google?.maps?.places) {
        setTimeout(tryAttach, 200);
        return;
      }
      if (!inputRef.current) return;

      try {
        autocompleteRef.current = new window.google.maps.places.Autocomplete(
          inputRef.current,
          { fields: ['name', 'formatted_address', 'place_id'] },
        );

        autocompleteRef.current.addListener('place_changed', () => {
          const place = autocompleteRef.current!.getPlace();
          if (!place.place_id) return; // user typed without picking
          onPlaceSelect({
            venue:         place.name ?? inputRef.current!.value,
            venue_address: place.formatted_address ?? null,
            venue_maps_url: `https://www.google.com/maps/place/?q=place_id:${place.place_id}`,
          });
        });
      } catch (err) {
        // SDK loaded but autocomplete couldn't initialise (e.g. key restricted to a
        // different domain).  Degrade gracefully — input still works as plain text.
        console.warn('[VenueAutocomplete] Places Autocomplete unavailable:', err);
      }
    };

    tryAttach();

    return () => {
      if (autocompleteRef.current) {
        window.google?.maps?.event?.clearInstanceListeners(autocompleteRef.current);
        autocompleteRef.current = null;
      }
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <input
      ref={inputRef}
      type="text"
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      required={required}
      className={className}
      autoComplete="off"
    />
  );
}
