import React, { useEffect, useState } from 'react';
import { Modal } from '../ui/Modal';
import { Input, Textarea, Select, Label, FieldError } from '../ui/Forms';
import { Button } from '../ui/Button';
import { useWhisker } from '../../context/WhiskerContext';
import { Trait } from '../../types';
import { cn } from '../../lib/utils';
import { focusFirstError } from '../../lib/focusFirstError';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  /** Provided → edit mode; omitted → create. */
  trait?: Trait;
}
export function TraitFormModal({ isOpen, onClose, trait }: Props) {
  const { species, addTrait, updateTrait } = useWhisker();
  const isEdit = !!trait;
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [speciesId, setSpeciesId] = useState(''); // '' = all species
  const [active, setActive] = useState(true);
  const [error, setError] = useState<string>();

  useEffect(() => {
    if (!isOpen) return;
    setName(trait?.name ?? '');
    setDescription(trait?.description ?? '');
    setSpeciesId(trait?.species_id ?? '');
    setActive(trait?.active ?? true);
    setError(undefined);
  }, [isOpen, trait]);

  const save = () => {
    const n = name.trim();
    if (!n) {
      setError('Name is required.');
      requestAnimationFrame(() => focusFirstError(['trait_name']));
      return;
    }
    const payload = {
      name: n,
      description: description.trim() || undefined,
      species_id: speciesId || undefined,
      active
    };
    if (isEdit && trait) updateTrait(trait.id, payload);else
    addTrait(payload);
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEdit ? 'Edit Trait' : 'New Trait'}
      footer={
      <div className="flex justify-end gap-3">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={save}>{isEdit ? 'Save' : 'Create'}</Button>
        </div>
      }>

      <div className="space-y-4">
        <div>
          <Label htmlFor="trait_name" required>Name</Label>
          <Input
            id="trait_name"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              if (error) setError(undefined);
            }}
            placeholder="e.g. Dog Friendly"
            className={error ? 'border-red-500 focus:ring-red-500' : undefined} />
          <FieldError>{error}</FieldError>
        </div>
        <div>
          <Label htmlFor="trait_desc">Description</Label>
          <Textarea
            id="trait_desc"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Optional — what this trait means" />
        </div>
        <div>
          <Label htmlFor="trait_species">Applies to Species</Label>
          <Select
            id="trait_species"
            value={speciesId}
            onChange={(e) => setSpeciesId(e.target.value)}>
            <option value="">All species</option>
            {species.map((s) =>
            <option key={s.id} value={s.id}>{s.name}</option>
            )}
          </Select>
        </div>
        {isEdit &&
        <div className="flex items-center justify-between">
            <Label className="mb-0">Active</Label>
            <button
            type="button"
            role="switch"
            aria-checked={active}
            aria-label="Active"
            onClick={() => setActive((a) => !a)}
            className={cn(
              'relative inline-flex h-6 w-11 items-center rounded-full transition-colors',
              active ? 'bg-primary' : 'bg-border'
            )}>
              <span
              className={cn(
                'inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform',
                active ? 'translate-x-6' : 'translate-x-1'
              )} />
            </button>
          </div>
        }
      </div>
    </Modal>);

}
