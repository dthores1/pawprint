// App run mode. Set VITE_APP_MODE=demo on the public portfolio deploy; any
// other value (or unset) is the real, auth-gated, Supabase-backed app.
// Defaulting to production means we never accidentally ship the no-auth bypass.
export const APP_MODE = import.meta.env.VITE_APP_MODE ?? 'production';
export const isDemoMode = APP_MODE === 'demo';
