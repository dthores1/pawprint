import { useEffect, useState } from 'react';

// True on small (phone) viewports. Matches Tailwind's default `md` breakpoint
// (768px) so JS layout branches stay in sync with `md:` utility classes — a
// component can render a card list below `md` and a table at `md` and up.
const MOBILE_QUERY = '(max-width: 767px)';

export function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = useState<boolean>(() =>
  typeof window !== 'undefined' ?
  window.matchMedia(MOBILE_QUERY).matches :
  false
  );

  useEffect(() => {
    const mql = window.matchMedia(MOBILE_QUERY);
    const onChange = () => setIsMobile(mql.matches);
    onChange();
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, []);

  return isMobile;
}
