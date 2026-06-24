import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useWhisker } from '../context/WhiskerContext';
import { Card } from '../components/ui/Card';
import { GuidanceLink } from '../components/guidance/GuidanceLink';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Forms';
import { Avatar } from '../components/ui/Avatar';
import { AddFosterModal } from '../components/fosters/AddFosterModal';
import { VirtualizedGrid } from '../components/ui/VirtualizedGrid';
import {
  SortableHeader,
  SortState,
  nextSort,
  sortItems } from
'../components/ui/SortableHeader';
import {
  SearchIcon,
  PlusIcon,
  XIcon,
  MapPinIcon,
  PhoneIcon,
  MailIcon,
  LayoutGridIcon,
  ListIcon,
  CheckIcon } from
'lucide-react';
import { useWindowRowVirtualizer } from '../lib/useWindowRowVirtualizer';
import { Person } from '../types';
import { enabledSpeciesList } from '../lib/orgCatalog';
import { cn } from '../lib/utils';
import { ExportButton } from '../components/ui/ExportButton';
import { CsvColumn } from '../lib/csv';

type Availability = 'available' | 'full' | 'inactive';
const AVAILABILITY_BADGE: Record<
  Availability,
  { label: string; cls: string }> =
{
  available: {
    label: 'Available',
    cls: 'bg-status-adoptable-bg text-status-adoptable-text'
  },
  full: { label: 'Full', cls: 'bg-status-medical-bg text-status-medical-text' },
  inactive: {
    label: 'Inactive',
    cls: 'bg-status-intake-bg text-status-intake-text'
  }
};
const AVAILABILITY_ORDER: Record<Availability, number> = {
  available: 0,
  full: 1,
  inactive: 2
};
export function FostersList() {
  const { fosters, peopleIndex, fostersLoading, placements, species: speciesCatalog,
    organizationSpecies, ensureInactiveLoaded, inactiveLoaded } =
  useWhisker();
  const enabledSpecies = enabledSpeciesList(speciesCatalog, organizationSpecies);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [view, setView] = useState<'table' | 'grid'>('table');
  const [speciesFilter, setSpeciesFilter] = useState<string[]>([]);
  const [hasCapacityOnly, setHasCapacityOnly] = useState(false);
  // Default to active-only — inactive fosters (derived from inactive `people`)
  // aren't retrieved upfront. Unchecking "Active" pulls them in on demand.
  const [activeOnly, setActiveOnly] = useState(true);
  useEffect(() => {
    if (!activeOnly && !inactiveLoaded) ensureInactiveLoaded();
  }, [activeOnly, inactiveLoaded, ensureInactiveLoaded]);
  const [sort, setSort] = useState<SortState | null>(null);
  const onSort = (key: string) => setSort((cur) => nextSort(cur, key));

  const activeCountByFoster = useMemo(() => {
    const m = new Map<string, number>();
    for (const p of placements) {
      if (p.placement_status === 'active') {
        m.set(p.person_id, (m.get(p.person_id) ?? 0) + 1);
      }
    }
    return m;
  }, [placements]);
  const getActivePlacementsCount = (fosterId: string) =>
  activeCountByFoster.get(fosterId) ?? 0;
  const getAvailability = (foster: Person): Availability => {
    if (foster.active === false) return 'inactive';
    const cap = foster.max_capacity ?? 0;
    return getActivePlacementsCount(foster.id) >= cap ? 'full' : 'available';
  };
  const toggleSpecies = (s: string) =>
  setSpeciesFilter((cur) =>
  cur.includes(s) ? cur.filter((v) => v !== s) : [...cur, s]
  );

  const filteredFosters = useMemo(() => {
    const q = searchQuery.toLowerCase();
    return fosters.filter((foster) => {
      const haystack =
      `${foster.first_name} ${foster.last_name} ${foster.email} ${foster.phone ?? ''} ${foster.address ?? ''}`.toLowerCase();
      if (!haystack.includes(q)) return false;
      if (activeOnly && foster.active === false) return false;
      if (hasCapacityOnly) {
        const cap = foster.max_capacity ?? 0;
        if (getActivePlacementsCount(foster.id) >= cap) return false;
      }
      if (speciesFilter.length > 0) {
        const prefs = foster.preferred_species ?? [];
        if (!speciesFilter.some((s) => prefs.includes(s))) {
          return false;
        }
      }
      return true;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
  fosters,
  searchQuery,
  activeOnly,
  hasCapacityOnly,
  speciesFilter,
  activeCountByFoster]
  );

  const sortedFosters = useMemo(() => {
    if (!sort) return filteredFosters;
    const getValue = (f: Person): string | number | null => {
      switch (sort.key) {
        case 'name':
          return `${f.first_name} ${f.last_name}`.toLowerCase();
        case 'availability':
          return AVAILABILITY_ORDER[getAvailability(f)];
        case 'contact':
          return (f.email ?? '').toLowerCase();
        case 'location':
          return (f.address ?? '').toLowerCase();
        case 'capacity':
          return (f.max_capacity ?? 0) - getActivePlacementsCount(f.id);
        case 'preferences':
          return (f.preferred_species ?? []).join(', ').toLowerCase();
        default:
          return null;
      }
    };
    return sortItems(filteredFosters, getValue, sort.dir);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filteredFosters, sort, activeCountByFoster]);

  const showSpeciesFilter = enabledSpecies.length > 1;

  // CSV export columns for the current fosters view.
  const fosterCsvColumns: CsvColumn<Person>[] = [
  { header: 'First Name', value: (f) => f.first_name },
  { header: 'Last Name', value: (f) => f.last_name },
  { header: 'Email', value: (f) => f.email },
  { header: 'Phone', value: (f) => f.phone },
  { header: 'Roles', value: (f) => f.roles.join('; ') },
  { header: 'Availability', value: (f) => getAvailability(f) },
  { header: 'Active Placements', value: (f) => getActivePlacementsCount(f.id) },
  { header: 'Max Capacity', value: (f) => f.max_capacity ?? 0 },
  { header: 'Preferred Species', value: (f) => (f.preferred_species ?? []).join('; ') },
  { header: 'Address', value: (f) => f.address_formatted ?? f.address },
  { header: 'City', value: (f) => f.address_city },
  { header: 'State', value: (f) => f.address_state },
  { header: 'Postal Code', value: (f) => f.address_postal_code },
  { header: 'Active', value: (f) => f.active !== false },
  { header: 'Created At', value: (f) => f.created_at }];

  // Virtualized table rows in a self-scrolling container. ~73px per row.
  const tableRows = useWindowRowVirtualizer(sortedFosters.length, 73);
  return (
    <div className="space-y-5 pb-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-heading font-bold text-text-primary">
            Foster Network
          </h1>
          <p className="text-text-secondary">
            Manage foster homes and capacity.
          </p>
          <GuidanceLink guidanceKey="fosters_intro" />
        </div>
        <div className="flex items-center gap-2">
          <ExportButton
            entityLabel="Foster Parents"
            noun="foster parents"
            filenameBase="foster-parents"
            columns={fosterCsvColumns}
            current={sortedFosters}
            allRows={fosters}
            allCount={
            peopleIndex.filter((p) => p.roles?.includes('foster_parent')).length
            }
            allComplete={inactiveLoaded}
            ensureAllLoaded={ensureInactiveLoaded} />
          <Button onClick={() => setIsAddModalOpen(true)} className="gap-2">
            <PlusIcon className="w-4 h-4" />
            Add Foster
          </Button>
        </div>
      </div>

      {/* Search — dominant, full width */}
      <div className="relative">
        <SearchIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-text-secondary pointer-events-none" />
        <Input
          placeholder="Search by name, email, phone, or address…"
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
        <button
          type="button"
          onClick={() => setHasCapacityOnly((v) => !v)}
          className={cn(
            'inline-flex items-center gap-1.5 h-9 px-3 rounded-lg text-sm font-medium border transition-colors',
            hasCapacityOnly ?
            'bg-primary/10 text-primary border-primary/30' :
            'bg-card text-text-primary border-border hover:bg-background'
          )}>

          <span
            className={cn(
              'w-4 h-4 rounded border flex items-center justify-center shrink-0',
              hasCapacityOnly ?
              'bg-primary border-primary text-white' :
              'border-border'
            )}>

            {hasCapacityOnly && <CheckIcon className="w-3 h-3" />}
          </span>
          Has Capacity
        </button>
        <button
          type="button"
          onClick={() => setActiveOnly((v) => !v)}
          className={cn(
            'inline-flex items-center gap-1.5 h-9 px-3 rounded-lg text-sm font-medium border transition-colors',
            activeOnly ?
            'bg-primary/10 text-primary border-primary/30' :
            'bg-card text-text-primary border-border hover:bg-background'
          )}>

          <span
            className={cn(
              'w-4 h-4 rounded border flex items-center justify-center shrink-0',
              activeOnly ?
              'bg-primary border-primary text-white' :
              'border-border'
            )}>

            {activeOnly && <CheckIcon className="w-3 h-3" />}
          </span>
          Active
        </button>

        {showSpeciesFilter &&
        <>
            <span className="text-sm text-text-secondary ml-1">Species:</span>
            {enabledSpecies.map((sp) =>
          <button
            key={sp.id}
            type="button"
            onClick={() => toggleSpecies(sp.name)}
            className={cn(
              'inline-flex items-center h-8 px-3 rounded-full text-sm font-medium border transition-colors',
              speciesFilter.includes(sp.name) ?
              'bg-primary/10 text-primary border-primary/30' :
              'bg-card text-text-secondary border-border hover:bg-background'
            )}>

                {sp.name}
              </button>
          )}
          </>
        }

        <div className="ml-auto flex items-center gap-3">
          <span className="text-xs text-text-secondary">
            {filteredFosters.length} of {fosters.length} fosters
          </span>
          <div className="flex items-center bg-card border border-border rounded-lg p-1">
            <button
              onClick={() => setView('table')}
              className={`p-1.5 rounded-md transition-colors ${view === 'table' ? 'bg-primary/10 text-primary' : 'text-text-secondary hover:text-text-primary'}`}>

              <ListIcon className="w-4 h-4" />
            </button>
            <button
              onClick={() => setView('grid')}
              className={`p-1.5 rounded-md transition-colors ${view === 'grid' ? 'bg-primary/10 text-primary' : 'text-text-secondary hover:text-text-primary'}`}>

              <LayoutGridIcon className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {fostersLoading && fosters.length === 0 ?
      <div className="p-12 text-center text-text-secondary bg-card rounded-2xl border border-border">
          Loading fosters…
        </div> :
      view === 'grid' ?
      filteredFosters.length === 0 ?
      <div className="p-12 text-center text-text-secondary bg-card rounded-2xl border border-border">
          No fosters found matching your search.
        </div> :

      <VirtualizedGrid
        items={filteredFosters}
        getKey={(f) => f.id}
        minColumnWidth={300}
        estimateRowHeight={260}
        gap={24}
        renderItem={(foster) => {
          const activeCount = getActivePlacementsCount(foster.id);
          const cap = foster.max_capacity ?? 0;
          const isFull = activeCount >= cap;
          const capacityPercent = cap > 0 ? activeCount / cap * 100 : 0;
          return (
            <Link to={`/fosters/${foster.id}`} className="block h-full group">
                <Card hoverLift className="h-full flex flex-col p-6">
                  <div className="flex items-start gap-4 mb-4">
                    <Avatar
                  src={foster.photo_url}
                  name={`${foster.first_name} ${foster.last_name}`}
                  colorKey={foster.id}
                  type="person"
                  size="lg" />

                    <div>
                      <h3 className="font-heading font-bold text-lg text-text-primary group-hover:text-primary transition-colors">
                        {foster.first_name} {foster.last_name}
                      </h3>
                      <div className="flex items-center gap-1 text-sm text-text-secondary mt-1">
                        <MapPinIcon className="w-3.5 h-3.5" />
                        <span className="truncate max-w-[180px]">
                          {(foster.address ?? '').split(',')[0]}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2 mb-6 flex-1">
                    <div className="flex items-center gap-2 text-sm text-text-secondary">
                      <PhoneIcon className="w-4 h-4" /> {foster.phone}
                    </div>
                    <div className="flex items-center gap-2 text-sm text-text-secondary">
                      <MailIcon className="w-4 h-4" />{' '}
                      <span className="truncate">{foster.email}</span>
                    </div>
                  </div>

                  <div className="mt-auto pt-4 border-t border-border">
                    <div className="flex justify-between text-sm mb-2">
                      <span className="text-text-secondary">Capacity</span>
                      <span className="font-medium text-text-primary">
                        {activeCount} / {cap}
                      </span>
                    </div>
                    <div className="w-full bg-background rounded-full h-2 overflow-hidden">
                      <div
                    className={`h-2 rounded-full transition-all duration-500 ${isFull ? 'bg-status-urgent-text' : 'bg-[#3E7B52]'}`}
                    style={{
                      width: `${Math.min(100, capacityPercent)}%`
                    }} />

                    </div>
                    <div className="mt-3 flex gap-1 flex-wrap">
                      {(foster.preferred_species ?? []).map((s) =>
                  <span
                    key={s}
                    className="text-xs px-2 py-1 bg-accent text-secondary rounded-md font-medium">

                          {s}
                        </span>
                  )}
                    </div>
                  </div>
                </Card>
              </Link>);

        }} /> :

      <Card className="overflow-hidden">
          <div
          ref={tableRows.scrollRef}
          className="overflow-auto"
          style={{ maxHeight: '70vh' }}>

            <table className="w-full text-left border-collapse">
              <thead className="sticky top-0 z-10">
                <tr className="border-b border-border bg-background text-sm font-medium text-text-secondary">
                  <SortableHeader label="Foster Parent" sortKey="name" sort={sort} onSort={onSort} />
                  <SortableHeader label="Availability" sortKey="availability" sort={sort} onSort={onSort} />
                  <SortableHeader label="Contact" sortKey="contact" sort={sort} onSort={onSort} />
                  <SortableHeader label="Location" sortKey="location" sort={sort} onSort={onSort} />
                  <SortableHeader label="Capacity" sortKey="capacity" sort={sort} onSort={onSort} />
                  <SortableHeader label="Preferences" sortKey="preferences" sort={sort} onSort={onSort} />
                </tr>
              </thead>
              <tbody>
                {sortedFosters.length === 0 ?
              <tr>
                    <td
                  colSpan={6}
                  className="py-12 text-center text-text-secondary">

                      No fosters found matching your search.
                    </td>
                  </tr> :

              <>
                  {tableRows.paddingTop > 0 &&
                <tr aria-hidden="true">
                      <td
                    colSpan={6}
                    style={{ height: tableRows.paddingTop, padding: 0, border: 0 }} />

                    </tr>
                }
                  {tableRows.virtualRows.map((vr) => {
                  const foster = sortedFosters[vr.index];
                  const activeCount = getActivePlacementsCount(foster.id);
                  const cap = foster.max_capacity ?? 0;
                  const isFull = activeCount >= cap;
                  const capacityPercent = cap > 0 ? activeCount / cap * 100 : 0;
                  const availability = getAvailability(foster);
                  return (
                    <tr
                      key={foster.id}
                      className="border-b border-border hover:bg-[#FAFAF8] transition-colors group">

                        <td className="py-4 px-6">
                          <Link
                        to={`/fosters/${foster.id}`}
                        className="flex items-center gap-4">
                        
                            <Avatar
                          src={foster.photo_url}
                          name={`${foster.first_name} ${foster.last_name}`}
                          colorKey={foster.id}
                          type="person" />
                        
                            <div>
                              <p className="font-medium text-text-primary group-hover:text-primary transition-colors">
                                {foster.first_name} {foster.last_name}
                              </p>
                            </div>
                          </Link>
                        </td>
                        <td className="py-4 px-6">
                          <span
                        className={cn(
                          'inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium',
                          AVAILABILITY_BADGE[availability].cls
                        )}>

                            {AVAILABILITY_BADGE[availability].label}
                          </span>
                        </td>
                        <td className="py-4 px-6">
                          <p className="text-sm text-text-primary">
                            {foster.phone}
                          </p>
                          <p className="text-sm text-text-secondary">
                            {foster.email}
                          </p>
                        </td>
                        <td className="py-4 px-6">
                          <p className="text-sm text-text-primary">
                            {(foster.address ?? '').split(',')[0]}
                          </p>
                        </td>
                        <td className="py-4 px-6">
                          <div className="flex items-center gap-3">
                            <span className="text-sm font-medium text-text-primary w-8">
                              {activeCount}/{cap}
                            </span>
                            <div className="w-16 bg-background rounded-full h-1.5 overflow-hidden">
                              <div
                            className={`h-1.5 rounded-full transition-all duration-500 ${isFull ? 'bg-status-urgent-text' : 'bg-[#3E7B52]'}`}
                            style={{
                              width: `${Math.min(100, capacityPercent)}%`
                            }} />
                          
                            </div>
                          </div>
                        </td>
                        <td className="py-4 px-6">
                          <div className="flex gap-1 flex-wrap">
                            {(foster.preferred_species ?? []).map((s) =>
                        <span
                          key={s}
                          className="text-xs px-2 py-1 bg-accent text-secondary rounded-md font-medium">
                          
                                {s}
                              </span>
                        )}
                          </div>
                        </td>
                      </tr>);

                })}
                  {tableRows.paddingBottom > 0 &&
                <tr aria-hidden="true">
                      <td
                    colSpan={6}
                    style={{ height: tableRows.paddingBottom, padding: 0, border: 0 }} />

                    </tr>
                }
                </>
              }
              </tbody>
            </table>
          </div>
        </Card>
      }

      <AddFosterModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)} />
      
    </div>);

}