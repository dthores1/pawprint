import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { SearchIcon, XIcon, MapPinnedIcon } from 'lucide-react';
import { Input } from './Forms';
import { CalendarPopover } from './CalendarPopover';
import { Site } from '../../types';
import { SITE_STATUS_META } from '../../lib/siteStatus';
import { cn } from '../../lib/utils';
import { useTypeaheadKeyboard } from '../../lib/useTypeaheadKeyboard';

// Single-select typeahead for picking a Rescue Site. Same UX shape as the other
// relational pickers (see CLAUDE.md "Relational pickers" convention).
interface Props {
  sites: Site[];
  /** Selected site id, or empty string for none. */
  value: string;
  onChange: (id: string) => void;
  placeholder?: string;
  id?: string;
}

export function SiteSearchPicker({
  sites,
  value,
  onChange,
  placeholder = 'Search rescue sites by name…',
  id
}: Props) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [menuWidth, setMenuWidth] = useState<number>();
  const wrapperRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const selected = sites.find((s) => s.id === value) || null;

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    return sites.
    filter((s) => {
      if (!q) return true;
      return `${s.name} ${s.address?.formatted ?? ''}`.toLowerCase().includes(q);
    }).
    slice(0, 12);
  }, [sites, query]);

  const { activeIndex, setActiveIndex, onKeyDown } = useTypeaheadKeyboard({
    open,
    setOpen,
    count: results.length,
    onChoose: (i) => {
      onChange(results[i].id);
      setOpen(false);
      setQuery('');
    },
    menuRef
  });

  useLayoutEffect(() => {
    if (open) setMenuWidth(wrapperRef.current?.offsetWidth);
  }, [open]);

  if (selected) {
    const meta = SITE_STATUS_META[selected.status];
    return (
      <div className="flex items-center justify-between gap-3 px-3 py-2 rounded-lg border border-primary/30 bg-primary/5">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
            <MapPinnedIcon className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <p className="font-medium text-text-primary truncate">
              {selected.name}
            </p>
            <span
              className={cn(
                'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium mt-0.5',
                meta.tone
              )}>
              {meta.label}
            </span>
          </div>
        </div>
        <button
          type="button"
          onClick={() => {
            onChange('');
            setQuery('');
          }}
          className="p-1.5 rounded-md text-text-secondary hover:bg-background hover:text-text-primary transition-colors shrink-0"
          aria-label="Clear selected site">
          <XIcon className="w-4 h-4" />
        </button>
      </div>);

  }

  return (
    <div className="relative" ref={wrapperRef}>
      <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-secondary pointer-events-none" />
      <Input
        id={id}
        type="text"
        autoComplete="off"
        placeholder={placeholder}
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={onKeyDown}
        className="pl-9" />

      <CalendarPopover
        anchorRef={wrapperRef}
        open={open}
        onClose={() => setOpen(false)}
        padded={false}>

        <div
          ref={menuRef}
          style={{ width: menuWidth }}
          className="max-h-72 overflow-y-auto">
          {results.length === 0 ?
          <div className="p-4 text-sm text-text-secondary text-center">
              {query ? <>No sites match "{query}".</> : 'No sites available.'}
            </div> :

          <ul className="py-1">
              {results.map((s, i) => {
              const meta = SITE_STATUS_META[s.status];
              return (
                <li key={s.id}>
                    <button
                    type="button"
                    data-ta-index={i}
                    onMouseEnter={() => setActiveIndex(i)}
                    onClick={() => {
                      onChange(s.id);
                      setOpen(false);
                      setQuery('');
                    }}
                    className={cn(
                      'w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-background cursor-pointer transition-colors',
                      activeIndex === i && 'bg-background'
                    )}>
                      <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                        <MapPinnedIcon className="w-4 h-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-text-primary truncate text-sm">
                          {s.name}
                        </p>
                        {s.address?.formatted &&
                      <p className="text-xs text-text-secondary truncate">
                            {s.address.formatted}
                          </p>
                      }
                      </div>
                      <span
                      className={cn(
                        'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium shrink-0',
                        meta.tone
                      )}>
                        {meta.label}
                      </span>
                    </button>
                  </li>);

            })}
            </ul>
          }
        </div>
      </CalendarPopover>
    </div>);

}
