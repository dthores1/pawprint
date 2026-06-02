import React, { useMemo, useState } from 'react';
import { Modal } from '../ui/Modal';
import { Input, Select, Textarea, Label } from '../ui/Forms';
import { Button } from '../ui/Button';
import { Avatar } from '../ui/Avatar';
import { SpeciesBadge } from '../ui/SpeciesBadge';
import { useWhisker } from '../../context/WhiskerContext';
import { AnimalRelationship, Animal } from '../../types';
import { SearchIcon, XIcon } from 'lucide-react';
import { animalDisplayName, animalShowsRescueIdBadge } from '../../lib/utils';
interface AddRelationshipModalProps {
  isOpen: boolean;
  onClose: () => void;
  animalId: string;
}
const RELATIONSHIP_TYPES: {
  value: AnimalRelationship['relationship_type'];
  label: string;
}[] = [
{
  value: 'mother',
  label: 'Mother'
},
{
  value: 'father',
  label: 'Father'
},
{
  value: 'child',
  label: 'Child'
},
{
  value: 'sibling',
  label: 'Sibling'
},
{
  value: 'bonded_pair',
  label: 'Bonded Pair'
}];

export function AddRelationshipModal({
  isOpen,
  onClose,
  animalId
}: AddRelationshipModalProps) {
  const { animals, relationships, addRelationship } = useWhisker();
  const [search, setSearch] = useState('');
  const [selectedAnimal, setSelectedAnimal] = useState<Animal | null>(null);
  const [type, setType] =
  useState<AnimalRelationship['relationship_type']>('sibling');
  const [notes, setNotes] = useState('');
  // Filter out the current animal and any animals it is already related to
  const availableAnimals = useMemo(() => {
    const relatedIds = new Set(
      relationships.
      filter(
        (r) => r.animal_id === animalId || r.related_animal_id === animalId
      ).
      map((r) =>
      r.animal_id === animalId ? r.related_animal_id : r.animal_id
      )
    );
    const q = search.toLowerCase();
    return animals.filter((a) => {
      if (a.id === animalId || relatedIds.has(a.id)) return false;
      const hay =
      `${a.name ?? ''} ${a.rescue_id ?? ''} ${a.id}`.toLowerCase();
      return hay.includes(q);
    });
  }, [animals, relationships, animalId, search]);
  const reset = () => {
    setSearch('');
    setSelectedAnimal(null);
    setType('sibling');
    setNotes('');
  };
  const handleClose = () => {
    reset();
    onClose();
  };
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAnimal) return;
    addRelationship({
      animal_id: animalId,
      related_animal_id: selectedAnimal.id,
      relationship_type: type,
      notes: notes.trim() || undefined
    });
    handleClose();
  };
  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Add Relationship"
      footer={
      <div className="flex justify-end gap-3">
          <Button type="button" variant="ghost" onClick={handleClose}>
            Cancel
          </Button>
          <Button
          type="submit"
          form="add-relationship-form"
          disabled={!selectedAnimal}>
            Save Relationship
          </Button>
        </div>
      }>

      <form
        id="add-relationship-form"
        onSubmit={handleSubmit}
        className="space-y-5">
        <div>
          <Label required>Related Animal</Label>
          {selectedAnimal ?
          <div className="flex items-center justify-between p-3 rounded-lg border border-primary bg-primary/5">
              <div className="flex items-center gap-3">
                <Avatar
                src={selectedAnimal.primary_photo_url}
                type="animal"
                size="sm" />
              
                <div>
                  <p className="font-medium text-text-primary">
                    {selectedAnimal.name}
                  </p>
                  <p className="text-xs text-text-secondary font-mono">
                    #{selectedAnimal.id}
                  </p>
                </div>
              </div>
              <button
              type="button"
              onClick={() => setSelectedAnimal(null)}
              className="p-1.5 text-text-secondary hover:text-text-primary hover:bg-background rounded-md transition-colors">
              
                <XIcon className="w-4 h-4" />
              </button>
            </div> :

          <div className="space-y-3">
              <div className="relative">
                <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-secondary" />
                <Input
                placeholder="Search by name or ID..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
                autoFocus />
              
              </div>
              <div className="max-h-48 overflow-y-auto border border-border rounded-lg divide-y divide-border">
                {availableAnimals.length === 0 ?
              <div className="p-4 text-center text-sm text-text-secondary">
                    No animals found.
                  </div> :

              availableAnimals.slice(0, 20).map((animal) =>
              <button
                key={animal.id}
                type="button"
                onClick={() => setSelectedAnimal(animal)}
                className="w-full flex items-center gap-3 p-3 hover:bg-background transition-colors text-left">
                
                      <div className="relative shrink-0">
                        <Avatar
                    src={animal.primary_photo_url}
                    type="animal"
                    size="sm" />
                  
                        <div className="absolute -bottom-1 -right-1 ring-2 ring-card rounded-full">
                          <SpeciesBadge species={animal.species} />
                        </div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-text-primary truncate">
                          {animalDisplayName(animal)}
                        </p>
                        {animalShowsRescueIdBadge(animal) ?
                    <p className="text-xs text-text-secondary font-mono">
                            {animal.rescue_id}
                          </p> :
                    animal.rescue_id ?
                    null :

                    <p className="text-xs text-text-secondary font-mono">
                            #{animal.id}
                          </p>
                    }
                      </div>
                    </button>
              )
              }
              </div>
            </div>
          }
        </div>

        <div>
          <Label htmlFor="relationship_type" required>Relationship Type</Label>
          <Select
            id="relationship_type"
            value={type}
            onChange={(e) =>
            setType(e.target.value as AnimalRelationship['relationship_type'])
            }
            disabled={!selectedAnimal}>
            
            {RELATIONSHIP_TYPES.map((t) =>
            <option key={t.value} value={t.value}>
                {t.label}
              </option>
            )}
          </Select>
        </div>

        <div>
          <Label htmlFor="notes">Notes (optional)</Label>
          <Textarea
            id="notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="e.g., Must be adopted together..."
            disabled={!selectedAnimal} />
          
        </div>
      </form>
    </Modal>);

}