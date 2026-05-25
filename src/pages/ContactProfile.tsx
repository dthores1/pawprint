import React, { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useWhisker } from '../context/WhiskerContext';
import { Card } from '../components/ui/Card';
import { Avatar } from '../components/ui/Avatar';
import { Button } from '../components/ui/Button';
import { SpeciesBadge } from '../components/ui/SpeciesBadge';
import { StatusBadge } from '../components/ui/Badge';
import { EditContactModal } from '../components/contacts/EditContactModal';
import {
  ArrowLeftIcon,
  MapPinIcon,
  PhoneIcon,
  MailIcon,
  BuildingIcon,
  HomeIcon,
  HeartIcon,
  Edit2Icon,
  CheckCircle2Icon } from
'lucide-react';
import { PersonRole } from '../types';

const humanizeRole = (r: PersonRole) => r.replace(/_/g, ' ');

export function ContactProfile() {
  const { id } = useParams<{ id: string }>();
  const { people, animals, placements } = useWhisker();
  const [isEditOpen, setIsEditOpen] = useState(false);

  const person = people.find((p) => p.id === id);
  if (!person) {
    return <div className="p-8 text-center">Contact not found.</div>;
  }

  const isFoster = person.roles.includes('foster_parent');
  const adoptedAnimals = animals.filter((a) => a.adopted_by_id === person.id);
  const activePlacements = placements.filter(
    (p) => p.person_id === person.id && p.placement_status === 'active'
  );
  const cap = person.max_capacity ?? 0;

  return (
    <div className="space-y-6 pb-12">
      <div className="flex items-center justify-between gap-3">
        <Link
          to="/contacts"
          className="inline-flex items-center gap-2 text-sm text-text-secondary hover:text-text-primary transition-colors">

          <ArrowLeftIcon className="w-4 h-4" /> Back to Contacts
        </Link>
        <Button variant="soft" size="sm" onClick={() => setIsEditOpen(true)}>
          <Edit2Icon className="w-4 h-4 mr-2" /> Edit
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Profile Info */}
        <div className="space-y-6">
          <Card className="p-6">
            <div className="flex flex-col items-center text-center mb-6">
              <Avatar
                src={person.photo_url}
                name={`${person.first_name} ${person.last_name}`}
                colorKey={person.id}
                type="person"
                size="xl"
                className="mb-4" />

              <h1 className="text-2xl font-heading font-bold text-text-primary">
                {person.first_name} {person.last_name}
              </h1>
              {person.organization_name &&
              <p className="text-sm text-text-secondary mt-1 flex items-center gap-1">
                  <BuildingIcon className="w-3.5 h-3.5" />
                  {person.organization_name}
                </p>
              }
              <div className="flex gap-2 mt-2">
                {person.active ?
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-[#DDEFE2] text-[#3E7B52]">
                    <CheckCircle2Icon className="w-3.5 h-3.5" /> Active
                  </span> :

                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-background text-text-secondary border border-border">
                    Inactive
                  </span>
                }
              </div>
            </div>

            <div className="space-y-4 pt-6 border-t border-border">
              {person.address &&
              <div className="flex items-start gap-3">
                  <MapPinIcon className="w-5 h-5 text-text-secondary shrink-0 mt-0.5" />
                  <span className="text-text-primary">{person.address}</span>
                </div>
              }
              {person.phone &&
              <div className="flex items-center gap-3">
                  <PhoneIcon className="w-5 h-5 text-text-secondary shrink-0" />
                  <a
                  href={`tel:${person.phone}`}
                  className="text-primary hover:underline">

                    {person.phone}
                  </a>
                </div>
              }
              <div className="flex items-center gap-3">
                <MailIcon className="w-5 h-5 text-text-secondary shrink-0" />
                <a
                  href={`mailto:${person.email}`}
                  className="text-primary hover:underline break-all">

                  {person.email}
                </a>
              </div>
            </div>
          </Card>

          <Card className="p-6">
            <h3 className="text-lg font-heading font-bold mb-4">Roles</h3>
            <div className="flex flex-wrap gap-2">
              {person.roles.length === 0 ?
              <span className="text-sm text-text-secondary">
                  No roles assigned.
                </span> :

              person.roles.map((r) =>
              <span
                key={r}
                className="text-sm px-3 py-1 bg-background border border-border text-text-secondary rounded-lg font-medium capitalize">

                    {humanizeRole(r)}
                  </span>
              )
              }
            </div>
            {person.notes &&
            <div className="mt-4 pt-4 border-t border-border">
                <p className="text-sm text-text-secondary mb-1">Notes</p>
                <p className="text-text-primary text-sm leading-relaxed">
                  {person.notes}
                </p>
              </div>
            }
          </Card>
        </div>

        {/* Right Column: Linked activity */}
        <div className="lg:col-span-2 space-y-6">
          {isFoster &&
          <Card className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-heading font-bold flex items-center gap-2">
                  <HomeIcon className="w-5 h-5 text-primary" />
                  Foster
                </h2>
                <Link
                to={`/fosters/${person.id}`}
                className="text-sm font-medium text-primary hover:underline">

                  View foster profile →
                </Link>
              </div>
              <div className="flex flex-wrap items-center gap-x-8 gap-y-2 text-sm">
                <div>
                  <span className="text-text-secondary">Capacity: </span>
                  <span className="font-medium text-text-primary">
                    {activePlacements.length} / {cap}
                  </span>
                </div>
                {(person.preferred_species ?? []).length > 0 &&
                <div className="flex items-center gap-1.5">
                    <span className="text-text-secondary">Prefers:</span>
                    {(person.preferred_species ?? []).map((s) =>
                  <span
                    key={s}
                    className="text-xs px-2 py-0.5 bg-accent text-secondary rounded-md font-medium">

                        {s}
                      </span>
                  )}
                  </div>
                }
              </div>
            </Card>
          }

          <Card className="p-6">
            <h2 className="text-xl font-heading font-bold flex items-center gap-2 mb-4">
              <HeartIcon className="w-5 h-5 text-[#D98C5F]" />
              Adopted Animals
            </h2>
            {adoptedAnimals.length === 0 ?
            <p className="text-sm text-text-secondary">
                No adopted animals recorded.
              </p> :

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {adoptedAnimals.map((animal) =>
              <Link
                key={animal.id}
                to={`/animals/${animal.id}`}
                className="flex items-center gap-3 p-3 rounded-xl border border-border hover:bg-background transition-colors group">

                    <div className="relative shrink-0">
                      <Avatar
                    src={animal.primary_photo_url}
                    type="animal"
                    species={animal.species} />

                      <div className="absolute -bottom-1 -right-1 ring-2 ring-card rounded-full">
                        <SpeciesBadge species={animal.species} />
                      </div>
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium text-text-primary group-hover:text-primary transition-colors truncate">
                        {animal.name}
                      </p>
                      <StatusBadge status={animal.status} className="mt-1" />
                    </div>
                  </Link>
              )}
              </div>
            }
          </Card>
        </div>
      </div>

      <EditContactModal
        isOpen={isEditOpen}
        onClose={() => setIsEditOpen(false)}
        person={person} />

    </div>);

}
