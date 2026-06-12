import { useEffect, useRef, useState } from 'react';
import { MapPinnedIcon } from 'lucide-react';
import { loadGoogleMaps, isGoogleMapsConfigured } from '../../lib/googleMaps';

interface Props {
  latitude?: number;
  longitude?: number;
  /** Used as the marker title / hover label. */
  label?: string;
  className?: string;
}

// Read-only Google Map with a single marker at the site's coordinates. Reuses
// the shared loader (the Places library is already loaded for address inputs;
// the core Map/Marker classes ship with the base JS). Falls back to a calm
// placeholder when the site has no coordinates or Maps isn't configured.
export function SiteMap({ latitude, longitude, label, className }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState(false);
  const hasCoords = latitude != null && longitude != null;

  useEffect(() => {
    if (!hasCoords || !isGoogleMapsConfigured()) return;
    let cancelled = false;
    loadGoogleMaps().
    then((g) => {
      if (cancelled || !ref.current) return;
      const center = { lat: latitude as number, lng: longitude as number };
      const map = new g.maps.Map(ref.current, {
        center,
        zoom: 15,
        disableDefaultUI: true,
        zoomControl: true,
        gestureHandling: 'cooperative'
      });
      new g.maps.Marker({ position: center, map, title: label });
    }).
    catch(() => {
      if (!cancelled) setFailed(true);
    });
    return () => {
      cancelled = true;
    };
  }, [hasCoords, latitude, longitude, label]);

  if (!hasCoords || failed || !isGoogleMapsConfigured()) {
    return (
      <div
        className={
        'flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border bg-background/50 text-text-secondary ' +
        (className ?? 'h-64')
        }>
        <MapPinnedIcon className="w-8 h-8 opacity-40" />
        <p className="text-sm">
          {hasCoords ? 'Map unavailable' : 'No location set for this site'}
        </p>
      </div>);

  }

  return (
    <div
      ref={ref}
      className={'rounded-xl overflow-hidden border border-border ' + (className ?? 'h-64')} />);

}
