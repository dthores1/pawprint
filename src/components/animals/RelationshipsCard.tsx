import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useWhisker } from '../../context/WhiskerContext';
import { Card } from '../ui/Card';
import { Avatar } from '../ui/Avatar';
import { SpeciesBadge } from '../ui/SpeciesBadge';
import { HeartIcon, PlusIcon, XIcon } from 'lucide-react';
import { BoneIcon } from '../ui/BoneIcon';
import { Animal } from '../../types';
import { calculateAge, animalDisplayName } from '../../lib/utils';
import { AddRelationshipModal } from './AddRelationshipModal';
import { ArchiveConfirmDialog } from '../archive/ArchiveConfirmDialog';
import { useCanArchive } from '../archive/useCanArchive';
interface RelationshipsCardProps {
  animalId: string;
}
// Each rendered relationship preserves the underlying record id so the user
// can remove a single accidental link without affecting the rest of the group.
interface RelEntry {
  relationshipId: string;
  animal: Animal;
  /** Derived links (e.g. littermates from a shared litter_id) aren't removable. */
  derived?: boolean;
}
interface GroupedRelationships {
  mother: RelEntry | null;
  father: RelEntry | null;
  parents: RelEntry[];
  children: RelEntry[];
  littermates: RelEntry[];
  siblings: RelEntry[];
  bondedWith: RelEntry[];
}
export function RelationshipsCard({ animalId }: RelationshipsCardProps) {
  const { relationships, animals } = useWhisker();
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [archiving, setArchiving] = useState<
    {id: string;label: string;animalName: string;} | null>(
    null);
  // Admin gate is the same for every chip; the row id is just a sentinel.
  const canArchive = useCanArchive('animal_relationships', { id: 'na' });
  const grouped = computeRelationships(animalId, relationships, animals);
  const isEmpty =
  !grouped.mother &&
  !grouped.father &&
  grouped.parents.length === 0 &&
  grouped.children.length === 0 &&
  grouped.littermates.length === 0 &&
  grouped.siblings.length === 0 &&
  grouped.bondedWith.length === 0;
  const handleDelete = (entry: RelEntry, label: string) => {
    setArchiving({
      id: entry.relationshipId,
      label: label.toLowerCase(),
      animalName: animalDisplayName(entry.animal)
    });
  };
  return (
    <>
      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-heading font-bold flex items-center gap-2">
            <BoneIcon className="w-5 h-5 text-primary" />
            Relationships
          </h3>
          <button
            onClick={() => setIsAddModalOpen(true)}
            className="p-1.5 text-text-secondary hover:text-primary hover:bg-primary/10 rounded-md transition-colors"
            aria-label="Add relationship">
            
            <PlusIcon className="w-4 h-4" />
          </button>
        </div>

        {isEmpty ?
        <div className="text-center py-4">
            <p className="text-sm text-text-secondary mb-3">
              No relationships added yet.
            </p>
            <button
            onClick={() => setIsAddModalOpen(true)}
            className="text-sm font-medium text-primary hover:underline">
            
              Link to another animal
            </button>
          </div> :

        <div className="space-y-4">
            {grouped.mother &&
          <RelationshipRow
            label="Mother"
            entries={[grouped.mother]}
            onDelete={canArchive ? handleDelete : undefined} />

          }
            {grouped.father &&
          <RelationshipRow
            label="Father"
            entries={[grouped.father]}
            onDelete={canArchive ? handleDelete : undefined} />

          }
            {grouped.parents.length > 0 &&
          <RelationshipRow
            label="Parent"
            entries={grouped.parents}
            onDelete={canArchive ? handleDelete : undefined} />

          }
            {grouped.children.length > 0 &&
          <RelationshipRow
            label={grouped.children.length === 1 ? 'Child' : 'Children'}
            entries={grouped.children}
            onDelete={canArchive ? handleDelete : undefined} />

          }
            {grouped.littermates.length > 0 &&
          <RelationshipRow
            label={
            grouped.littermates.length === 1 ?
            'Littermate' :
            'Littermates'
            }
            entries={grouped.littermates}
            onDelete={canArchive ? handleDelete : undefined} />

          }
            {grouped.siblings.length > 0 &&
          <RelationshipRow
            label={grouped.siblings.length === 1 ? 'Sibling' : 'Siblings'}
            entries={grouped.siblings}
            onDelete={canArchive ? handleDelete : undefined} />

          }
            {grouped.bondedWith.length > 0 &&
          <RelationshipRow
            label="Bonded With"
            entries={grouped.bondedWith}
            onDelete={canArchive ? handleDelete : undefined}
            highlight />

          }
          </div>
        }
      </Card>

      <AddRelationshipModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        animalId={animalId} />

      {archiving &&
      <ArchiveConfirmDialog
        isOpen={true}
        onClose={() => setArchiving(null)}
        table="animal_relationships"
        id={archiving.id}
        typeLabel="relationship"
        entityLabel={`${archiving.label} link to ${archiving.animalName}`} />

      }
    </>);

}
function RelationshipRow({
  label,
  entries,
  onDelete,
  highlight
}: {
  label: string;
  entries: RelEntry[];
  onDelete?: (entry: RelEntry, label: string) => void;
  highlight?: boolean;
}) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wider text-text-secondary mb-2 flex items-center gap-1.5">
        {highlight && <HeartIcon className="w-3 h-3 text-[#9B3A3A]" />}
        {label}
      </p>
      <div className="space-y-2">
        {entries.map((entry) =>
        <div
          key={entry.relationshipId}
          className="group flex items-center gap-3 p-2 -mx-2 rounded-lg hover:bg-background transition-colors">

            <Link
            to={`/animals/${entry.animal.id}`}
            className="flex items-center gap-3 flex-1 min-w-0">

              <div className="relative shrink-0">
                <Avatar
                src={entry.animal.primary_photo_url}
                type="animal"
                size="sm" />

                <div className="absolute -bottom-1 -right-1 ring-2 ring-card rounded-full">
                  <SpeciesBadge species={entry.animal.species} />
                </div>
              </div>
              <div className="min-w-0">
                <p className="font-medium text-text-primary hover:text-primary transition-colors truncate">
                  {animalDisplayName(entry.animal)}
                </p>
                <p className="text-xs text-text-secondary truncate">
                  {entry.animal.sex} • {calculateAge(entry.animal.estimated_birth_date)}
                </p>
              </div>
            </Link>
            {!entry.derived && onDelete &&
          <button
            type="button"
            onClick={() => onDelete(entry, label)}
            aria-label={`Archive ${label.toLowerCase()} link to ${animalDisplayName(entry.animal)}`}
            title="Archive relationship"
            className="shrink-0 p-1.5 rounded-md text-text-secondary opacity-0 group-hover:opacity-100 focus:opacity-100 hover:text-[#9B3A3A] hover:bg-[#F5D7D7]/60 transition-opacity transition-colors">

              <XIcon className="w-3.5 h-3.5" />
            </button>
          }
          </div>
        )}
      </div>
    </div>);

}
// — Helper: derive bidirectional relationships for a given animal —
function computeRelationships(
animalId: string,
relationships: ReturnType<typeof useWhisker>['relationships'],
animals: Animal[])
: GroupedRelationships {
  const result: GroupedRelationships = {
    mother: null,
    father: null,
    parents: [],
    children: [],
    littermates: [],
    siblings: [],
    bondedWith: []
  };
  const find = (id: string) => animals.find((a) => a.id === id) || null;
  for (const r of relationships) {
    if (r.animal_id === animalId) {
      // This animal is the subject. r.relationship_type describes its role toward related_animal_id.
      const other = find(r.related_animal_id);
      if (!other) continue;
      const entry: RelEntry = { relationshipId: r.id, animal: other };
      switch (r.relationship_type) {
        case 'mother':
        case 'father':
          // I am the parent → other is my child
          result.children.push(entry);
          break;
        case 'child':
          // I am a child → other is a parent
          result.parents.push(entry);
          break;
        case 'sibling':
          result.siblings.push(entry);
          break;
        case 'bonded_pair':
          result.bondedWith.push(entry);
          break;
      }
    } else if (r.related_animal_id === animalId) {
      // This animal is the related party. Invert the relationship.
      const other = find(r.animal_id);
      if (!other) continue;
      const entry: RelEntry = { relationshipId: r.id, animal: other };
      switch (r.relationship_type) {
        case 'mother':
          result.mother = entry;
          break;
        case 'father':
          result.father = entry;
          break;
        case 'child':
          // other is my child → I'm the parent
          result.children.push(entry);
          break;
        case 'sibling':
          result.siblings.push(entry);
          break;
        case 'bonded_pair':
          result.bondedWith.push(entry);
          break;
      }
    }
  }
  // Littermates are derived from a shared litter_id, not stored as relationship
  // rows. These links are read-only (no delete button).
  const self = find(animalId);
  if (self?.litter_id) {
    for (const other of animals) {
      if (other.id === animalId || other.litter_id !== self.litter_id) continue;
      result.littermates.push({
        relationshipId: `litter-${other.id}`,
        animal: other,
        derived: true
      });
    }
  }
  return result;
}