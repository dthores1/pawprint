import { SittingRequest } from '../types';

// Mirrors transportTiming's stale model, adapted for sitting. A sitting request
// covers a date RANGE, so it's only "past due" once the coverage window is over
// (end_date has passed) — anchoring to the start would wrongly flag a sit that's
// currently in progress. Two distinct problems, named by whether a sitter exists:
//   * past_due       — never claimed; nothing to review, just old.
//   * awaiting_review — a sitter claimed it, so coverage may have happened but
//                       was never marked complete.
export type SittingStaleKind = 'past_due' | 'awaiting_review';

export interface SittingStaleInfo {
  kind: SittingStaleKind;
  /** Whole calendar days since the coverage window ended (≥ 1). */
  days: number;
}

export const SITTING_STALE_LABEL: Record<SittingStaleKind, string> = {
  past_due: 'Past Due',
  awaiting_review: 'Awaiting Review'
};

// Parse 'yyyy-MM-dd' (or ISO) at LOCAL midnight so date-only values don't shift.
function parseLocalDate(s: string): Date {
  return new Date(`${s.slice(0, 10)}T00:00:00`);
}
function startOfDayMs(ms: number): number {
  const d = new Date(ms);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

export function sittingStaleInfo(
s: SittingRequest,
now: number = Date.now())
: SittingStaleInfo | null {
  if (s.status === 'completed' || s.status === 'cancelled') return null;
  const endStr = s.end_date || s.start_date;
  if (!endStr) return null;
  const days = Math.floor(
    (startOfDayMs(now) - startOfDayMs(parseLocalDate(endStr).getTime())) /
    86400000
  );
  if (days < 1) return null; // window not over yet (ends today or later)
  return {
    kind: s.sitter_person_id ? 'awaiting_review' : 'past_due',
    days
  };
}

export function sittingStaleTooltip(s: SittingStaleInfo): string {
  const ago = `${s.days} ${s.days === 1 ? 'day' : 'days'} ago`;
  if (s.kind === 'past_due') {
    return (
      `This sitting request's coverage period ended ${ago} and was never claimed. ` +
      `Mark it complete if it was covered another way, update the dates, ` +
      `or cancel it if it’s no longer needed.`);

  }
  return (
    `This sitting coverage ended ${ago} and hasn’t been marked complete. ` +
    `If it was covered, mark it complete; otherwise follow up or cancel the request.`);

}
