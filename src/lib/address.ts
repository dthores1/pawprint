import { AddressValue, Person } from '../types';

// Maps a Google PlaceResult (from PlacesService.getDetails) into our flat
// AddressValue. `place` is loosely typed because we don't pull in
// @types/google.maps.
export function placeResultToAddressValue(place: any): AddressValue {
  const components: any[] = place.address_components ?? [];
  const get = (type: string, useShort = false): string | undefined => {
    const c = components.find((comp) => comp.types?.includes(type));
    if (!c) return undefined;
    return useShort ? c.short_name : c.long_name;
  };

  const streetNumber = get('street_number');
  const route = get('route');
  const street1 = [streetNumber, route].filter(Boolean).join(' ') || undefined;

  const loc = place.geometry?.location;
  // location lat/lng can be functions (live JS object) or plain numbers.
  const lat =
  typeof loc?.lat === 'function' ? loc.lat() : typeof loc?.lat === 'number' ? loc.lat : undefined;
  const lng =
  typeof loc?.lng === 'function' ? loc.lng() : typeof loc?.lng === 'number' ? loc.lng : undefined;

  return {
    formatted: place.formatted_address ?? street1 ?? '',
    placeId: place.place_id,
    street1,
    street2: get('subpremise'),
    city: get('locality') ?? get('postal_town') ?? get('sublocality'),
    state: get('administrative_area_level_1', true),
    postalCode: get('postal_code'),
    country: get('country', true),
    latitude: lat,
    longitude: lng
  };
}

// A free-typed address with no Google match — keep what the user wrote so manual
// entry (rural routes, etc.) still saves.
export function rawAddressValue(text: string): AddressValue {
  return { formatted: text };
}

// A Google Maps deep link for an address. Uses the place_id when we have it
// (most precise), otherwise a plain text search. Returns null with no address.
export function googleMapsUrl(a: AddressValue | null): string | null {
  if (!a || !a.formatted.trim()) return null;
  const query = encodeURIComponent(a.formatted);
  const base = `https://www.google.com/maps/search/?api=1&query=${query}`;
  return a.placeId ? `${base}&query_place_id=${a.placeId}` : base;
}

// — Generic prefixed-column mappers ————————————————————————————————
// Entities other than `people` store an address (or two) as a set of columns
// sharing a prefix, e.g. `pickup_*` / `dropoff_*` on transport_requests or
// `location_*` on clinic_events. These flatten/rebuild an AddressValue for any
// such prefix. (People predates this and uses its own helpers above.)

// Flatten an AddressValue into `<prefix>_*` columns. Absent values are written
// as NULL so switching/clearing an address clears its stale sub-components.
export function addressToColumns(
prefix: string,
a: AddressValue | null)
: Record<string, string | number | null> {
  const str = (v?: string) => v && v.trim() ? v : null;
  return {
    [`${prefix}_google_place_id`]: str(a?.placeId),
    [`${prefix}_formatted`]: str(a?.formatted),
    [`${prefix}_street_1`]: str(a?.street1),
    [`${prefix}_street_2`]: str(a?.street2),
    [`${prefix}_city`]: str(a?.city),
    [`${prefix}_state`]: str(a?.state),
    [`${prefix}_postal_code`]: str(a?.postalCode),
    [`${prefix}_country`]: str(a?.country),
    [`${prefix}_latitude`]: a?.latitude ?? null,
    [`${prefix}_longitude`]: a?.longitude ?? null
  };
}

// Rebuild an AddressValue from a DB row's `<prefix>_*` columns. `legacyFormatted`
// is the pre-structured single-line column (e.g. `pickup_location`, `location`)
// used as a fallback for rows saved before structured columns existed. Returns
// null when there's no address at all.
export function addressFromColumns(
row: any,
prefix: string,
legacyFormatted?: string)
: AddressValue | null {
  const formatted = row[`${prefix}_formatted`] ?? legacyFormatted ?? undefined;
  const placeId = row[`${prefix}_google_place_id`] ?? undefined;
  const street1 = row[`${prefix}_street_1`] ?? undefined;
  const city = row[`${prefix}_city`] ?? undefined;
  if (!formatted && !placeId && !street1 && !city) return null;
  const lat = row[`${prefix}_latitude`];
  const lng = row[`${prefix}_longitude`];
  return {
    formatted: formatted ?? '',
    placeId,
    street1,
    street2: row[`${prefix}_street_2`] ?? undefined,
    city,
    state: row[`${prefix}_state`] ?? undefined,
    postalCode: row[`${prefix}_postal_code`] ?? undefined,
    country: row[`${prefix}_country`] ?? undefined,
    latitude: lat != null ? Number(lat) : undefined,
    longitude: lng != null ? Number(lng) : undefined
  };
}

// Build the AddressValue for an edit form from a stored Person.
export function personToAddressValue(p: Person): AddressValue | null {
  const formatted = p.address_formatted ?? p.address;
  if (
  !formatted &&
  !p.address_google_place_id &&
  !p.address_street_1 &&
  !p.address_city)
  {
    return null;
  }
  return {
    formatted: formatted ?? '',
    placeId: p.address_google_place_id,
    street1: p.address_street_1,
    street2: p.address_street_2,
    city: p.address_city,
    state: p.address_state,
    postalCode: p.address_postal_code,
    country: p.address_country,
    latitude: p.address_latitude,
    longitude: p.address_longitude
  };
}

// Flatten an AddressValue into the Person `address_*` columns. We also mirror
// `formatted` into the legacy `address` field so existing displays keep working.
//
// Absent string components are written as '' so the API layer's normalize()
// turns them into NULL — this is what clears stale sub-components when the user
// switches from (say) an apartment address to a house, or clears the field
// entirely. (Lat/lng can't ride the ''→null path; on a full clear they're left
// as-is, which is harmless — orphaned coordinates with no address line.)
export function addressValueToPersonFields(
a: AddressValue | null)
: Partial<Person> {
  const formatted = a?.formatted?.trim() ? a.formatted : '';
  return {
    address: formatted,
    address_formatted: formatted,
    address_google_place_id: a?.placeId || '',
    address_street_1: a?.street1 || '',
    address_street_2: a?.street2 || '',
    address_city: a?.city || '',
    address_state: a?.state || '',
    address_postal_code: a?.postalCode || '',
    address_country: a?.country || '',
    address_latitude: a?.latitude,
    address_longitude: a?.longitude
  };
}
