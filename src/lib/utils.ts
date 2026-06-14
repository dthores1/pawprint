export function cn(...classes: (string | undefined | null | false)[]) {
  return classes.filter(Boolean).join(' ');
}

// Animal label resolution. Animals must have a name OR a rescue_id (DB CHECK);
// many will have both. UI surfaces show the name when present and surface the
// rescue_id as a smaller supporting badge when both exist. Rescue-id-only
// animals show the id in the primary slot.
export function animalDisplayName(a: {
  name?: string;
  rescue_id?: string;
}): string {
  const name = a.name?.trim();
  if (name) return name;
  const rid = a.rescue_id?.trim();
  if (rid) return rid;
  return 'Unnamed';
}

/**
 * Whether to render the Rescue ID as a supporting badge next to the primary
 * heading. True only when both a name and a rescue_id are present (rescue-id-
 * only animals show the id in the primary slot, not as a separate badge).
 */
export function animalShowsRescueIdBadge(a: {
  name?: string;
  rescue_id?: string;
}): boolean {
  return Boolean(a.name?.trim() && a.rescue_id?.trim());
}

export function calculateAge(birthDate: string): string {
  if (!birthDate) {
    return 'Unknown';
  }
  
  const birth = new Date(birthDate);
  const now = new Date();

  let months = (now.getFullYear() - birth.getFullYear()) * 12;
  months -= birth.getMonth();
  months += now.getMonth();

  if (months < 1) {
    const diffTime = Math.abs(now.getTime() - birth.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return `${diffDays} days`;
  } else if (months < 12) {
    return `${months} month${months > 1 ? 's' : ''}`;
  } else {
    const years = Math.floor(months / 12);
    const remainingMonths = months % 12;

    // For senior animals (10+ years), months are noise — show years only.
    if (years >= 10) return `${years} years`;
    if (remainingMonths === 0) return `${years} year${years > 1 ? 's' : ''}`;
    return `${years} yr ${remainingMonths} mo`;
  }
}

export function formatDate(dateString: string): string {
  // Date-only strings (yyyy-MM-dd) must parse as LOCAL midnight — otherwise
  // `new Date('2026-06-24')` is UTC midnight and renders as the previous day in
  // negative-offset timezones. Full ISO timestamps parse as-is.
  const d = /^\d{4}-\d{2}-\d{2}$/.test(dateString) ?
  new Date(`${dateString}T00:00:00`) :
  new Date(dateString);
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });
}

/** Like formatDate but with the full month name, e.g. "June 11, 2026". */
export function formatDateLong(dateString: string): string {
  const d = /^\d{4}-\d{2}-\d{2}$/.test(dateString) ?
  new Date(`${dateString}T00:00:00`) :
  new Date(dateString);
  return d.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric'
  });
}

export function getDaysUntil(dateString: string): number {
  const target = new Date(dateString);
  const now = new Date();
  target.setHours(0, 0, 0, 0);
  now.setHours(0, 0, 0, 0);
  const diffTime = target.getTime() - now.getTime();
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

export function generateId(): string {
  return Math.random().toString(36).substring(2, 9);
}

/**
 * Turns a snake_case enum value into a human label, e.g.
 * `foster_update` → `Foster Update`, `general` → `General`.
 */
export function humanizeSnakeCase(value: string): string {
  return value.
  split('_').
  filter(Boolean).
  map((word) => word.charAt(0).toUpperCase() + word.slice(1)).
  join(' ');
}

/**
 * Returns the greeting prefix appropriate for the given local time.
 * Boundaries (inclusive):
 *  - 5:01am – 11:00am → "Good morning"
 *  - 12:01pm – 5:00pm → "Good afternoon"
 *  - 7:01pm – 1:00am  → "Good evening"
 *  - Anything else    → "Welcome back"
 */
export function getGreeting(date: Date = new Date()): string {
  const minutes = date.getHours() * 60 + date.getMinutes();
  // 5:01am (301) – 11:00am (660)
  if (minutes >= 301 && minutes <= 660) return 'Good morning';
  // 12:01pm (721) – 5:00pm (1020)
  if (minutes >= 721 && minutes <= 1020) return 'Good afternoon';
  // 7:01pm (1141) – midnight, then 0:00 – 1:00am (60)
  if (minutes >= 1141 || minutes <= 60) return 'Good evening';
  return 'Welcome back';
}