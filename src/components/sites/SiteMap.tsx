import { useEffect, useRef, useState } from 'react';
import { MapPinnedIcon } from 'lucide-react';
import { loadGoogleMaps, isGoogleMapsConfigured } from '../../lib/googleMaps';
import { googleMapsUrl } from '../../lib/address';
import { AddressValue } from '../../types';

interface Props {
  latitude?: number;
  longitude?: number;
  /** Used as the marker title / hover label. */
  label?: string;
  /**
   * Full address, used to build the "Open in Google Maps" link so it lands on the
   * named place (not raw coordinates). Falls back to lat/lng when absent.
   */
  address?: AddressValue | null;
  className?: string;
}

// Read-only Google Map with a single marker at the site's coordinates. Reuses
// the shared loader (the Places library is already loaded for address inputs;
// the core Map/Marker classes ship with the base JS). Falls back to a calm
// placeholder when the site has no coordinates or Maps isn't configured.
export function SiteMap({ latitude, longitude, label, address, className }: Props) {
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
        gestureHandling: 'cooperative',
        // Suppress Google's own POI info windows so only the site pin is
        // interactive — clicking a nearby place label shouldn't hijack the map.
        clickableIcons: false
      });
      const marker = new g.maps.Marker({ position: center, map, title: label });

      // Universal Google Maps link — opens the web map on desktop and deep-links
      // to the Maps app on iOS/Android. Prefer the address (so Google shows the
      // named place, matching the address link on the site card) and fall back to
      // raw coordinates only when there's no address on file.
      const mapsUrl =
      googleMapsUrl(address ?? null) ??
      `https://www.google.com/maps/search/?api=1&query=${center.lat},${center.lng}`;

      // Info card shown on the first pin tap. Built as DOM nodes (not an HTML
      // string) so the site label can't inject markup.
      const content = document.createElement('div');
      content.style.cssText = 'font-family:inherit;max-width:220px;line-height:1.35;';
      const title = document.createElement('div');
      title.textContent = label || 'Site location';
      title.style.cssText = 'font-weight:600;color:#2A2A2A;margin-bottom:4px;';
      const link = document.createElement('a');
      link.href = mapsUrl;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      link.textContent = 'Open in Google Maps ↗';
      link.style.cssText = 'color:#2F6F4F;font-weight:600;text-decoration:none;font-size:13px;';
      content.append(title, link);
      const info = new g.maps.InfoWindow({ content });

      // First tap opens the card; tapping the pin again (while the card is up)
      // jumps straight to Google Maps — matching the "preview, then open" flow.
      let cardOpen = false;
      marker.addListener('click', () => {
        if (cardOpen) {
          window.open(mapsUrl, '_blank', 'noopener');
        } else {
          info.open({ anchor: marker, map });
          cardOpen = true;
        }
      });
      info.addListener('closeclick', () => {
        cardOpen = false;
      });
    }).
    catch(() => {
      if (!cancelled) setFailed(true);
    });
    return () => {
      cancelled = true;
    };
    // address parts are in deps so the "Open in Google Maps" link stays current.
  }, [hasCoords, latitude, longitude, label, address?.formatted, address?.placeId]);

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
