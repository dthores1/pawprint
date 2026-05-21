import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

if (!url || !anonKey) {
  // Surface a missing/mis-named .env.local early instead of a cryptic failure
  // deep inside a query. Vite only exposes vars prefixed with VITE_, and the
  // dev server must be restarted after editing .env.local.
  console.warn(
    '[supabase] Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY — ' +
    'check .env.local and restart `npm run dev`.'
  );
}

export const supabase = createClient(url ?? '', anonKey ?? '');
