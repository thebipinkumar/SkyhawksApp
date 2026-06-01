import { useEffect, useRef, useState, useCallback } from 'react';
import { MapPin } from 'lucide-react';

export interface VenuePlaceData {
  venue: string;
  venue_address: string | null;
  venue_maps_url: string | null;
}

interface Suggestion {
  label: string;
  description: string;
  placePrediction: any;
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

let placesLib: any = null; // cached after first import

async function loadPlaces() {
  if (placesLib) return placesLib;
  if (!(window.google?.maps as any)?.importLibrary) return null;
  try {
    placesLib = await (window.google!.maps as any).importLibrary('places');
    return placesLib;
  } catch {
    return null;
  }
}

/**
 * Venue autocomplete using the new Places API (New).
 * Uses AutocompleteSuggestion + our own styled input and dropdown —
 * no legacy google.maps.places.Autocomplete widget, no shadow DOM.
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
  const sessionTokenRef = useRef<any>(null);
  const debounceRef     = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef    = useRef<HTMLDivElement>(null);

  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [open, setOpen]               = useState(false);
  const [loading, setLoading]         = useState(false);
  const [activeIdx, setActiveIdx]     = useState(-1);

  // ── Fetch suggestions ──────────────────────────────────────────────────────
  const fetchSuggestions = useCallback(async (input: string) => {
    if (input.length < 2) { setSuggestions([]); setOpen(false); return; }

    const lib = await loadPlaces();
    if (!lib?.AutocompleteSuggestion) return;

    // Reuse or create a session token (groups autocomplete + place details for billing)
    if (!sessionTokenRef.current) {
      sessionTokenRef.current = new lib.AutocompleteSessionToken();
    }

    setLoading(true);
    try {
      const { suggestions: raw } = await lib.AutocompleteSuggestion.fetchAutocompleteSuggestions({
        input,
        sessionToken: sessionTokenRef.current,
      });
      setSuggestions(
        (raw as any[]).map((s: any) => ({
          label:           s.placePrediction?.mainText?.toString()        ?? s.placePrediction?.text?.toString() ?? '',
          description:     s.placePrediction?.secondaryText?.toString()   ?? '',
          placePrediction: s.placePrediction,
        }))
      );
      setOpen(true);
      setActiveIdx(-1);
    } catch (err) {
      console.warn('[VenueAutocomplete] fetchAutocompleteSuggestions error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  // ── Handle typing ──────────────────────────────────────────────────────────
  const handleInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value;
    onChange(v);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => fetchSuggestions(v), 250);
  };

  // ── Select a suggestion ────────────────────────────────────────────────────
  const handleSelect = async (s: Suggestion) => {
    setOpen(false);
    setSuggestions([]);

    const lib = await loadPlaces();
    if (!lib) return;

    try {
      const place = s.placePrediction.toPlace();
      await place.fetchFields({ fields: ['displayName', 'formattedAddress', 'id'] });

      const venueName = place.displayName ?? s.label;
      // Expire the session token after a complete autocomplete → details cycle
      sessionTokenRef.current = null;

      onChange(venueName);
      onPlaceSelect({
        venue:         venueName,
        venue_address: place.formattedAddress ?? null,
        venue_maps_url: place.id
          ? `https://www.google.com/maps/place/?q=place_id:${place.id}`
          : null,
      });

      // Update the uncontrolled input
      if (inputRef.current) inputRef.current.value = venueName;
    } catch (err) {
      console.warn('[VenueAutocomplete] place fetchFields error:', err);
    }
  };

  // ── Keyboard navigation ────────────────────────────────────────────────────
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!open || suggestions.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIdx(i => Math.min(i + 1, suggestions.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIdx(i => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' && activeIdx >= 0) {
      e.preventDefault();
      handleSelect(suggestions[activeIdx]);
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  };

  // ── Sync external value (edit mode / form reset) ──────────────────────────
  useEffect(() => {
    if (inputRef.current && document.activeElement !== inputRef.current) {
      inputRef.current.value = value;
    }
  }, [value]);

  // ── Close dropdown on outside click ──────────────────────────────────────
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Fallback — no Maps key configured
  if (!MAPS_KEY) {
    return (
      <input
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

  return (
    <div ref={containerRef} style={{ position: 'relative' }}>
      <input
        ref={inputRef}
        type="text"
        defaultValue={value}
        onChange={handleInput}
        onKeyDown={handleKeyDown}
        onFocus={() => suggestions.length > 0 && setOpen(true)}
        placeholder={placeholder}
        required={required}
        className={className}
        autoComplete="off"
      />

      {/* Suggestions dropdown */}
      {open && suggestions.length > 0 && (
        <ul
          style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            right: 0,
            zIndex: 1100,
            background: '#fff',
            border: '1px solid #e2e8f0',
            borderRadius: '8px',
            boxShadow: '0 4px 16px rgba(0,0,0,0.10)',
            marginTop: '2px',
            padding: 0,
            listStyle: 'none',
            maxHeight: '240px',
            overflowY: 'auto',
          }}
        >
          {suggestions.map((s, i) => (
            <li
              key={i}
              onMouseDown={e => { e.preventDefault(); handleSelect(s); }}
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: '10px',
                padding: '10px 14px',
                cursor: 'pointer',
                background: i === activeIdx ? '#eff6ff' : 'transparent',
                borderBottom: i < suggestions.length - 1 ? '1px solid #f1f5f9' : 'none',
              }}
            >
              <MapPin size={15} style={{ marginTop: '2px', color: '#3b82f6', flexShrink: 0 }} />
              <div>
                <div style={{ fontSize: '14px', color: '#0f172a', fontWeight: 500 }}>{s.label}</div>
                {s.description && (
                  <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '1px' }}>{s.description}</div>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      {loading && (
        <div style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8', fontSize: '12px' }}>
          …
        </div>
      )}
    </div>
  );
}
