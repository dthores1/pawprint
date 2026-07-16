import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { SearchIcon, XIcon, UserPlusIcon } from 'lucide-react';
import { Input } from './Forms';
import { Avatar } from './Avatar';
import { CalendarPopover } from './CalendarPopover';
import { Person, PersonRole } from '../../types';
import { cn } from '../../lib/utils';
import { useTypeaheadKeyboard } from '../../lib/useTypeaheadKeyboard';

// Support accounts (e.g. support@whiskerville.app) are added to an org's people
// only so Whiskerville support can access it — they aren't real org contacts, so
// they should never be offered in a contact picker. They're identified by the
// vendor email domain, which no genuine rescue contact would use. Exported for
// pickers that roll their own result lists (e.g. PlaceAnimalModal).
export function isSupportContact(p: Person): boolean {
  return (p.email ?? '').toLowerCase().endsWith('@whiskerville.app');
}

// Single-select typeahead for picking a Person. Optionally filter to a role
// (e.g. vets only for the clinic form). Mirrors AnimalSearchPicker.
interface Props {
  people: Person[];
  value: string;
  onChange: (id: string) => void;
  placeholder?: string;
  /** Restrict candidates to one role. Omit for everyone. */
  role?: PersonRole;
  /** Hide these ids from results. */
  excludeIds?: string[];
  id?: string;
  /**
   * When supplied, a "+ New Contact" action shows at the bottom of the dropdown
   * (Salesforce-style). The caller is responsible for opening a create flow and
   * setting `value` to the new person's id once created.
   */
  onCreateNew?: () => void;
}
export function PersonSearchPicker({
  people,
  value,
  onChange,
  placeholder = 'Search people by name or email…',
  role,
  excludeIds = [],
  id,
  onCreateNew
}: Props) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [menuWidth, setMenuWidth] = useState<number>();
  const wrapperRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const selected = people.find((p) => p.id === value) || null;

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    const excluded = new Set(excludeIds);
    return people.
    filter((p) => !excluded.has(p.id)).
    filter((p) => !isSupportContact(p)).
    filter((p) => (role ? p.roles.includes(role) : true)).
    filter((p) => p.active).
    filter((p) => {
      if (!q) return true;
      const hay =
      `${p.first_name} ${p.last_name} ${p.email} ${p.organization_name ?? ''}`.toLowerCase();
      return hay.includes(q);
    }).
    slice(0, 12);
  }, [people, query, role, excludeIds]);

  // The "New Contact" action is the last navigable row when present.
  const { activeIndex, setActiveIndex, onKeyDown } = useTypeaheadKeyboard({
    open,
    setOpen,
    count: results.length + (onCreateNew ? 1 : 0),
    onChoose: (i) => {
      if (i < results.length) {
        onChange(results[i].id);
        setOpen(false);
        setQuery('');
      } else if (onCreateNew) {
        setOpen(false);
        setQuery('');
        onCreateNew();
      }
    },
    menuRef
  });

  // Match the dropdown width to the input each time it opens.
  useLayoutEffect(() => {
    if (open) setMenuWidth(wrapperRef.current?.offsetWidth);
  }, [open]);

  if (selected) {
    return (
      <div className="flex items-center justify-between gap-3 px-3 py-1.5 rounded-lg border border-primary/30 bg-primary/5">
        <div className="flex items-center gap-3 min-w-0">
          <Avatar
            src={selected.photo_url}
            name={`${selected.first_name} ${selected.last_name}`}
            colorKey={selected.id}
            size="sm" />

          <div className="min-w-0">
            <p className="font-medium text-text-primary truncate">
              {selected.first_name} {selected.last_name}
            </p>
            {selected.organization_name &&
            <p className="text-xs text-text-secondary truncate">
                {selected.organization_name}
              </p>
            }
          </div>
        </div>
        <button
          type="button"
          onClick={() => {
            onChange('');
            setQuery('');
          }}
          className="p-1.5 rounded-md text-text-secondary hover:bg-background hover:text-text-primary transition-colors shrink-0"
          aria-label="Clear selection">

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
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
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
              {query ?
            <>No matches for "{query}".</> :
            'No people available.'}
            </div> :

          <ul className="py-1">
              {results.map((p, i) =>
            <li key={p.id}>
                  <button
                type="button"
                data-ta-index={i}
                onMouseEnter={() => setActiveIndex(i)}
                onClick={() => {
                  onChange(p.id);
                  setOpen(false);
                  setQuery('');
                }}
                className={cn(
                  'w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-background cursor-pointer transition-colors',
                  activeIndex === i && 'bg-background'
                )}>

                    <Avatar
                  src={p.photo_url}
                  name={`${p.first_name} ${p.last_name}`}
                  colorKey={p.id}
                  size="sm" />

                    <div className="min-w-0">
                      <p className="font-medium text-text-primary truncate text-sm">
                        {p.first_name} {p.last_name}
                      </p>
                      <p className="text-xs text-text-secondary truncate">
                        {p.organization_name || p.email}
                      </p>
                    </div>
                  </button>
                </li>
            )}
            </ul>
          }
          {onCreateNew &&
          <div className="border-t border-border">
              <button
              type="button"
              data-ta-index={results.length}
              onMouseEnter={() => setActiveIndex(results.length)}
              onClick={() => {
                setOpen(false);
                setQuery('');
                onCreateNew();
              }}
              className={cn(
                'w-full flex items-center gap-2 px-3 py-2.5 text-left text-sm font-medium text-primary hover:bg-primary/5 cursor-pointer transition-colors',
                activeIndex === results.length && 'bg-primary/5'
              )}>

                <UserPlusIcon className="w-4 h-4 shrink-0" />
                New Contact{query.trim() ? ` "${query.trim()}"` : ''}
              </button>
            </div>
          }
        </div>
      </CalendarPopover>
    </div>);

}
