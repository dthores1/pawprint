import { Select } from '../ui/Forms';
import { AddressAutocomplete } from '../ui/AddressAutocomplete';
import { MapPinIcon, XIcon, AlertTriangleIcon } from 'lucide-react';
import { useWhisker } from '../../context/WhiskerContext';
import { AddressValue } from '../../types';
import { isResolvedAddress } from '../../lib/address';

export type LocationMode = 'address' | 'saved';

interface Props {
  id?: string;
  value: AddressValue | null;
  /** Set when the value came from a Saved Location (shows its friendly name). */
  savedLocationId?: string;
  mode: LocationMode;
  onModeChange: (mode: LocationMode) => void;
  onChange: (value: AddressValue | null, savedLocationId?: string) => void;
  error?: boolean;
  placeholder?: string;
  /** Hint shown when the value is free-text only (no saved location / address).
   *  Defaults to the transport "Needs address" wording. */
  freeTextHint?: string;
}

// Pickup/dropoff entry. Keeps the address picker primary; a tiny link below
// swaps the field to a Saved Locations picker (and back), so it never looks like
// both must be filled. A free-text-only value (no saved location, no
// coordinates) is flagged so the request gets a "Needs address" badge.
export function LocationPicker({
  id,
  value,
  savedLocationId,
  mode,
  onModeChange,
  onChange,
  error,
  placeholder,
  freeTextHint = 'No exact address yet — this request will be flagged “Needs address.”'
}: Props) {
  const { savedLocations } = useWhisker();
  const active = savedLocations.filter((l) => l.active);
  const hasSaved = active.length > 0;
  const chosen = savedLocationId ?
  savedLocations.find((l) => l.id === savedLocationId) :
  undefined;

  // Switch modes from the link, clearing whatever was entered/picked so the
  // alternate field starts fresh.
  const switchTo = (next: LocationMode) => {
    onChange(null, undefined);
    onModeChange(next);
  };

  const linkClass =
  'text-xs font-medium text-primary hover:underline';

  if (mode === 'saved') {
    return (
      <div className="space-y-1.5">
        {chosen ?
        <div className="flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2.5">
            <MapPinIcon className="w-4 h-4 text-primary shrink-0" />
            <span className="text-sm text-text-primary truncate flex-1 min-w-0">
              {chosen.name}
              {chosen.address?.formatted &&
            <span className="text-text-secondary">
                  {' '}· {chosen.address.formatted}
                </span>
            }
            </span>
            <button
            type="button"
            aria-label="Clear saved location"
            onClick={() => onChange(null, undefined)}
            className="p-1 rounded-md text-text-secondary hover:text-text-primary hover:bg-card transition-colors shrink-0">

              <XIcon className="w-4 h-4" />
            </button>
          </div> :

        <Select
          id={id}
          className={error ? 'border-red-500 focus:ring-red-500' : undefined}
          value=""
          onChange={(e) => {
            const loc = active.find((l) => l.id === e.target.value);
            if (loc) onChange(loc.address, loc.id);
          }}>

            <option value="">Choose a saved place…</option>
            {active.map((l) =>
          <option key={l.id} value={l.id}>{l.name}</option>
          )}
          </Select>
        }
        <button
          type="button"
          onClick={() => switchTo('address')}
          className={linkClass}>

          Use an address instead
        </button>
      </div>);

  }

  const freeText = !!value?.formatted.trim() && !isResolvedAddress(value);

  return (
    <div className="space-y-1.5">
      <AddressAutocomplete
        id={id}
        value={value}
        error={error}
        onChange={(addr) => onChange(addr, undefined)}
        placeholder={placeholder} />

      {freeText &&
      <p className="flex items-start gap-1.5 text-xs text-[#A36B00]">
          <AlertTriangleIcon className="w-3.5 h-3.5 shrink-0 mt-px" />
          {freeTextHint}
        </p>
      }
      {hasSaved &&
      <button
        type="button"
        onClick={() => switchTo('saved')}
        className={linkClass}>

          Use a saved location
        </button>
      }
    </div>);

}
