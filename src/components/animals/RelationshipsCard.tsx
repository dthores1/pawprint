import React, { useState, Children } from 'react';
import { Link } from 'react-router-dom';
import { useWhisker } from '../../context/WhiskerContext';
import { Card } from '../ui/Card';
import { Avatar } from '../ui/Avatar';
import { SpeciesBadge } from '../ui/SpeciesBadge';
import { HeartIcon, PlusIcon } from 'lucide-react';
import { BoneIcon } from '../ui/BoneIcon';
import { Animal } from '../../types';
import { AddRelationshipModal } from './AddRelationshipModal';
interface RelationshipsCardProps {
  animalId: string;
}
interface GroupedRelationships {
  mother: Animal | null;
  father: Animal | null;
  parents: Animal[];
  children: Animal[];
  littermates: Animal[];
  siblings: Animal[];
  bondedWith: Animal[];
}
export function RelationshipsCard({ animalId }: RelationshipsCardProps) {
  const { relationships, animals } = useWhisker();
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const grouped = computeRelationships(animalId, relationships, animals);
  const isEmpty =
  !grouped.mother &&
  !grouped.father &&
  grouped.parents.length === 0 &&
  grouped.children.length === 0 &&
  grouped.littermates.length === 0 &&
  grouped.siblings.length === 0 &&
  grouped.bondedWith.length === 0;
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
          <RelationshipRow label="Mother" animals={[grouped.mother]} />
          }
            {grouped.father &&
          <RelationshipRow label="Father" animals={[grouped.father]} />
          }
            {grouped.parents.length > 0 &&
          <RelationshipRow label="Parent" animals={grouped.parents} />
          }
            {grouped.children.length > 0 &&
          <RelationshipRow
            label={grouped.children.length === 1 ? 'Child' : 'Children'}
            animals={grouped.children} />

          }
            {grouped.littermates.length > 0 &&
          <RelationshipRow
            label={
            grouped.littermates.length === 1 ?
            'Littermate' :
            'Littermates'
            }
            animals={grouped.littermates} />

          }
            {grouped.siblings.length > 0 &&
          <RelationshipRow
            label={grouped.siblings.length === 1 ? 'Sibling' : 'Siblings'}
            animals={grouped.siblings} />

          }
            {grouped.bondedWith.length > 0 &&
          <RelationshipRow
            label="Bonded With"
            animals={grouped.bondedWith}
            highlight />

          }
          </div>
        }
      </Card>

      <AddRelationshipModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        animalId={animalId} />
      
    </>);

}
function RelationshipRow({
  label,
  animals,
  highlight




}: {label: string;animals: Animal[];highlight?: boolean;}) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wider text-text-secondary mb-2 flex items-center gap-1.5">
        {highlight && <HeartIcon className="w-3 h-3 text-[#9B3A3A]" />}
        {label}
      </p>
      <div className="space-y-2">
        {animals.map((animal) =>
        <Link
          key={animal.id}
          to={`/animals/${animal.id}`}
          className="flex items-center gap-3 p-2 -mx-2 rounded-lg hover:bg-background transition-colors group">
          
            <div className="relative shrink-0">
              <Avatar src={animal.primary_photo_url} type="animal" size="sm" />
              <div className="absolute -bottom-1 -right-1 ring-2 ring-card rounded-full">
                <SpeciesBadge species={animal.species} />
              </div>
            </div>
            <div className="min-w-0">
              <p className="font-medium text-text-primary group-hover:text-primary transition-colors truncate">
                {animal.name}
              </p>
              <p className="text-xs text-text-secondary font-mono">
                #{animal.id}
              </p>
            </div>
          </Link>
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
      switch (r.relationship_type) {
        case 'mother':
        case 'father':
          // I am the parent → other is my child
          result.children.push(other);
          break;
        case 'child':
          // I am a child → other is a parent
          result.parents.push(other);
          break;
        case 'sibling':
          result.siblings.push(other);
          break;
        case 'littermate':
          result.littermates.push(other);
          break;
        case 'bonded_pair':
          result.bondedWith.push(other);
          break;
      }
    } else if (r.related_animal_id === animalId) {
      // This animal is the related party. Invert the relationship.
      const other = find(r.animal_id);
      if (!other) continue;
      switch (r.relationship_type) {
        case 'mother':
          result.mother = other;
          break;
        case 'father':
          result.father = other;
          break;
        case 'child':
          // other is my child → I'm the parent
          result.children.push(other);
          break;
        case 'sibling':
          result.siblings.push(other);
          break;
        case 'littermate':
          result.littermates.push(other);
          break;
        case 'bonded_pair':
          result.bondedWith.push(other);
          break;
      }
    }
  }
  return result;
}