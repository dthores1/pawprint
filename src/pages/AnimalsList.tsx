import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useWhisker } from '../context/WhiskerContext';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Forms';
import { StatusBadge } from '../components/ui/Badge';
import { SpeciesBadge } from '../components/ui/SpeciesBadge';
import { Avatar } from '../components/ui/Avatar';
import { FilterOption } from '../components/ui/FilterDropdown';
import { MultiFilterDropdown } from '../components/ui/MultiFilterDropdown';
import {
  SortableHeader,
  SortState,
  nextSort,
  sortItems } from
'../components/ui/SortableHeader';
import { AddAnimalModal } from '../components/animals/AddAnimalModal';
import { LittersView } from '../components/animals/LittersView';
import {
  SearchIcon,
  PlusIcon,
  XIcon,
  StarIcon } from
'lucide-react';
import {
  calculateAge,
  formatDate,
  animalDisplayName,
  animalShowsRescueIdBadge } from
'../lib/utils';
import { animalBreedLabel } from '../lib/breedsApi';
import { SpeciesIcon } from '../lib/speciesIcons';
import { enabledSpeciesList } from '../lib/orgCatalog';
import { isActiveAdoption } from '../lib/adoptions';
import { motion } from 'framer-motion';
import { useWindowRowVirtualizer } from '../lib/useWindowRowVirtualizer';
import { Animal, Person, AnimalStatus } from '../types';
import { PawPrintIcon as PawPrintGlyph } from '../components/ui/PawPrintIcon';
import { STATUS_LABELS, IN_CARE_STATUSES } from '../lib/animalStatus';
// Stable string[] view of the in-care statuses for membership checks (module
// scope so it doesn't re-create each render and churn the filter memo).
const IN_CARE_SET: string[] = IN_CARE_STATUSES;
// "Fostered" stays a quick toggle pill (derived from an active placement).
const FLAG_FILTERS = [{ key: 'fostered', label: 'Fostered' }];
// On Hold / Behavior / Medical are consolidated into one "Special Conditions"
// dropdown (match ALL selected).
const SPECIAL_CONDITIONS: FilterOption[] = [
{ value: 'on_hold', label: 'On Hold' },
{ value: 'behavior', label: 'Behavior Concern' },
{ value: 'medical', label: 'Medical Concern' }];
// Age groups computed from estimated_birth_date (match ANY — groups are
// mutually exclusive per animal).
const AGE_GROUPS: FilterOption[] = [
{ value: 'baby', label: 'Baby (< 1 year)' },
{ value: 'adult', label: 'Adult (1–7 years)' },
{ value: 'senior', label: 'Senior (7+ years)' }];
function ageGroupOf(
ebd: string | undefined)
: 'baby' | 'adult' | 'senior' | undefined {
  if (!ebd) return undefined;
  const t = new Date(ebd).getTime();
  if (Number.isNaN(t)) return undefined;
  const years = (Date.now() - t) / (365.25 * 24 * 60 * 60 * 1000);
  if (years < 1) return 'baby';
  if (years < 7) return 'adult';
  return 'senior';
}
// Lifecycle ordering used when sorting the status column.
const STATUS_ORDER = Object.keys(STATUS_LABELS) as AnimalStatus[];
export function AnimalsList() {
  const {
    animals,
    animalsLoading,
    ensureHistoricalLoaded,
    historicalLoaded,
    placements,
    fosters,
    medicalRecords,
    relationships,
    breeds,
    species: speciesCatalog,
    organizationSpecies,
    traits,
    animalTraits,
    adoptions
  } = useWhisker();
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [view, setView] = useState<'animals' | 'litters'>('animals');
  const [searchParams] = useSearchParams();
  // Initialize filters from the URL (e.g. /animals?status=intake,medical),
  // keeping only values that match a known option.
  const parseParam = (key: string, allowed: readonly string[]) =>
  (searchParams.get(key) ?? '').
  split(',').
  map((s) => s.trim()).
  filter((v) => allowed.includes(v));
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string[]>(() =>
  parseParam('status', STATUS_ORDER)
  );
  // Default to no species filter (show all) so any catalog species is visible.
  const [speciesFilter, setSpeciesFilter] = useState<string[]>(() =>
  parseParam('species', [])
  );
  const [flagFilters, setFlagFilters] = useState<string[]>(() =>
  parseParam('flags', FLAG_FILTERS.map((f) => f.key))
  );
  const [specialConditions, setSpecialConditions] = useState<string[]>([]);
  const [ageGroups, setAgeGroups] = useState<string[]>([]);
  // Trait filter — match ALL selected traits (launch behavior).
  const [traitFilter, setTraitFilter] = useState<string[]>([]);
  // animal_id → set of its trait ids, for fast filter lookups.
  const traitIdsByAnimal = useMemo(() => {
    const m = new Map<string, Set<string>>();
    for (const at of animalTraits) {
      const set = m.get(at.animal_id) ?? new Set<string>();
      set.add(at.trait_id);
      m.set(at.animal_id, set);
    }
    return m;
  }, [animalTraits]);
  // "Show Historical Animals" — off by default, so the list shows only
  // animals currently in the rescue's care (intake/medical/adoptable/hospice).
  // Turning it on pulls the historical full rows into the shared collection.
  // Deep links that pre-select a historical status auto-enable it.
  const [includeHistorical, setIncludeHistorical] = useState<boolean>(() =>
  parseParam('status', STATUS_ORDER).some((s) => !IN_CARE_SET.includes(s))
  );
  // Load historical rows whenever they're wanted — covers both the toggle and a
  // deep link that starts with `includeHistorical` true. Idempotent in context.
  useEffect(() => {
    if (includeHistorical && !historicalLoaded) ensureHistoricalLoaded();
  }, [includeHistorical, historicalLoaded, ensureHistoricalLoaded]);
  const historicalLoading = includeHistorical && !historicalLoaded;
  const toggleHistorical = (next: boolean) => {
    setIncludeHistorical(next);
    // Drop any historical status selections so the chips/filter stay coherent.
    if (!next) {
      setStatusFilter((cur) => cur.filter((s) => IN_CARE_SET.includes(s)));
    }
  };
  const toggleFlag = (key: string) =>
  setFlagFilters((cur) =>
  cur.includes(key) ? cur.filter((v) => v !== key) : [...cur, key]
  );
  const [sort, setSort] = useState<SortState | null>(null);
  const onSort = (key: string) => setSort((cur) => nextSort(cur, key));

  // Animals with an active (non-terminal) adoption — drives the "Pending
  // Adoption" pill under the status badge.
  const pendingAdoptionAnimalIds = useMemo(() => {
    const ids = new Set<string>();
    for (const a of adoptions) {
      if (isActiveAdoption(a)) ids.add(a.animal_id);
    }
    return ids;
  }, [adoptions]);

  // Precomputed lookups so per-row reads and sorting stay O(1) at scale.
  const fosterByAnimal = useMemo(() => {
    const activePersonByAnimal = new Map<string, string>();
    for (const p of placements) {
      if (p.placement_status === 'active') {
        activePersonByAnimal.set(p.animal_id, p.person_id);
      }
    }
    const fosterById = new Map(fosters.map((f) => [f.id, f]));
    const m = new Map<string, Person | null>();
    for (const a of animals) {
      const pid = activePersonByAnimal.get(a.id);
      m.set(a.id, pid ? fosterById.get(pid) ?? null : null);
    }
    return m;
  }, [animals, placements, fosters]);
  const nextMedicalByAnimal = useMemo(() => {
    const byAnimal = new Map<string, typeof medicalRecords>();
    for (const rec of medicalRecords) {
      if ((rec.status === 'due' || rec.status === 'scheduled') && rec.due_date) {
        const arr = byAnimal.get(rec.animal_id) ?? [];
        arr.push(rec);
        byAnimal.set(rec.animal_id, arr);
      }
    }
    const m = new Map<string, (typeof medicalRecords)[number]>();
    for (const [aid, arr] of byAnimal) {
      arr.sort(
        (a, b) =>
        new Date(a.due_date!).getTime() - new Date(b.due_date!).getTime()
      );
      m.set(aid, arr[0]);
    }
    return m;
  }, [medicalRecords]);
  const getActiveFoster = (animalId: string) =>
  fosterByAnimal.get(animalId) ?? null;
  const getNextMedical = (animalId: string) => nextMedicalByAnimal.get(animalId);
  const isBondedPair = (animalId: string) =>
  relationships.some(
    (r) =>
    r.relationship_type === 'bonded_pair' && (
    r.animal_id === animalId || r.related_animal_id === animalId)
  );
  // Every filter EXCEPT species. Split out so the species pool (used to decide
  // whether to even show the Species filter) reflects all other active filters.
  const matchesAllButSpecies = useCallback(
    (animal: Animal) => {
      const q = searchQuery.toLowerCase();
      const matchesSearch =
      (animal.name ?? '').toLowerCase().includes(q) ||
      (animal.rescue_id ?? '').toLowerCase().includes(q) ||
      animal.id.toLowerCase().includes(q) ||
      !!animal.microchip_number && animal.microchip_number.includes(searchQuery);
      // Default view is in-care only. `animals` may also hold historical rows
      // (loaded by the toggle, or merged when a historical profile was opened),
      // so gate explicitly rather than relying on the collection's contents.
      const matchesInCare =
      includeHistorical || IN_CARE_SET.includes(animal.status);
      const matchesStatus =
      statusFilter.length === 0 || statusFilter.includes(animal.status);
      const matchesFostered =
      !flagFilters.includes('fostered') ||
      fosterByAnimal.get(animal.id) != null;
      // Special conditions — match ALL selected.
      const matchesConditions = specialConditions.every((c) => {
        switch (c) {
          case 'on_hold':
            return !!animal.is_on_hold;
          case 'behavior':
            return !!animal.has_behavior_concern;
          case 'medical':
            return !!animal.has_medical_concern;
          default:
            return true;
        }
      });
      // Age group — match ANY selected (groups are mutually exclusive).
      const matchesAge =
      ageGroups.length === 0 ||
      ageGroups.includes(ageGroupOf(animal.estimated_birth_date) ?? '');
      // Match ALL selected traits.
      const animalTraitSet = traitIdsByAnimal.get(animal.id);
      const matchesTraits =
      traitFilter.length === 0 ||
      traitFilter.every((tid) => animalTraitSet?.has(tid));
      return (
        matchesSearch &&
        matchesInCare &&
        matchesStatus &&
        matchesFostered &&
        matchesConditions &&
        matchesAge &&
        matchesTraits);

    },
    [
    searchQuery,
    includeHistorical,
    statusFilter,
    flagFilters,
    specialConditions,
    ageGroups,
    traitFilter,
    traitIdsByAnimal,
    fosterByAnimal]
  );
  const speciesPool = useMemo(
    () => animals.filter(matchesAllButSpecies),
    [animals, matchesAllButSpecies]
  );
  const filteredAnimals = useMemo(
    () =>
    speciesPool.filter(
      (a) => speciesFilter.length === 0 || speciesFilter.includes(a.species)
    ),
    [speciesPool, speciesFilter]
  );
  // Distinct species present in the (non-species-filtered) result set.
  const distinctSpeciesInPool = useMemo(
    () => new Set(speciesPool.map((a) => a.species)).size,
    [speciesPool]
  );

  const sortedAnimals = useMemo(() => {
    if (!sort) return filteredAnimals;
    const getValue = (a: Animal): string | number | null => {
      switch (sort.key) {
        case 'name':
          return animalDisplayName(a).toLowerCase();
        case 'status':
          return STATUS_ORDER.indexOf(a.status);
        case 'age':
          return a.estimated_birth_date ?
          Date.now() - new Date(a.estimated_birth_date).getTime() :
          null;
        case 'foster': {
          const f = fosterByAnimal.get(a.id);
          return f ? `${f.first_name} ${f.last_name}`.toLowerCase() : null;
        }
        case 'medical': {
          const m = nextMedicalByAnimal.get(a.id);
          return m?.due_date ? new Date(m.due_date).getTime() : null;
        }
        default:
          return null;
      }
    };
    return sortItems(filteredAnimals, getValue, sort.dir);
  }, [filteredAnimals, sort, fosterByAnimal, nextMedicalByAnimal]);

  // Virtualized table rows in a self-scrolling container. ~73px per row.
  const tableRows = useWindowRowVirtualizer(sortedAnimals.length, 73);
  // Filter option lists. Status options follow the historical toggle: in-care
  // statuses only by default, all 7 once historical animals are included.
  const statusOptions: FilterOption[] = useMemo(
    () =>
    (includeHistorical ?
    (Object.keys(STATUS_LABELS) as AnimalStatus[]) :
    (IN_CARE_STATUSES as AnimalStatus[])).map((s) => ({
      value: s,
      label: STATUS_LABELS[s]
    })),
    [includeHistorical]
  );
  const enabledSpecies = useMemo(
    () => enabledSpeciesList(speciesCatalog, organizationSpecies),
    [speciesCatalog, organizationSpecies]
  );
  const speciesOptions: FilterOption[] = useMemo(
    () =>
    enabledSpecies.map((s) => ({
      value: s.name,
      label: s.name,
      icon: (
        <SpeciesIcon
          iconName={s.icon_name}
          className="w-3.5 h-3.5 text-text-secondary" />)

    })),
    [enabledSpecies]
  );
  const traitOptions: FilterOption[] = useMemo(
    () =>
    traits.
    filter((t) => t.active).
    sort((a, b) => a.name.localeCompare(b.name)).
    map((t) => ({ value: t.id, label: t.name })),
    [traits]
  );
  // Active filter chips — one per selected value across all filters.
  const activeChips = [
  ...statusFilter.map((s) => ({
    key: `status-${s}`,
    label: STATUS_LABELS[s as AnimalStatus],
    clear: () => setStatusFilter((cur) => cur.filter((v) => v !== s))
  })),
  ...speciesFilter.map((s) => ({
    key: `species-${s}`,
    label: s,
    icon: (
      <SpeciesIcon
        iconName={speciesCatalog.find((sp) => sp.name === s)?.icon_name}
        className="w-3.5 h-3.5 text-text-secondary" />),

    clear: () => setSpeciesFilter((cur) => cur.filter((v) => v !== s))
  })),
  ...traitFilter.map((id) => ({
    key: `trait-${id}`,
    label: traits.find((t) => t.id === id)?.name ?? 'Trait',
    clear: () => setTraitFilter((cur) => cur.filter((v) => v !== id))
  })),
  ...specialConditions.map((c) => ({
    key: `cond-${c}`,
    label: SPECIAL_CONDITIONS.find((o) => o.value === c)?.label ?? c,
    clear: () => setSpecialConditions((cur) => cur.filter((v) => v !== c))
  })),
  ...ageGroups.map((g) => ({
    key: `age-${g}`,
    label: AGE_GROUPS.find((o) => o.value === g)?.label ?? g,
    clear: () => setAgeGroups((cur) => cur.filter((v) => v !== g))
  }))] as Array<{
    key: string;
    label: string;
    icon?: React.ReactNode;
    clear: () => void;
  }>;
  const clearAll = () => {
    setStatusFilter([]);
    setSpeciesFilter([]);
    setFlagFilters([]);
    setTraitFilter([]);
    setSpecialConditions([]);
    setAgeGroups([]);
  };
  // Only worth showing when the org accepts multiple species AND the results
  // actually span more than one species.
  const showSpeciesFilter = enabledSpecies.length > 1 && distinctSpeciesInPool > 1;
  const showTraitFilter = traitOptions.length > 0;
  return (
    <div className="space-y-5 pb-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-heading font-bold text-text-primary">
            Animals
          </h1>
          <p className="text-text-secondary">
            Track animals from intake through adoption.
          </p>
        </div>
        <Button onClick={() => setIsAddModalOpen(true)} className="gap-2">
          <PlusIcon className="w-4 h-4" />
          {view === 'litters' ? 'Add Litter' : 'Add Animal'}
        </Button>
      </div>

      {/* Animals | Litters tabs */}
      <div className="flex items-center gap-1 border-b border-border">
        {(['animals', 'litters'] as const).map((t) =>
        <button
          key={t}
          type="button"
          onClick={() => setView(t)}
          className={`px-4 py-2.5 text-sm font-medium -mb-px border-b-2 transition-colors ${
          view === t ?
          'border-primary text-primary' :
          'border-transparent text-text-secondary hover:text-text-primary'}`
          }>

            {t === 'animals' ? 'Animals' : 'Litters'}
          </button>
        )}
      </div>

      {view === 'litters' ?
      <LittersView /> :

      <>
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
        <MultiFilterDropdown
          label="Status"
          values={statusFilter}
          options={statusOptions}
          onChange={setStatusFilter} />

        {showSpeciesFilter &&
        <MultiFilterDropdown
          label="Species"
          values={speciesFilter}
          options={speciesOptions}
          onChange={setSpeciesFilter} />

        }
        {showTraitFilter &&
        <MultiFilterDropdown
          label="Traits"
          values={traitFilter}
          options={traitOptions}
          onChange={setTraitFilter} />

        }
        <MultiFilterDropdown
          label="Special Conditions"
          values={specialConditions}
          options={SPECIAL_CONDITIONS}
          onChange={setSpecialConditions} />

        <MultiFilterDropdown
          label="Age Group"
          values={ageGroups}
          options={AGE_GROUPS}
          onChange={setAgeGroups} />

        <span className="w-px h-6 bg-border mx-1" aria-hidden="true" />
        {FLAG_FILTERS.map((f) =>
        <button
          key={f.key}
          type="button"
          onClick={() => toggleFlag(f.key)}
          className={`inline-flex items-center h-9 px-3 rounded-lg text-sm font-medium border transition-colors ${
          flagFilters.includes(f.key) ?
          'bg-primary/10 text-primary border-primary/30' :
          'bg-card text-text-secondary border-border hover:bg-background'}`
          }>

            {f.label}
          </button>
        )}

        {/* Show Historical Animals — expands the dataset to adopted/
            released/deceased animals. Off by default. */}
        <label
          className="ml-auto inline-flex items-center gap-2.5 h-9 px-3 rounded-lg text-sm font-medium border border-border bg-card cursor-pointer select-none hover:bg-background transition-colors">

          <input
            type="checkbox"
            checked={includeHistorical}
            onChange={(e) => toggleHistorical(e.target.checked)}
            className="h-4 w-4 rounded border-border text-primary focus:ring-primary/40 cursor-pointer" />

          <span className="text-text-secondary">Show Historical Animals</span>
          {historicalLoading &&
          <PawPrintGlyph className="w-3.5 h-3.5 text-text-secondary/50 animate-pulse" />
          }
        </label>
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
        <div
          ref={tableRows.scrollRef}
          className="overflow-auto"
          style={{ maxHeight: '70vh' }}>
          <table className="w-full text-left border-collapse">
            <thead className="sticky top-0 z-10">
              <tr className="border-b border-border bg-background text-sm font-medium text-text-secondary">
                <SortableHeader label="Animal" sortKey="name" sort={sort} onSort={onSort} />
                <SortableHeader label="Status" sortKey="status" sort={sort} onSort={onSort} />
                <SortableHeader label="Age & Sex" sortKey="age" sort={sort} onSort={onSort} />
                <SortableHeader label="Current Foster" sortKey="foster" sort={sort} onSort={onSort} />
                <SortableHeader label="Next Medical" sortKey="medical" sort={sort} onSort={onSort} />
              </tr>
            </thead>
            <tbody>
              {animalsLoading && animals.length === 0 ?
              <tr>
                  <td
                  colSpan={5}
                  className="py-12 text-center text-text-secondary">

                    <div className="flex flex-col items-center gap-3">
                      <PawPrintGlyph className="w-10 h-10 text-text-secondary/30 animate-pulse" />
                      <p>Loading animals…</p>
                    </div>
                  </td>
                </tr> :
              sortedAnimals.length === 0 ?
              <tr>
                  <td
                  colSpan={5}
                  className="py-12 text-center text-text-secondary">

                    <div className="flex flex-col items-center gap-3">
                      <PawPrintGlyph className="w-10 h-10 text-text-secondary/30" />
                      <p>No animals found matching your filters.</p>
                    </div>
                  </td>
                </tr> :

              <>
                  {tableRows.paddingTop > 0 &&
                <tr aria-hidden="true">
                      <td
                    colSpan={5}
                    style={{ height: tableRows.paddingTop, padding: 0, border: 0 }} />

                    </tr>
                }
                  {tableRows.virtualRows.map((vr) => {
                  const animal = sortedAnimals[vr.index];
                  const foster = getActiveFoster(animal.id);
                  const nextMedical = getNextMedical(animal.id);
                  const bonded = isBondedPair(animal.id);
                  return (
                    <tr
                      key={animal.id}
                      className="border-b border-border hover:bg-background/60 transition-colors group">

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
                            className={`group-hover:text-primary transition-colors block ${animal.name ? 'font-medium text-text-primary' : 'font-mono text-sm font-semibold text-text-primary'}`}>

                              {animalDisplayName(animal)}
                            </Link>
                            {animalShowsRescueIdBadge(animal) &&
                          <span className="block mt-0.5 font-mono text-[11px] text-text-secondary">
                                {animal.rescue_id}
                              </span>
                          }
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
                        <div className="flex flex-col items-start gap-1">
                          <StatusBadge status={animal.status} />
                          {pendingAdoptionAnimalIds.has(animal.id) &&
                          <span className="inline-flex items-center gap-1 text-xs font-semibold text-[#B4641E]">
                              <StarIcon className="w-3 h-3 fill-[#B4641E]" />
                              Pending Adoption
                            </span>
                          }
                        </div>
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
                    </tr>);

                })}
                  {tableRows.paddingBottom > 0 &&
                <tr aria-hidden="true">
                      <td
                    colSpan={5}
                    style={{ height: tableRows.paddingBottom, padding: 0, border: 0 }} />

                    </tr>
                }
                </>
              }
            </tbody>
          </table>
        </div>
      </Card>
      </>
      }

      <AddAnimalModal
        isOpen={isAddModalOpen}
        initialMode={view === 'litters' ? 'litter' : 'single'}
        onClose={() => setIsAddModalOpen(false)} />

    </div>);

}