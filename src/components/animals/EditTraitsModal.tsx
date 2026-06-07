import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { SearchIcon, CheckIcon } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { Input } from '../ui/Forms';
import { Button } from '../ui/Button';
import { useWhisker } from '../../context/WhiskerContext';
import { Animal } from '../../types';
import { animalDisplayName } from '../../lib/utils';
import { cn } from '../../lib/utils';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  animal: Animal;
}

// Assign/remove traits on an animal. Offers only traits valid for the animal
// (active + global or matching its species); selection is diffed on save by
// setAnimalTraits.
export function EditTraitsModal({ isOpen, onClose, animal }: Props) {
  const { traits, animalTraits, setAnimalTraits } = useWhisker();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  // Snapshot of the selection at open time — used only for ordering, so toggling
  // a row doesn't make the list re-sort/jump under the cursor.
  const [initialSelected, setInitialSelected] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState('');

  // Snapshot the animal's current traits each time the modal opens.
  useEffect(() => {
    if (!isOpen) return;
    const current = new Set(
      animalTraits.
      filter((at) => at.animal_id === animal.id).
      map((at) => at.trait_id)
    );
    setSelected(current);
    setInitialSelected(current);
    setQuery('');
    // animalTraits intentionally excluded — snapshot at open only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, animal.id]);

  const available = useMemo(
    () =>
    traits.
    filter(
      (t) => t.active && (!t.species_id || t.species_id === animal.species_id)
    ).
    sort((a, b) => a.name.localeCompare(b.name)),
    [traits, animal.species_id]
  );
  const q = query.trim().toLowerCase();
  const filtered = q ?
  available.filter((t) => t.name.toLowerCase().includes(q)) :
  available;
  // Initially-selected traits float to the top, but the order stays fixed while
  // toggling (we sort by the open-time snapshot, not the live selection).
  const ordered = [...filtered].sort(
    (a, b) => Number(initialSelected.has(b.id)) - Number(initialSelected.has(a.id))
  );

  const toggle = (id: string) =>
  setSelected((prev) => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id);else
    next.add(id);
    return next;
  });

  const save = () => {
    setAnimalTraits(animal.id, [...selected]);
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`${animalDisplayName(animal)} | Edit Traits`}
      footer={
      <div className="flex justify-end gap-3">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={save}>Save</Button>
        </div>
      }>

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

        <ul className="max-h-80 overflow-y-auto space-y-1.5 pr-1">
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
        <Link
          to="/settings"
          onClick={onClose}
          className="block text-xs font-medium text-primary hover:underline">

          Manage traits in Settings
        </Link>
      </div>
    </Modal>);

}
