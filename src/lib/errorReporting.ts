import { supabase } from './supabase';

/**
 * Central handling for failed Supabase writes.
 *
 * Failures are detected in ONE place — the shared client's fetch wrapper
 * (src/lib/supabase.ts) watches every REST/storage mutation — so the ~180
 * per-action `console.error` sites in WhiskerContext didn't need touching and
 * future actions are covered automatically. Each failure:
 *
 *   1. Shows the global "Something went wrong" toast (WriteErrorToastHost).
 *   2. Silently inserts a row into `client_error_logs` (migration 0098) so we
 *      learn about errors even when users don't report them. Fire-and-forget:
 *      logging must never throw, block, or recurse (the fetch wrapper skips
 *      the log table itself).
 *
 * 409 Conflict is ignored entirely — no toast, no log. Those are uniqueness
 * guards working as designed (duplicate product name, duplicate relationship,
 * …) and the flows explain them in place; logging expected behavior would
 * flood the table. If a 409 ever signals a real race, it shows up as
 * user-visible misbehavior and arrives via bug reports instead.
 *
 * This module is imported by supabase.ts, and imports supabase back — the
 * cycle is safe because each side only dereferences the other at call time,
 * never during module evaluation.
 */

export interface WriteFailure {
  method: string;
  /** Request path + query — table/filters only, request bodies are never logged. */
  endpoint: string;
  statusCode?: number;
  errorCode?: string;
  message?: string;
}

// Who to attribute log rows to — stamped by AuthContext as session/org change.
let currentUserId: string | null = null;
let currentOrgId: string | null = null;
export function setErrorReportingContext(ctx: {
  userId?: string | null;
  orgId?: string | null;
}): void {
  if ('userId' in ctx) currentUserId = ctx.userId ?? null;
  if ('orgId' in ctx) currentOrgId = ctx.orgId ?? null;
}

// --- Toast bus (module-level so non-React code can emit) -------------------

type WriteErrorListener = () => void;
const listeners = new Set<WriteErrorListener>();

/** Subscribe the toast host; returns an unsubscribe cleanup. */
export function subscribeToWriteErrors(fn: WriteErrorListener): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

// A burst of failures (e.g. a multi-row action) should read as ONE problem —
// don't stack toasts, just keep the current one up.
const TOAST_THROTTLE_MS = 5_000;
let lastToastAt = 0;

// --- Silent logging ---------------------------------------------------------

// Cap the log rate so a stuck retry loop can't flood the table.
const LOG_BURST_WINDOW_MS = 60_000;
const LOG_BURST_LIMIT = 10;
let logTimestamps: number[] = [];

function logSilently(failure: WriteFailure): void {
  const now = Date.now();
  logTimestamps = logTimestamps.filter((t) => now - t < LOG_BURST_WINDOW_MS);
  if (logTimestamps.length >= LOG_BURST_LIMIT) return;
  logTimestamps.push(now);
  void supabase.
  from('client_error_logs').
  insert({
    organization_id: currentOrgId,
    user_id: currentUserId,
    method: failure.method,
    endpoint: failure.endpoint.slice(0, 500),
    status_code: failure.statusCode ?? null,
    error_code: failure.errorCode ?? null,
    message: failure.message?.slice(0, 2000) ?? null,
    context: { route: window.location.pathname },
    user_agent: navigator.userAgent
  }).
  then(({ error }) => {
    // Swallow — an unreachable/misconfigured log table must never cascade.
    if (error) console.warn('[errorlog] could not persist:', error.message);
  });
}

/**
 * Called by the supabase fetch wrapper for every failed mutation. Never
 * throws.
 */
export function reportWriteFailure(failure: WriteFailure): void {
  try {
    // Expected behavior, not an error — see the module comment.
    if (failure.statusCode === 409) return;
    const now = Date.now();
    if (now - lastToastAt > TOAST_THROTTLE_MS) {
      lastToastAt = now;
      listeners.forEach((fn) => fn());
    }
    logSilently(failure);
  } catch {
    // Reporting must never break the request path it observes.
  }
}
