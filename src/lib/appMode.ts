// App run mode. Set VITE_APP_MODE=demo on the public portfolio deploy; any
// other value (or unset) is the real, auth-gated, Supabase-backed app.
// Defaulting to production means we never accidentally ship the no-auth bypass.
export const APP_MODE = import.meta.env.VITE_APP_MODE ?? 'production';
export const isDemoMode = APP_MODE === 'demo';

// Owner Console mode: the read-only platform-admin surface served from
// admin.whiskerville.app. Same build artifact — the host decides. Locally,
// VITE_APP_MODE=admin forces it (there's no admin.* hostname in dev). Demo
// mode wins if both are somehow set: the console has no meaning without
// Supabase, and the demo deploy must never grow an admin surface.
export const isAdminConsole =
  !isDemoMode && (
    APP_MODE === 'admin' ||
    (typeof window !== 'undefined' &&
      window.location.hostname.split('.')[0] === 'admin')
  );
