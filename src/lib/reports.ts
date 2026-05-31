// Reporting helpers: date-range presets + a few aggregation utilities used by
// ReportsPage. All client-side off the data already loaded in WhiskerContext —
// for now this is fine; if rollups get expensive at scale, swap any of these
// for a Supabase view or RPC.

export type RangePreset = 'month' | 'year' | 'custom';

export interface DateRange {
  start: Date;
  end: Date;
}

export function startOfMonth(d = new Date()): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1, 0, 0, 0, 0);
}
export function endOfMonth(d = new Date()): Date {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999);
}
export function startOfYear(d = new Date()): Date {
  return new Date(d.getFullYear(), 0, 1, 0, 0, 0, 0);
}
export function endOfYear(d = new Date()): Date {
  return new Date(d.getFullYear(), 11, 31, 23, 59, 59, 999);
}

export function thisMonthRange(): DateRange {
  return { start: startOfMonth(), end: endOfMonth() };
}
export function thisYearRange(): DateRange {
  return { start: startOfYear(), end: endOfYear() };
}

/** Parse a YYYY-MM-DD string into a local Date at 00:00 (no UTC drift). */
export function parseYMD(s: string): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}
export function formatYMD(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function inRange(value: string | undefined, r: DateRange): boolean {
  if (!value) return false;
  const t = new Date(value).getTime();
  return t >= r.start.getTime() && t <= r.end.getTime();
}

/**
 * Last N months as { key: 'YYYY-MM', label: 'Mon YYYY', start, end }, oldest
 * first. Used for the intake / adoption trend chart.
 */
export function lastNMonths(n: number, ref = new Date()): {
  key: string;
  label: string;
  start: Date;
  end: Date;
}[] {
  const out: {
    key: string;
    label: string;
    start: Date;
    end: Date;
  }[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(ref.getFullYear(), ref.getMonth() - i, 1);
    const start = startOfMonth(d);
    const end = endOfMonth(d);
    out.push({
      key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
      label: d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
      start,
      end
    });
  }
  return out;
}

/**
 * Whole-month buckets inside `range` (oldest first). Used by spend-by-month so
 * the trend line shows exactly the months covered by the selected range — a
 * range of "this month" yields one bucket; a year yields twelve.
 */
export function monthBucketsBetween(range: DateRange): {
  key: string;
  label: string;
  start: Date;
  end: Date;
}[] {
  const out: {
    key: string;
    label: string;
    start: Date;
    end: Date;
  }[] = [];
  let cursor = startOfMonth(range.start);
  const limit = startOfMonth(range.end);
  while (cursor.getTime() <= limit.getTime()) {
    out.push({
      key: `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}`,
      label: cursor.toLocaleDateString('en-US', {
        month: 'short',
        year: 'numeric'
      }),
      start: startOfMonth(cursor),
      end: endOfMonth(cursor)
    });
    cursor = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1);
  }
  return out;
}

/** Mean days between two ISO timestamps across a list — null if empty. */
export function meanDaysBetween(
pairs: { start: string; end: string }[])
: number | null {
  if (pairs.length === 0) return null;
  const total = pairs.reduce((sum, p) => {
    const days =
    (new Date(p.end).getTime() - new Date(p.start).getTime()) /
    (1000 * 60 * 60 * 24);
    return sum + days;
  }, 0);
  return total / pairs.length;
}
