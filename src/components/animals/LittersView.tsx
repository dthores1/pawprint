import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useWhisker } from '../../context/WhiskerContext';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Input } from '../ui/Forms';
import { SpeciesBadge } from '../ui/SpeciesBadge';
import { PawPrintIcon } from '../ui/PawPrintIcon';
import { MultiFilterDropdown } from '../ui/MultiFilterDropdown';
import { VirtualizedGrid } from '../ui/VirtualizedGrid';
import {
  SortableHeader,
  nextSort,
  sortItems,
  SortState } from
'../ui/SortableHeader';
import { useWindowRowVirtualizer } from '../../lib/useWindowRowVirtualizer';
import { EditLitterModal } from './EditLitterModal';
import { AddLitterMemberModal } from './AddLitterMemberModal';
import {
  CalendarIcon,
  HomeIcon,
  HeartIcon,
  SyringeIcon,
  PlusIcon,
  Edit2Icon,
  SearchIcon,
  LayoutGridIcon,
  ListIcon } from
'lucide-react';
import { formatDate, cn } from '../../lib/utils';
import { useCanManageAnimals } from '../../lib/useAnimalPermissions';
import {
  litterMembers,
  litterLabel,
  litterBreedLabel,
  memberNoun,
  summarizeLitterStatuses,
  litterPrimaryFoster,
  nextLitterMilestone,
  litterIsHistorical } from
'../../lib/litters';

