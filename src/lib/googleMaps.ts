// Loads the Google Maps JavaScript API (with the Places library) exactly once,
// returning a shared promise so every <AddressAutocomplete> reuses the same
// script tag. The key is a browser key (restricted by HTTP referrer in the
// Google Cloud console); it's fine to ship it to the client.
//
// We use the legacy Places library (AutocompleteService / PlacesService) — make
// sure the **Places API** (not only "Places API (New)") is enabled on the key's
// project, or prediction calls come back REQUEST_DENIED.

const API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string | undefined;

// `any` because we don't pull in @types/google.maps — the surface we touch is
// small and guarded at the call sites.
type GoogleNamespace = any;

let loadPromise: Promise<GoogleNamespace> | null = null;

export function isGoogleMapsConfigured(): boolean {
  return Boolean(API_KEY);
}

export function loadGoogleMaps(): Promise<GoogleNamespace> {
  if (loadPromise) return loadPromise;

  loadPromise = new Promise((resolve, reject) => {
    if (!API_KEY) {
      reject(new Error('VITE_GOOGLE_MAPS_API_KEY is not set'));
      return;
    }
    // Already present (e.g. a previous load in this session).
    const existing = (window as any).google?.maps?.places;
    if (existing) {
      resolve((window as any).google);
      return;
    }
    const script = document.createElement('script');
    // With loading=async the bootstrap sets up google.maps.importLibrary but
    // does NOT attach libraries by onload — so we must await importLibrary()
    // rather than reading google.maps.places directly (that races and yields
    // "loaded without the Places library"). No `libraries=` param needed.
    script.src =
    `https://maps.googleapis.com/maps/api/js?key=${API_KEY}` +
    '&v=weekly&loading=async';
    script.async = true;
    script.defer = true;
    script.onerror = () => {
      // Let the next caller retry rather than caching a permanent failure.
      loadPromise = null;
      reject(new Error('Failed to load the Google Maps script'));
    };
    script.onload = () => {
      const g = (window as any).google;
      const importLib = g?.maps?.importLibrary;
      if (typeof importLib === 'function') {
        // Awaiting guarantees google.maps.places is populated before we resolve.
        g.maps.
        importLibrary('places').
        then(() => resolve(g)).
        catch((e: unknown) => {
          loadPromise = null;
          reject(e instanceof Error ? e : new Error('Places library failed to load'));
        });
      } else if (g?.maps?.places) {
        resolve(g);
      } else {
        loadPromise = null;
        reject(new Error('Google Maps loaded without the Places library'));
      }
    };
    document.head.appendChild(script);
  });

  return loadPromise;
}
