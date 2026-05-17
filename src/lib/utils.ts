export function cn(...classes: (string | undefined | null | false)[]) {
  return classes.filter(Boolean).join(' ');
}

export function calculateAge(birthDate: string): string {
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
    if (remainingMonths === 0) return `${years} year${years > 1 ? 's' : ''}`;
    return `${years} yr ${remainingMonths} mo`;
  }
}

export function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('en-US', {
    month: 'short',
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