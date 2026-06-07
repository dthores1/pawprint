import React, { useMemo, useState } from 'react';
import { SearchIcon, CheckIcon } from 'lucide-react';
import { Input } from '../ui/Forms';
import { useWhisker } from '../../context/WhiskerContext';
import { cn } from '../../lib/utils';

interface Props {
  /** Filter to traits valid for this species (+ global). Undefined = all active. */
  speciesId?: string;
  /** Currently selected trait ids (controlled). */
  selectedIds: string[];
  /**
   * Selection snapshot used only for ordering (selected float to top) — pass the
   * at-open selection so toggling doesn't reorder/jump. Defaults to none.
   */
  initialSelectedIds?: string[];
  onChange: (ids: string[]) => void;
}

// Searchable, large-tap-target multi-select over the org's active traits.
// Shared by the Edit Traits drawer and the Create/Edit Animal trait sections.
export function TraitMultiSelect({
  speciesId,
  selectedIds,
  initialSelectedIds = [],
  onChange
}: Props) {
  const { traits } = useWhisker();
  const [query, setQuery] = useState('');

  const available = useMemo(
    () =>
    traits.
    filter(
      (t) => t.active && (!t.species_id || !speciesId || t.species_id === speciesId)
    ).
    sort((a, b) => a.name.localeCompare(b.name)),
    [traits, speciesId]
  );
  const q = query.trim().toLowerCase();
  const filtered = q ?
  available.filter((t) => t.name.toLowerCase().includes(q)) :
  available;
  const initial = new Set(initialSelectedIds);
  const ordered = [...filtered].sort(
    (a, b) => Number(initial.has(b.id)) - Number(initial.has(a.id))
  );

  const selected = new Set(selectedIds);
  const toggle = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);else
    next.add(id);
    onChange([...next]);
  };

  return (
    <div className="space-y-3">
      <div className="relative">
        <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-secondary pointer-events-none" />
        <Input
          placeholder="Search traits…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="pl-9" />
      </div>
      {ordered.length === 0 ?
      <p className="text-sm text-text-secondary text-center py-6">
          No traits found.
        </p> :

      <ul className="max-h-72 overflow-y-auto space-y-1.5 pr-1">
          {ordered.map((t) => {
          const checked = selected.has(t.id);
          return (
            <li key={t.id}>
                <button
                type="button"
                aria-pressed={checked}
                onClick={() => toggle(t.id)}
                className={cn(
                  'w-full flex items-center justify-between gap-3 px-3 py-2.5 rounded-lg border text-left transition-colors',
                  checked ?
                  'bg-primary/10 border-primary/40' :
                  'bg-card border-border hover:border-primary/40 hover:bg-background'
                )}>

                  <span className="min-w-0">
                    <span className="block text-sm font-medium text-text-primary">
                      {t.name}
                    </span>
                    {t.description &&
                  <span className="block text-xs text-text-secondary">
                        {t.description}
                      </span>
                  }
                  </span>
                  {checked &&
                <CheckIcon className="w-4 h-4 text-primary shrink-0" />}
                </button>
              </li>);

        })}
        </ul>
      }
    </div>);

}
