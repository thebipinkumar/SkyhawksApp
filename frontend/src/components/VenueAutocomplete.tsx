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

// Extend window type for Google Maps
declare global {
  interface Window {
    google?: typeof google;
  }
}

const MAPS_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string | undefined;

export default function VenueAutocomplete({
  value,
  onChange,
  onPlaceSelect,
  placeholder = 'Ground name',
  required,
  className,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null);

  useEffect(() => {
    if (!MAPS_KEY || !inputRef.current) return;

    // Guard: wait for the Maps SDK to be ready (it loads async)
    const tryAttach = () => {
      if (!window.google?.maps?.places) {
        setTimeout(tryAttach, 200);
        return;
      }
      autocompleteRef.current = new window.google.maps.places.Autocomplete(
        inputRef.current!,
        { fields: ['name', 'formatted_address', 'place_id'] }
      );

      autocompleteRef.current.addListener('place_changed', () => {
        const place = autocompleteRef.current!.getPlace();
        if (!place.place_id) return; // User typed without selecting

        onPlaceSelect({
          venue:        place.name ?? inputRef.current!.value,
          venue_address: place.formatted_address ?? null,
          venue_maps_url: `https://www.google.com/maps/place/?q=place_id:${place.place_id}`,
        });
      });
    };

    tryAttach();

    return () => {
      // Clean up listener to avoid leaks on re-mount
      if (autocompleteRef.current) {
        window.google?.maps.event.clearInstanceListeners(autocompleteRef.current);
      }
    };
  }, []);  // eslint-disable-line react-hooks/exhaustive-deps

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
