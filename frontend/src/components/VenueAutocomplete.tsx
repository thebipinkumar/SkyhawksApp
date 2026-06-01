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
 * The input is UNCONTROLLED — Google's Autocomplete widget owns the DOM value.
 * This prevents the React controlled-input vs. Google DOM-manipulation conflict
 * that causes the input to appear frozen when typing.
 *
 * Syncing strategy:
 *  - On every keystroke: call onChange() so parent state stays in sync
 *  - On place selection: call onPlaceSelect() with full place data, then update
 *    the DOM input to the place name via ref
 *  - When parent value changes externally (e.g. form reset / edit mode):
 *    update the DOM input via useEffect, but only when not focused
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

  // Sync external value changes into the uncontrolled input
  // (e.g. when the form opens in edit mode or is reset)
  useEffect(() => {
    const input = inputRef.current;
    if (!input) return;
    // Only update when the field is not focused — never interrupt typing
    if (document.activeElement !== input) {
      input.value = value;
    }
  }, [value]);

  // Attach Google Places Autocomplete once on mount
  useEffect(() => {
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
          if (!place.place_id) return; // user pressed Enter without picking

          const venueName = place.name ?? inputRef.current!.value;

          // Update the DOM input to the selected place name
          if (inputRef.current) inputRef.current.value = venueName;

          // Notify parent of the selected place name (for form state)
          onChange(venueName);

          // Notify parent of full place data (address + map URL)
          onPlaceSelect({
            venue:         venueName,
            venue_address: place.formatted_address ?? null,
            venue_maps_url: `https://www.google.com/maps/place/?q=place_id:${place.place_id}`,
          });
        });
      } catch (err) {
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
      // Uncontrolled: no `value` prop — Google owns the DOM value.
      // defaultValue seeds the input on first render only.
      defaultValue={value}
      onInput={e => onChange((e.target as HTMLInputElement).value)}
      placeholder={placeholder}
      required={required}
      className={className}
      autoComplete="off"
    />
  );
}
