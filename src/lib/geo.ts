import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useWhisker } from '../context/WhiskerContext';
import { personToAddressValue } from './address';

export interface LatLng {
  lat: number;
  lng: number;
}

const EARTH_RADIUS_MI = 3958.8;

const toRad = (deg: number) => (deg * Math.PI) / 180;

/** Great-circle distance in miles between two coordinates. */
export function haversineMiles(a: LatLng, b: LatLng): number {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_MI * Math.asin(Math.min(1, Math.sqrt(h)));
}

/**
 * "2.1 miles away (straight-line distance)" — one decimal, with sensible rounding. The
 * qualifier flags that this is the great-circle distance (see haversineMiles),
 * not a driving route, so it's not mistaken for a trip estimate.
 */
export function formatDistance(miles: number): string {
  const rounded = miles < 10 ? Math.round(miles * 10) / 10 : Math.round(miles);
  return `${rounded} ${rounded === 1 ? 'mile' : 'miles'} away (straight-line distance)`;
}

export type LocationSource = 'geolocation' | 'profile';

export interface UserLocation {
  location: LatLng | null;
  source: LocationSource | null;
}

/**
 * Resolves the viewer's location for "distance from you" calculations. Tries the
 * browser Geolocation API first (one permission prompt), and falls back to the
 * signed-in user's saved profile address lat/long when geolocation is denied,
 * unavailable, or still pending. Returns `{ location: null }` when neither is
 * available (e.g. no profile address and geolocation declined).
 */
export function useUserLocation(): UserLocation {
  const { currentPersonId } = useAuth();
  const { people } = useWhisker();
  const [geo, setGeo] = useState<LatLng | null>(null);

  useEffect(() => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) return;
    let cancelled = false;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        if (!cancelled) {
          setGeo({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        }
      },
      () => {
        // Denied / unavailable — silently fall back to the profile address.
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 }
    );
    return () => {
      cancelled = true;
    };
  }, []);

  if (geo) return { location: geo, source: 'geolocation' };

  const self = people.find((p) => p.id === currentPersonId);
  const addr = self ? personToAddressValue(self) : null;
  if (addr?.latitude != null && addr?.longitude != null) {
    return { location: { lat: addr.latitude, lng: addr.longitude }, source: 'profile' };
  }
  return { location: null, source: null };
}
