import { createClient } from '@supabase/supabase-js';
import { reportWriteFailure } from './errorReporting';

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

// Every data/storage MUTATION the client issues flows through this wrapper —
// the one choke point where failed writes surface the global "Something went
// wrong" toast and get silently logged (see lib/errorReporting.ts). Reads and
// auth traffic are left alone: RLS legitimately returns empty reads, and auth
// flows render their own error states.
const MUTATION_METHODS = new Set(['POST', 'PATCH', 'PUT', 'DELETE']);

function isWatchedMutation(requestUrl: string, method: string): boolean {
  if (!MUTATION_METHODS.has(method)) return false;
  if (!/\/(rest|storage)\/v1\//.test(requestUrl)) return false;
  // Never observe the error-log writes themselves (would recurse on failure).
  if (requestUrl.includes('/rest/v1/client_error_logs')) return false;
  return true;
}

function endpointOf(requestUrl: string): string {
  try {
    const u = new URL(requestUrl);
    return `${u.pathname}${u.search}`;
  } catch {
    return requestUrl;
  }
}

const watchedFetch: typeof fetch = async (input, init) => {
  const request = input instanceof Request ? input : undefined;
  const requestUrl =
  typeof input === 'string' ?
  input :
  input instanceof URL ?
  input.toString() :
  input.url;
  const method = (init?.method ?? request?.method ?? 'GET').toUpperCase();
  const watched = isWatchedMutation(requestUrl, method);
  let res: Response;
  try {
    res = await fetch(input, init);
  } catch (err) {
    if (watched) {
      reportWriteFailure({
        method,
        endpoint: endpointOf(requestUrl),
        message: err instanceof Error ? err.message : 'Network error'
      });
    }
    throw err;
  }
  if (watched && !res.ok) {
    let errorCode: string | undefined;
    let message: string | undefined;
    try {
      // PostgREST/storage error bodies are small JSON: { code, message, … }.
      const body = await res.clone().json();
      errorCode = body?.code;
      message = body?.message ?? body?.msg ?? body?.error;
    } catch {
      // Non-JSON body — status code alone still tells the story.
    }
    reportWriteFailure({
      method,
      endpoint: endpointOf(requestUrl),
      statusCode: res.status,
      errorCode,
      message
    });
  }
  return res;
};

export const supabase = createClient(url ?? '', anonKey ?? '', {
  global: { fetch: watchedFetch },
  auth: {
    // Opt into the experimental passkey API (auth.signInWithPasskey /
    // auth.registerPasskey / auth.passkey.*). Off by default; calling any
    // passkey method without this flag throws. Requires supabase-js v2.105.0+.
    experimental: { passkey: true }
  }
});

// WebAuthn / passkey availability in this browser. Passkey UI is hidden where
// the platform can't perform the ceremony (no PublicKeyCredential, non-secure
// context). WebAuthn needs a secure context (HTTPS) except on localhost.
export const passkeysSupported =
  typeof window !== 'undefined' &&
  typeof window.PublicKeyCredential !== 'undefined' &&
  window.isSecureContext;
