import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useWhisker } from '../context/WhiskerContext';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Forms';
import { StatusBadge, PriorityBadge } from '../components/ui/Badge';
import { SpeciesBadge } from '../components/ui/SpeciesBadge';
import { Avatar } from '../components/ui/Avatar';
import { FilterDropdown, FilterOption } from '../components/ui/FilterDropdown';
import { AddAnimalModal } from '../components/animals/AddAnimalModal';
import {
  SearchIcon,
  PlusIcon,
  XIcon,
  CatIcon,
  DogIcon,
  PawPrintIcon } from
'lucide-react';
import { calculateAge, formatDate } from '../lib/utils';
import { animalBreedLabel } from '../lib/breedsApi';
import { motion } from 'framer-motion';
import { ENABLED_SPECIES } from '../lib/config';
import { Species, AnimalStatus, Priority } from '../types';
import { PawPrintIcon as PawPrintGlyph } from '../components/ui/PawPrintIcon';
const SPECIES_ICONS = {
  Dog: <DogIcon className="w-3.5 h-3.5 text-[#356A9A]" />,
  Cat: <CatIcon className="w-3.5 h-3.5 text-[#B8632E]" />,
  Other: <PawPrintIcon className="w-3.5 h-3.5 text-text-secondary" />
};
const STATUS_LABELS: Record<AnimalStatus, string> = {
  intake: 'Intake',
  medical: 'Medical',
  hold: 'Hold',
  fostered: 'Fostered',
  adoptable: 'Adoptable',
  adopted: 'Adopted',
  hospice: 'Hospice',
  deceased: 'Deceased'
};
const PRIORITY_LABELS: Record<Priority, string> = {
  normal: 'Normal',
  needs_attention: 'Needs Attention',
  urgent: 'Urgent',
  critical: 'Critical'
};
export function AnimalsList() {
  const {
    animals,
    animalsLoading,
    placements,
    fosters,
    medicalRecords,
    relationships,
    breeds
  } = useWhisker();
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [speciesFilter, setSpeciesFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const getActiveFoster = (animalId: string) => {
    const activePlacement = placements.find(
      (p) => p.animal_id === animalId && p.placement_status === 'active'
    );
    if (!activePlacement) return null;
    return fosters.find((f) => f.id === activePlacement.foster_parent_id);
  };
  const getNextMedical = (animalId: string) => {
    const upcoming = medicalRecords.
    filter(
      (m) =>
      m.animal_id === animalId && (
      m.status === 'due' || m.status === 'scheduled') &&
      m.due_date
    ).
    sort(
      (a, b) =>
      new Date(a.due_date!).getTime() - new Date(b.due_date!).getTime()
    );
    return upcoming[0];
  };
  const isBondedPair = (animalId: string) =>
  relationships.some(
    (r) =>
    r.relationship_type === 'bonded_pair' && (
    r.animal_id === animalId || r.related_animal_id === animalId)
  );
  const filteredAnimals = animals.filter((animal) => {
    const matchesSearch =
    animal.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    animal.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
    animal.microchip_number && animal.microchip_number.includes(searchQuery);
    const matchesStatus =
    statusFilter === 'all' || animal.status === statusFilter;
    const matchesSpecies =
    speciesFilter === 'all' || animal.species === speciesFilter;
    const matchesPriority =
    priorityFilter === 'all' || animal.priority === priorityFilter;
    return matchesSearch && matchesStatus && matchesSpecies && matchesPriority;
  });
  // Filter option lists
  const statusOptions: FilterOption[] = useMemo(
    () => [
    {
      value: 'all',
      label: 'All'
    },
    ...(Object.keys(STATUS_LABELS) as AnimalStatus[]).map((s) => ({
      value: s,
      label: STATUS_LABELS[s]
    }))],

    []
  );
  const priorityOptions: FilterOption[] = useMemo(
    () => [
    {
      value: 'all',
      label: 'All'
    },
    ...(Object.keys(PRIORITY_LABELS) as Priority[]).map((p) => ({
      value: p,
      label: PRIORITY_LABELS[p]
    }))],

    []
  );
  const speciesOptions: FilterOption[] = useMemo(
    () => [
    {
      value: 'all',
      label: 'All'
    },
    ...ENABLED_SPECIES.map((s) => ({
      value: s,
      label: `${s}s`,
      icon: SPECIES_ICONS[s]
    }))],

    []
  );
  // Active filter chips
  const activeChips = [
  statusFilter !== 'all' && {
    key: 'status',
    label: STATUS_LABELS[statusFilter as AnimalStatus],
    clear: () => setStatusFilter('all')
  },
  priorityFilter !== 'all' && {
    key: 'priority',
    label: PRIORITY_LABELS[priorityFilter as Priority],
    clear: () => setPriorityFilter('all')
  },
  speciesFilter !== 'all' && {
    key: 'species',
    label: `${speciesFilter}s`,
    icon: SPECIES_ICONS[speciesFilter as Species],
    clear: () => setSpeciesFilter('all')
  }].
  filter(Boolean) as Array<{
    key: string;
    label: string;
    icon?: React.ReactNode;
    clear: () => void;
  }>;
  const clearAll = () => {
    setStatusFilter('all');
    setPriorityFilter('all');
    setSpeciesFilter('all');
  };
  const showSpeciesFilter = ENABLED_SPECIES.length > 1;
  return (
    <div className="space-y-5 pb-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-heading font-bold text-text-primary">
            Animals
          </h1>
          <p className="text-text-secondary">
            Manage all animals in the rescue's care.
          </p>
        </div>
        <Button onClick={() => setIsAddModalOpen(true)} className="gap-2">
          <PlusIcon className="w-4 h-4" />
          Add Animal
        </Button>
      </div>

      {/* Search — dominant, full width */}
      <div className="relative">
        <SearchIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-text-secondary pointer-events-none" />
        <Input
          placeholder="Search by name, ID, or microchip…"
          className="pl-11 h-12 text-base"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)} />
        
        {searchQuery &&
        <button
          type="button"
          onClick={() => setSearchQuery('')}
          className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 rounded-md text-text-secondary hover:text-text-primary hover:bg-background transition-colors"
          aria-label="Clear search">
          
            <XIcon className="w-4 h-4" />
          </button>
        }
      </div>

      {/* Compact filter row */}
      <div className="flex flex-wrap items-center gap-2">
        <FilterDropdown
          label="Status"
          value={statusFilter}
          options={statusOptions}
          onChange={setStatusFilter} />
        
        <FilterDropdown
          label="Priority"
          value={priorityFilter}
          options={priorityOptions}
          onChange={setPriorityFilter} />
        
        {showSpeciesFilter &&
        <FilterDropdown
          label="Species"
          value={speciesFilter}
          options={speciesOptions}
          onChange={setSpeciesFilter} />

        }
      </div>

      {/* Active filter chips */}
      {activeChips.length > 0 &&
      <motion.div
        initial={{
          opacity: 0,
          y: -4
        }}
        animate={{
          opacity: 1,
          y: 0
        }}
        className="flex flex-wrap items-center gap-2">
        
          {activeChips.map((chip) =>
        <span
          key={chip.key}
          className="inline-flex items-center gap-1.5 pl-2.5 pr-1 h-7 rounded-full bg-primary/10 text-primary text-xs font-medium border border-primary/20">
          
              {chip.icon}
              {chip.label}
              <button
            type="button"
            onClick={chip.clear}
            className="p-0.5 rounded-full hover:bg-primary/20 transition-colors"
            aria-label={`Remove ${chip.label} filter`}>
            
                <XIcon className="w-3 h-3" />
              </button>
            </span>
        )}
          <button
          type="button"
          onClick={clearAll}
          className="text-xs font-medium text-text-secondary hover:text-text-primary transition-colors px-2 h-7 rounded-full hover:bg-background">
          
            Clear all
          </button>
          <span className="text-xs text-text-secondary ml-auto">
            {filteredAnimals.length} of {animals.length} animals
          </span>
        </motion.div>
      }

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-border bg-background/60 text-sm font-medium text-text-secondary">
                <th className="py-4 px-6 font-medium">Animal</th>
                <th className="py-4 px-6 font-medium">Status</th>
                <th className="py-4 px-6 font-medium">Priority</th>
                <th className="py-4 px-6 font-medium">Age & Sex</th>
                <th className="py-4 px-6 font-medium">Current Foster</th>
                <th className="py-4 px-6 font-medium">Next Medical</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {animalsLoading && animals.length === 0 ?
              <tr>
                  <td
                  colSpan={6}
                  className="py-12 text-center text-text-secondary">

                    <div className="flex flex-col items-center gap-3">
                      <PawPrintGlyph className="w-10 h-10 text-text-secondary/30 animate-pulse" />
                      <p>Loading animals…</p>
                    </div>
                  </td>
                </tr> :
              filteredAnimals.length === 0 ?
              <tr>
                  <td
                  colSpan={6}
                  className="py-12 text-center text-text-secondary">

                    <div className="flex flex-col items-center gap-3">
                      <PawPrintGlyph className="w-10 h-10 text-text-secondary/30" />
                      <p>No animals found matching your filters.</p>
                    </div>
                  </td>
                </tr> :

              filteredAnimals.map((animal, index) => {
                const foster = getActiveFoster(animal.id);
                const nextMedical = getNextMedical(animal.id);
                const bonded = isBondedPair(animal.id);
                return (
                  <motion.tr
                    key={animal.id}
                    initial={{
                      opacity: 0,
                      y: 10
                    }}
                    animate={{
                      opacity: 1,
                      y: 0
                    }}
                    transition={{
                      delay: index * 0.04
                    }}
                    className="hover:bg-background/60 transition-colors group">
                    
                      <td className="py-4 px-6">
                        <div className="flex items-center gap-4">
                          <Link
                          to={`/animals/${animal.id}`}
                          className="relative shrink-0">
                          
                            <Avatar
                            src={animal.primary_photo_url}
                            type="animal"
                            species={animal.species} />
                          
                            <div className="absolute -bottom-1 -right-1 ring-2 ring-card rounded-full">
                              <SpeciesBadge species={animal.species} />
                            </div>
                          </Link>
                          <div>
                            <Link
                            to={`/animals/${animal.id}`}
                            className="font-medium text-text-primary group-hover:text-primary transition-colors block">
                            
                              {animal.name}
                            </Link>
                            {bonded &&
                          <span
                            className="inline-flex items-center gap-1.5 mt-0.5 text-[12.5px] font-medium text-[#6B5B8C]"
                            title="This animal is part of a bonded pair">
                            
                                <svg
                              xmlns="http://www.w3.org/2000/svg"
                              viewBox="0 0 24 24"
                              className="w-3.5 h-3.5"
                              fill="currentColor"
                              aria-hidden="true">
                              
                                  <path d="m20.726,18.629c.283.486.39,1.062.3,1.623l-.197,1.225c-.235,1.462-1.48,2.524-2.962,2.524h-4.867c-.552,0-1-.448-1-1s.448-1,1-1h4.867c.494,0,.909-.354.987-.841l.197-1.224c.017-.106-.002-.209-.054-.3-1.015-1.745-1.069-2.172-1.095-2.377-.14-1.106-.662-1.792-1.747-2.295-.059-.027-1.905-.963-2.604-.963-.798,0-1.256.22-1.261.222-3.025,1.781-5.918,4.108-6.257,8.849-.038.527-.477.929-.997.929-.024,0-.048,0-.072-.002-.551-.04-.966-.518-.926-1.069.409-5.711,4.11-8.589,7.29-10.458.061-.033.292-.152.673-.262v-.209c0-1.256.772-2.495,1.867-2.942.543-.222,1.133.221,1.133.807v2.405c.726.237,1.996.878,1.996.878,1.693.784,2.666,2.083,2.891,3.858h0s.107.364.839,1.622Zm.774-12.629h-.227c-.829,0-1.609-.365-2.14-1.002l-.229-.275c-.912-1.094-2.251-1.722-3.676-1.722h-1.227V.865c0-.586-.59-1.029-1.133-.807-1.095.447-1.867,1.686-1.867,2.942v.706l-2.57,3.998c-.924,1.438-2.497,2.296-4.206,2.296H1c-.552,0-1,.448-1,1s.448,1,1,1h3.224c2.393,0,4.595-1.202,5.889-3.215l2.433-3.785h2.681c.829,0,1.609.365,2.14,1.002l.229.275c.912,1.094,2.251,1.722,3.676,1.722h.227c.276,0,.5.224.5.5v.5c0,1.068-.575,2.064-1.5,2.599-.478.276-.642.888-.365,1.366.186.321.521.5.867.5.17,0,.342-.043.5-.134,1.542-.892,2.5-2.551,2.5-4.331v-.5c0-1.378-1.122-2.5-2.5-2.5Z" />
                                </svg>
                                Bonded Pair
                              </span>
                          }
                            <p className="text-xs text-text-secondary mt-0.5">
                              {animalBreedLabel(animal, breeds) || animal.species}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="py-4 px-6">
                        <StatusBadge status={animal.status} />
                      </td>
                      <td className="py-4 px-6">
                        <PriorityBadge priority={animal.priority} />
                      </td>
                      <td className="py-4 px-6">
                        <p className="text-sm text-text-primary">
                          {calculateAge(animal.estimated_birth_date)}
                        </p>
                        <p className="text-sm text-text-secondary">
                          {animal.sex}
                        </p>
                      </td>
                      <td className="py-4 px-6">
                        {foster ?
                      <Link
                        to={`/fosters/${foster.id}`}
                        className="text-sm text-primary hover:underline">
                        
                            {foster.first_name} {foster.last_name}
                          </Link> :

                      <span className="text-sm text-text-secondary">—</span>
                      }
                      </td>
                      <td className="py-4 px-6">
                        {nextMedical ?
                      <div>
                            <p className="text-sm text-text-primary">
                              {nextMedical.procedure_name}
                            </p>
                            <p className="text-sm text-text-secondary">
                              {formatDate(nextMedical.due_date!)}
                            </p>
                          </div> :

                      <span className="text-sm text-text-secondary">
                            Up to date
                          </span>
                      }
                      </td>
                    </motion.tr>);

              })
              }
            </tbody>
          </table>
        </div>
      </Card>

      <AddAnimalModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)} />
      
    </div>);

}