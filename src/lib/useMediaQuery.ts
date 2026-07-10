import { useEffect, useState } from 'react';

// Generic matchMedia hook. Pair queries with Tailwind's default breakpoints
// (md 768px, xl 1280px) so JS layout branches stay in sync with utility
// classes — see useIsMobile for the phone-sized convenience wrapper.
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState<boolean>(() =>
  typeof window !== 'undefined' ?
  window.matchMedia(query).matches :
  false
  );

  useEffect(() => {
    const mql = window.matchMedia(query);
    const onChange = () => setMatches(mql.matches);
    onChange();
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, [query]);

  return matches;
}
