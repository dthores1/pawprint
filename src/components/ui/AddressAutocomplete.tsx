import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { MapPinIcon, XIcon, Loader2Icon } from 'lucide-react';
import { Input } from './Forms';
import { CalendarPopover } from './CalendarPopover';
import { AddressValue } from '../../types';
import { loadGoogleMaps, isGoogleMapsConfigured } from '../../lib/googleMaps';
import { placeResultToAddressValue, rawAddressValue } from '../../lib/address';

interface Props {
  value: AddressValue | null;
  onChange: (value: AddressValue | null) => void;
  id?: string;
  placeholder?: string;
  error?: boolean;
  /** Bias predictions to a country (ISO code). Defaults to US. */
  country?: string;
}

interface Prediction {
  placeId: string;
  primary: string;
  secondary: string;
}

const MIN_QUERY = 3;
const DEBOUNCE_MS = 250;

// Address typeahead backed by Google Places. Predictions stream as you type
// (debounced, session-tokened so a "type → pick" sequence bills as one
// session); selecting one fetches the structured components. Free-typed text is
// preserved too, so manual entry still saves when Places has no match or the
// API is unavailable.
export function AddressAutocomplete({
  value,
  onChange,
  id,
  placeholder = 'Start typing an address…',
  error,
  country = 'us'
}: Props) {
  const [query, setQuery] = useState(value?.formatted ?? '');
  const [open, setOpen] = useState(false);
  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(!isGoogleMapsConfigured());
  const [menuWidth, setMenuWidth] = useState<number>();

  const wrapperRef = useRef<HTMLDivElement>(null);
  const autocompleteRef = useRef<any>(null);
  const placesRef = useRef<any>(null);
  const tokenRef = useRef<any>(null);
  const googleRef = useRef<any>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  // Keep the input text in sync when the value changes from outside (edit form).
  useEffect(() => {
    setQuery(value?.formatted ?? '');
  }, [value?.formatted]);

  // Load the Google Maps Places library once and build the services.
  useEffect(() => {
    if (!isGoogleMapsConfigured()) return;
    let cancelled = false;
    loadGoogleMaps().
    then((google) => {
      if (cancelled) return;
      googleRef.current = google;
      autocompleteRef.current = new google.maps.places.AutocompleteService();
      // PlacesService needs a DOM node (it never renders into it for details).
      placesRef.current = new google.maps.places.PlacesService(
        document.createElement('div')
      );
      tokenRef.current = new google.maps.places.AutocompleteSessionToken();
      setReady(true);
    }).
    catch((e) => {
      console.error('[address] Google Maps failed to load:', e);
      if (!cancelled) setFailed(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useLayoutEffect(() => {
    if (open) setMenuWidth(wrapperRef.current?.offsetWidth);
  }, [open, predictions.length]);

  const fetchPredictions = (input: string) => {
    if (!ready || !autocompleteRef.current) return;
    if (input.trim().length < MIN_QUERY) {
      setPredictions([]);
      return;
    }
    setLoading(true);
    autocompleteRef.current.getPlacePredictions(
      {
        input,
        sessionToken: tokenRef.current,
        types: ['address'],
        componentRestrictions: country ? { country } : undefined
      },
      (results: any[] | null) => {
        setLoading(false);
        setPredictions(
          (results ?? []).map((r) => ({
            placeId: r.place_id,
            primary: r.structured_formatting?.main_text ?? r.description,
            secondary: r.structured_formatting?.secondary_text ?? ''
          }))
        );
      }
    );
  };

  const handleInput = (text: string) => {
    setQuery(text);
    setOpen(true);
    // The text is the source of truth — reflect it up so the form always has
    // the latest, even before a Places selection (or if there's never one).
    onChange(text.trim() ? rawAddressValue(text) : null);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => fetchPredictions(text), DEBOUNCE_MS);
  };

  const handleSelect = (placeId: string) => {
    if (!placesRef.current) return;
    placesRef.current.getDetails(
      {
        placeId,
        fields: ['address_components', 'formatted_address', 'geometry', 'place_id'],
        sessionToken: tokenRef.current
      },
      (place: any, status: string) => {
        if (place && status === googleRef.current?.maps?.places?.PlacesServiceStatus?.OK) {
          const addr = placeResultToAddressValue(place);
          setQuery(addr.formatted);
          onChange(addr);
        }
        setOpen(false);
        setPredictions([]);
        // A details fetch closes the billing session — start a fresh token.
        if (googleRef.current) {
          tokenRef.current =
          new googleRef.current.maps.places.AutocompleteSessionToken();
        }
      }
    );
  };

  const clear = () => {
    setQuery('');
    setPredictions([]);
    onChange(null);
  };

  return (
    <div>
      <div className="relative" ref={wrapperRef}>
        <MapPinIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-secondary pointer-events-none" />
      <Input
        id={id}
        type="text"
        autoComplete="off"
        placeholder={placeholder}
        value={query}
        aria-invalid={error || undefined}
        className={`pl-9 ${query ? 'pr-9' : ''} ${
        error ? 'border-red-500 focus:ring-red-500' : ''}`
        }
        onChange={(e) => handleInput(e.target.value)}
        onFocus={() => predictions.length > 0 && setOpen(true)} />

      {loading ?
      <Loader2Icon className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-secondary animate-spin" /> :
      query ?
      <button
        type="button"
        onClick={clear}
        aria-label="Clear address"
        className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-md text-text-secondary hover:bg-background hover:text-text-primary transition-colors">

          <XIcon className="w-4 h-4" />
        </button> :
      null}

      <CalendarPopover
        anchorRef={wrapperRef}
        open={open && predictions.length > 0}
        onClose={() => setOpen(false)}
        padded={false}>

        <ul style={{ width: menuWidth }} className="max-h-72 overflow-y-auto py-1">
          {predictions.map((p) =>
          <li key={p.placeId}>
              <button
              type="button"
              onMouseDown={(e) => {
                // Keep focus on the input so the popover's outside-click close
                // doesn't fire before the selection handler runs.
                e.preventDefault();
                handleSelect(p.placeId);
              }}
              className="w-full flex items-start gap-2.5 px-3 py-2.5 text-left hover:bg-background cursor-pointer transition-colors">

                <MapPinIcon className="w-4 h-4 text-text-secondary mt-0.5 shrink-0" />
                <span className="min-w-0">
                  <span className="block font-medium text-text-primary truncate text-sm">
                    {p.primary}
                  </span>
                  {p.secondary &&
                <span className="block text-xs text-text-secondary truncate">
                      {p.secondary}
                    </span>
                }
                </span>
              </button>
            </li>
          )}
        </ul>
      </CalendarPopover>
      </div>

      {failed &&
      <p className="mt-1.5 text-xs text-text-secondary">
          Address suggestions are unavailable — you can type the address manually.
        </p>
      }
    </div>);

}