export function LittersView() {
  // Index so litter rosters/mother lookups include members who aged out of care.
  const {
    litters,
    littersLoading,
    animalsIndex: animals,
    fosters,
    medicalRecords,
    breeds
  } = useWhisker();
  const canManageAnimals = useCanManageAnimals();
  const [editLitterId, setEditLitterId] = useState<string | null>(null);
  const [addMemberLitterId, setAddMemberLitterId] = useState<string | null>(
    null
  );

  const [view, setView] = useState<'cards' | 'list'>('cards');
  const [searchQuery, setSearchQuery] = useState('');
  const [speciesFilter, setSpeciesFilter] = useState<string[]>([]);
  // Off by default; a litter is historical once all members have left care.
  const [includeHistorical, setIncludeHistorical] = useState(false);
  const [sort, setSort] = useState<SortState | null>(null);
  const onSort = (key: string) => setSort((cur) => nextSort(cur, key));

  // One pass to resolve everything the cards/rows need.
  const decorated = useMemo(
    () =>
    litters.map((litter) => {
      const members = litterMembers(animals, litter.id);
      const { foster, distinctCount } = litterPrimaryFoster(members, fosters);
      return {
        litter,
        members,
        count: members.length,
        label: litterLabel(litter, breeds),
        breedLabel: litterBreedLabel(litter, breeds) ?? '',
        foster,
        distinctCount,
        historical: litterIsHistorical(members)
      };
    }),
    [litters, animals, fosters, breeds]
  );

  const speciesOptions = useMemo(() => {
    const set = new Set(litters.map((l) => l.species).filter(Boolean));
    return Array.from(set).
    sort().
    map((s) => ({ value: s, label: s }));
  }, [litters]);

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return decorated.filter((d) => {
      if (!includeHistorical && d.historical) return false;
      if (speciesFilter.length && !speciesFilter.includes(d.litter.species))
      return false;
      if (
      q &&
      !d.label.toLowerCase().includes(q) &&
      !d.breedLabel.toLowerCase().includes(q))
      return false;
      return true;
    });
  }, [decorated, includeHistorical, speciesFilter, searchQuery]);

  type Row = (typeof decorated)[number];
  const sorted = useMemo(() => {
    if (!sort) return filtered;
    const getValue = (d: Row): string | number | null => {
      switch (sort.key) {
        case 'name':
          return d.label.toLowerCase();
        case 'size':
          return d.count;
        case 'breed':
          return d.breedLabel.toLowerCase();
        case 'intake':
          return d.litter.intake_date ?? null;
        case 'foster':
          return d.foster ?
          `${d.foster.first_name} ${d.foster.last_name}`.toLowerCase() :
          d.distinctCount > 1 ?
          'multiple fosters' :
          null;
        default:
          return null;
      }
    };
    return sortItems(filtered, getValue, sort.dir);
  }, [filtered, sort]);

  const rows = useWindowRowVirtualizer(sorted.length, 60);

  if (littersLoading && litters.length === 0) {
    return (
      <div className="p-12 text-center text-text-secondary bg-card rounded-2xl border border-border">
        Loading litters…
      </div>);

  }
  if (litters.length === 0) {
    return (
      <div className="p-12 text-center bg-card rounded-2xl border border-border">
        <div className="flex flex-col items-center gap-3">
          <PawPrintIcon className="w-10 h-10 text-text-secondary/30" />
          <p className="text-text-secondary">
            No litters yet. Use <span className="font-medium">Add Litter</span> to
            group animals taken in together.
          </p>
        </div>
      </div>);

  }

  const renderCard = (d: Row) => {
    const { litter, members, count, foster, distinctCount } = d;
    const summary = summarizeLitterStatuses(members);
    const milestone = nextLitterMilestone(members, medicalRecords);
    const mother = litter.mother_animal_id ?
    animals.find((a) => a.id === litter.mother_animal_id) :
    null;
    return (
      <Card className="p-5 flex flex-col h-full">
        <div className="flex items-start justify-between gap-3 mb-3">
          <Link
            to={`/litters/${litter.id}`}
            className="font-heading font-bold text-lg text-text-primary hover:text-primary transition-colors leading-snug">

            {d.label}
          </Link>
          <SpeciesBadge species={litter.species} />
        </div>

        <div className="space-y-2 text-sm flex-1">
          <div className="flex items-center gap-2 text-text-secondary">
            <PawPrintIcon className="w-4 h-4 shrink-0" />
            <span className="font-medium text-text-primary">
              {count} {memberNoun(litter.species, count)}
            </span>
          </div>
          {summary &&
          <p className="text-text-secondary pl-6 leading-relaxed">{summary}</p>
          }
          <div className="flex items-center gap-2 text-text-secondary">
            <CalendarIcon className="w-4 h-4 shrink-0" />
            <span>Intake {formatDate(litter.intake_date)}</span>
          </div>
          {mother &&
          <div className="flex items-center gap-2 text-text-secondary">
              <HeartIcon className="w-4 h-4 shrink-0" />
              <span>
                Mother:{' '}
                <Link
                to={`/animals/${mother.id}`}
                className="text-primary hover:underline">

                  {mother.name}
                </Link>
              </span>
            </div>
          }
          {(foster || distinctCount > 1) &&
          <div className="flex items-center gap-2 text-text-secondary">
              <HomeIcon className="w-4 h-4 shrink-0" />
              <span>
                {foster ?
                <>
                    With{' '}
                    <Link
                    to={`/fosters/${foster.id}`}
                    className="text-primary hover:underline">

                      {foster.first_name} {foster.last_name}
                    </Link>
                  </> :

                `Across ${distinctCount} fosters`}
              </span>
            </div>
          }
          {milestone &&
          <div className="flex items-center gap-2 text-text-secondary">
              <SyringeIcon className="w-4 h-4 shrink-0" />
              <span>
                Next: {milestone.procedure_name} ·{' '}
                {formatDate(milestone.due_date!)}
              </span>
            </div>
          }
        </div>

        {canManageAnimals &&
        <div className="mt-4 pt-4 border-t border-border flex flex-wrap gap-2">
          <Button
            variant="soft"
            size="sm"
            onClick={() => setAddMemberLitterId(litter.id)}>

            <PlusIcon className="w-4 h-4 mr-1.5" /> Add Animal
          </Button>
          <Button
            variant="soft"
            size="sm"
            onClick={() => setEditLitterId(litter.id)}>

            <Edit2Icon className="w-4 h-4 mr-1.5" /> Update Group
          </Button>
        </div>
        }
      </Card>);

  };

  const fosterCell = (d: Row) => {
    if (d.foster) {
      return (
        <Link
          to={`/fosters/${d.foster.id}`}
          className="text-primary hover:underline">

          {d.foster.first_name} {d.foster.last_name}
        </Link>);

    }
    if (d.distinctCount > 1)
    return <span className="text-text-secondary">Multiple Fosters</span>;
    return <span className="text-text-secondary/50">—</span>;
  };

  return (
    <>
      {/* Toolbar */}
      <div className="flex flex-col lg:flex-row lg:items-center gap-3">
        <div className="relative flex-1">
          <SearchIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-text-secondary pointer-events-none" />
          <Input
            placeholder="Search litters by name or breed…"
            className="pl-11 h-12 lg:h-10 text-base lg:text-sm"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)} />

        </div>
        <div className="flex items-center gap-3">
          {speciesOptions.length > 1 &&
          <MultiFilterDropdown
            label="Species"
            allLabel="All species"
            values={speciesFilter}
            options={speciesOptions}
            onChange={setSpeciesFilter} />
          }
          <label className="inline-flex items-center gap-2.5 h-10 px-3 rounded-lg text-sm font-medium border border-border bg-card cursor-pointer select-none hover:bg-background transition-colors whitespace-nowrap">
            <input
              type="checkbox"
              checked={includeHistorical}
              onChange={(e) => setIncludeHistorical(e.target.checked)}
              className="h-4 w-4 rounded border-border text-primary focus:ring-primary/40 cursor-pointer" />

            <span className="text-text-secondary">Show Historical Litters</span>
          </label>
          <div className="flex items-center bg-card border border-border rounded-lg p-1 shrink-0">
            <button
              type="button"
              onClick={() => setView('cards')}
              aria-label="Card view"
              className={cn(
                'p-1.5 rounded-md transition-colors',
                view === 'cards' ?
                'bg-primary/10 text-primary' :
                'text-text-secondary hover:text-text-primary'
              )}>

              <LayoutGridIcon className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => setView('list')}
              aria-label="List view"
              className={cn(
                'p-1.5 rounded-md transition-colors',
                view === 'list' ?
                'bg-primary/10 text-primary' :
                'text-text-secondary hover:text-text-primary'
              )}>

              <ListIcon className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      <p className="text-xs text-text-secondary -mt-1">
        {filtered.length} of {litters.length} litters
      </p>

      {filtered.length === 0 ?
      <div className="p-12 text-center bg-card rounded-2xl border border-border">
          <p className="text-text-secondary">
            No litters match your filters.
          </p>
        </div> :
      view === 'cards' ?
      <VirtualizedGrid
        items={sorted}
        getKey={(d) => d.litter.id}
        minColumnWidth={320}
        estimateRowHeight={240}
        gap={16}
        renderItem={renderCard} /> :


      <Card className="overflow-hidden">
          <div
          ref={rows.scrollRef}
          className="overflow-auto"
          style={{ maxHeight: '70vh' }}>

            <table className="w-full text-left border-collapse">
              <thead className="sticky top-0 z-10">
                <tr className="border-b border-border bg-background text-sm font-medium text-text-secondary">
                  <SortableHeader
                  label="Litter"
                  sortKey="name"
                  sort={sort}
                  onSort={onSort} />

                  <SortableHeader
                  label="Species & Size"
                  sortKey="size"
                  sort={sort}
                  onSort={onSort} />

                  <SortableHeader
                  label="Breed"
                  sortKey="breed"
                  sort={sort}
                  onSort={onSort} />

                  <SortableHeader
                  label="Intake Date"
                  sortKey="intake"
                  sort={sort}
                  onSort={onSort} />

                  <SortableHeader
                  label="Current Foster"
                  sortKey="foster"
                  sort={sort}
                  onSort={onSort} />

                </tr>
              </thead>
              <tbody>
                {rows.paddingTop > 0 &&
                <tr aria-hidden="true">
                    <td
                    colSpan={5}
                    style={{ height: rows.paddingTop, padding: 0, border: 0 }} />

                  </tr>
                }
                {rows.virtualRows.map((vr) => {
                  const d = sorted[vr.index];
                  return (
                    <tr
                      key={d.litter.id}
                      className="border-b border-border hover:bg-background/50 transition-colors">

                      <td className="py-3 px-4">
                        <Link
                          to={`/litters/${d.litter.id}`}
                          className="font-medium text-text-primary hover:text-primary transition-colors">

                          {d.label}
                        </Link>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <SpeciesBadge species={d.litter.species} />
                          <span className="text-sm text-text-secondary whitespace-nowrap">
                            {d.count} {memberNoun(d.litter.species, d.count)}
                          </span>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-sm text-text-secondary">
                        {d.breedLabel ||
                        <span className="text-text-secondary/50">—</span>}
                      </td>
                      <td className="py-3 px-4 text-sm text-text-secondary whitespace-nowrap">
                        {formatDate(d.litter.intake_date)}
                      </td>
                      <td className="py-3 px-4 text-sm">{fosterCell(d)}</td>
                    </tr>);

                })}
                {rows.paddingBottom > 0 &&
                <tr aria-hidden="true">
                    <td
                    colSpan={5}
                    style={{ height: rows.paddingBottom, padding: 0, border: 0 }} />

                  </tr>
                }
              </tbody>
            </table>
          </div>
        </Card>
      }

      {editLitterId &&
      <EditLitterModal
        isOpen={!!editLitterId}
        litterId={editLitterId}
        onClose={() => setEditLitterId(null)} />
      }
      {addMemberLitterId &&
      <AddLitterMemberModal
        isOpen={!!addMemberLitterId}
        litterId={addMemberLitterId}
        onClose={() => setAddMemberLitterId(null)} />
      }
    </>);

}
