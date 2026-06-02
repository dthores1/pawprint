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
    const w = window as any;
    // Already present (e.g. a previous load in this session).
    if (w.google?.maps?.places) {
      resolve(w.google);
      return;
    }
    // Don't rely on script.onload — with the Maps loader the script `load`
    // event fires before the API core + libraries are attached, so reading
    // google.maps.places there races ("loaded without the Places library").
    // Instead let Google call us back: with `&callback=` + `&libraries=places`
    // the callback runs only once google.maps.places is fully ready.
    const CALLBACK = '__pawprintGmapsReady';
    w[CALLBACK] = () => {
      const g = w.google;
      if (g?.maps?.places) resolve(g);
      else {
        loadPromise = null;
        reject(new Error('Google Maps loaded without the Places library'));
      }
      try {delete w[CALLBACK];} catch {w[CALLBACK] = undefined;}
    };
    const script = document.createElement('script');
    script.src =
    `https://maps.googleapis.com/maps/api/js?key=${API_KEY}` +
    `&libraries=places&v=weekly&callback=${CALLBACK}`;
    script.async = true;
    script.onerror = () => {
      // Let the next caller retry rather than caching a permanent failure.
      loadPromise = null;
      reject(new Error('Failed to load the Google Maps script'));
    };
    document.head.appendChild(script);
  });

  return loadPromise;
}
