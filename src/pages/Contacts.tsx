import React, { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useWhisker } from '../context/WhiskerContext';
import { Card } from '../components/ui/Card';
import { Avatar } from '../components/ui/Avatar';
import { Input } from '../components/ui/Forms';
import { Button } from '../components/ui/Button';
import { AddContactModal } from '../components/contacts/AddContactModal';
import { EditContactModal } from '../components/contacts/EditContactModal';
import { VirtualizedGrid } from '../components/ui/VirtualizedGrid';
import {
  SortableHeader,
  SortState,
  nextSort,
  sortItems } from
'../components/ui/SortableHeader';
import { useWindowRowVirtualizer } from '../lib/useWindowRowVirtualizer';
import {
  SearchIcon,
  PhoneIcon,
  MailIcon,
  BuildingIcon,
  Edit2Icon,
  PlusIcon,
  XIcon,
  LayoutGridIcon,
  ListIcon } from
'lucide-react';
import { Person, PersonRole } from '../types';
import { cn } from '../lib/utils';

const ACTIVE_BADGE = {
  active: {
    label: 'Active',
    cls: 'bg-status-adoptable-bg text-status-adoptable-text'
  },
  inactive: {
    label: 'Inactive',
    cls: 'bg-status-intake-bg text-status-intake-text'
  }
};
export function Contacts() {
  const { people, peopleLoading } = useWhisker();
  const [searchParams] = useSearchParams();
  // Allow deep-linking to a contact, e.g. /contacts?q=Jane Doe (used by the
  // "Adopted By" link on an animal profile).
  const [searchQuery, setSearchQuery] = useState(
    () => searchParams.get('q') ?? ''
  );
  const [activeTab, setActiveTab] = useState<PersonRole | 'all'>('all');
  const [view, setView] = useState<'table' | 'grid'>('table');
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editingPerson, setEditingPerson] = useState<Person | null>(null);
  const [sort, setSort] = useState<SortState | null>(null);
  const onSort = (key: string) => setSort((cur) => nextSort(cur, key));
  // Account/self records (linked to an app user) are identity rows, not
  // directory contacts — keep them out.
  const directory = useMemo(() => people.filter((p) => !p.user_id), [people]);

  const filteredPeople = useMemo(() => {
    const q = searchQuery.toLowerCase();
    return directory.filter((person) => {
      const haystack =
      `${person.first_name} ${person.last_name} ${person.email} ${person.phone ?? ''} ${person.organization_name ?? ''}`.toLowerCase();
      const matchesSearch = haystack.includes(q);
      const matchesTab =
      activeTab === 'all' || person.roles.includes(activeTab);
      return matchesSearch && matchesTab;
    });
  }, [directory, searchQuery, activeTab]);

  const sortedPeople = useMemo(() => {
    if (!sort) return filteredPeople;
    const getValue = (p: Person): string | number | null => {
      switch (sort.key) {
        case 'name':
          return `${p.first_name} ${p.last_name}`.toLowerCase();
        case 'active':
          return p.active ? 0 : 1;
        case 'roles':
          return p.roles.join(', ').toLowerCase();
        case 'contact':
          return (p.email ?? '').toLowerCase();
        default:
          return null;
      }
    };
    return sortItems(filteredPeople, getValue, sort.dir);
  }, [filteredPeople, sort]);

  // Virtualized table rows in a self-scrolling container. ~73px per row.
  const tableRows = useWindowRowVirtualizer(sortedPeople.length, 73);
  const humanizeRole = (r: PersonRole) => r.replace('_', ' ');
  // 'volunteer' was retired as a selectable role (see CLAUDE.md) — the tab
  // filtered against a role nobody writes anymore, so it's gone too.
  const tabs: {
    id: PersonRole | 'all';
    label: string;
  }[] = [
  { id: 'all', label: 'All Contacts' },
  { id: 'vet', label: 'Veterinarians' },
  { id: 'foster_parent', label: 'Foster Parents' },
  { id: 'trapper', label: 'Trappers' },
  { id: 'transport', label: 'Transport' }];

  return (
    <div className="space-y-5 pb-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-heading font-bold text-text-primary">
            Contacts
          </h1>
          <p className="text-text-secondary">
            Directory of vets, staff, volunteers, and adopters.
          </p>
        </div>
        <Button onClick={() => setIsAddOpen(true)} className="gap-2">
          <PlusIcon className="w-4 h-4" />
          New Contact
        </Button>
      </div>

      {/* Search — dominant, full width */}
      <div className="relative">
        <SearchIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-text-secondary pointer-events-none" />
        <Input
          placeholder="Search by name, email, phone, or organization…"
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

      {/* Tabs + view toggle */}
      <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
        <div className="flex gap-2 overflow-x-auto pb-2 sm:pb-0 w-full sm:w-auto scrollbar-hide">
          {tabs.map((tab) =>
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${activeTab === tab.id ? 'bg-primary text-white' : 'bg-card text-text-secondary hover:bg-background hover:text-text-primary border border-border'}`}>

              {tab.label}
            </button>
          )}
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <span className="text-xs text-text-secondary">
            {filteredPeople.length} of {directory.length} contacts
          </span>
          <div className="flex items-center bg-card border border-border rounded-lg p-1">
            <button
              onClick={() => setView('table')}
              className={`p-1.5 rounded-md transition-colors ${view === 'table' ? 'bg-primary/10 text-primary' : 'text-text-secondary hover:text-text-primary'}`}
              aria-label="Table view">

              <ListIcon className="w-4 h-4" />
            </button>
            <button
              onClick={() => setView('grid')}
              className={`p-1.5 rounded-md transition-colors ${view === 'grid' ? 'bg-primary/10 text-primary' : 'text-text-secondary hover:text-text-primary'}`}
              aria-label="Card view">

              <LayoutGridIcon className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {peopleLoading && people.length === 0 ?
      <div className="p-12 text-center text-text-secondary bg-card rounded-2xl border border-border">
          Loading contacts…
        </div> :
      view === 'grid' ?
      filteredPeople.length === 0 ?
      <div className="p-12 text-center text-text-secondary bg-card rounded-2xl border border-border">
          No contacts found.
        </div> :

      <VirtualizedGrid
        items={filteredPeople}
        getKey={(p) => p.id}
        minColumnWidth={300}
        estimateRowHeight={210}
        gap={24}
        renderItem={(person) =>
        <Card className="h-full flex flex-col p-6">
              <div className="flex items-start justify-between gap-3 mb-4">
                <div className="flex items-start gap-4 min-w-0">
                  <Link to={`/contacts/${person.id}`} className="shrink-0">
                    <Avatar
                  src={person.photo_url}
                  name={`${person.first_name} ${person.last_name}`}
                  colorKey={person.id}
                  type="person"
                  size="lg" />

                  </Link>
                  <div className="min-w-0">
                    <Link
                  to={`/contacts/${person.id}`}
                  className="font-heading font-bold text-lg text-text-primary hover:text-primary transition-colors">

                      {person.first_name} {person.last_name}
                    </Link>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {person.roles.map((r) =>
                  <span
                    key={r}
                    className="text-xs px-2 py-0.5 bg-background border border-border text-text-secondary rounded-md font-medium capitalize">

                          {humanizeRole(r)}
                        </span>
                  )}
                    </div>
                  </div>
                </div>
                <button
              type="button"
              onClick={() => setEditingPerson(person)}
              aria-label={`Edit ${person.first_name} ${person.last_name}`}
              className="shrink-0 p-1.5 -mr-1 -mt-1 rounded-md text-text-secondary hover:text-text-primary hover:bg-background transition-colors">

                  <Edit2Icon className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-2 mb-4 flex-1">
                {person.organization_name &&
            <div className="flex items-center gap-2 text-sm text-text-primary font-medium">
                    <BuildingIcon className="w-4 h-4 text-text-secondary" />{' '}
                    {person.organization_name}
                  </div>
            }
                {person.phone &&
            <div className="flex items-center gap-2 text-sm text-text-secondary">
                    <PhoneIcon className="w-4 h-4" />{' '}
                    <a href={`tel:${person.phone}`} className="hover:text-primary">
                      {person.phone}
                    </a>
                  </div>
            }
                <div className="flex items-center gap-2 text-sm text-text-secondary">
                  <MailIcon className="w-4 h-4" />{' '}
                  <a
                href={`mailto:${person.email}`}
                className="hover:text-primary truncate">

                    {person.email}
                  </a>
                </div>
              </div>

              {person.notes &&
          <div className="pt-4 border-t border-border mt-auto">
                  <p className="text-sm text-text-secondary line-clamp-2">
                    {person.notes}
                  </p>
                </div>
          }
            </Card>
        } /> :


      <Card className="overflow-hidden">
          <div
          ref={tableRows.scrollRef}
          className="overflow-auto"
          style={{ maxHeight: '70vh' }}>

            <table className="w-full text-left border-collapse">
              <thead className="sticky top-0 z-10">
                <tr className="border-b border-border bg-background text-sm font-medium text-text-secondary">
                  <SortableHeader label="Name" sortKey="name" sort={sort} onSort={onSort} />
                  <SortableHeader label="Status" sortKey="active" sort={sort} onSort={onSort} />
                  <SortableHeader label="Roles" sortKey="roles" sort={sort} onSort={onSort} />
                  <SortableHeader label="Contact" sortKey="contact" sort={sort} onSort={onSort} />
                  <th className="py-3 px-6" aria-label="Actions" />
                </tr>
              </thead>
              <tbody>
                {sortedPeople.length === 0 ?
              <tr>
                    <td
                  colSpan={5}
                  className="py-12 text-center text-text-secondary">

                      No contacts found.
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
                  const person = sortedPeople[vr.index];
                  const status = person.active ? 'active' : 'inactive';
                  return (
                    <tr
                      key={person.id}
                      className="border-b border-border hover:bg-[#FAFAF8] transition-colors group">

                          <td className="py-4 px-6">
                            <div className="flex items-center gap-4">
                              <Link
                            to={`/contacts/${person.id}`}
                            className="shrink-0">

                                <Avatar
                              src={person.photo_url}
                              name={`${person.first_name} ${person.last_name}`}
                              colorKey={person.id}
                              type="person" />

                              </Link>
                              <div>
                                <Link
                              to={`/contacts/${person.id}`}
                              className="font-medium text-text-primary hover:text-primary transition-colors">

                                  {person.first_name} {person.last_name}
                                </Link>
                                {person.organization_name &&
                            <p className="text-xs text-text-secondary mt-0.5 flex items-center gap-1">
                                    <BuildingIcon className="w-3 h-3" />{' '}
                                    {person.organization_name}
                                  </p>
                            }
                              </div>
                            </div>
                          </td>
                          <td className="py-4 px-6">
                            <span
                          className={cn(
                            'inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium',
                            ACTIVE_BADGE[status].cls
                          )}>

                              {ACTIVE_BADGE[status].label}
                            </span>
                          </td>
                          <td className="py-4 px-6">
                            <div className="flex flex-wrap gap-1">
                              {person.roles.length === 0 ?
                          <span className="text-xs text-text-secondary">
                                  —
                                </span> :

                          person.roles.map((r) =>
                          <span
                            key={r}
                            className="text-xs px-2 py-0.5 bg-background border border-border text-text-secondary rounded-md font-medium capitalize">

                                    {humanizeRole(r)}
                                  </span>
                          )
                          }
                            </div>
                          </td>
                          <td className="py-4 px-6">
                            {person.phone &&
                        <p className="text-sm text-text-primary">
                                <a
                            href={`tel:${person.phone}`}
                            className="hover:text-primary">

                                  {person.phone}
                                </a>
                              </p>
                        }
                            <p className="text-sm text-text-secondary truncate max-w-[260px]">
                              <a
                            href={`mailto:${person.email}`}
                            className="hover:text-primary">

                                {person.email}
                              </a>
                            </p>
                          </td>
                          <td className="py-4 px-6 text-right">
                            <button
                          type="button"
                          onClick={() => setEditingPerson(person)}
                          aria-label={`Edit ${person.first_name} ${person.last_name}`}
                          className="p-1.5 rounded-md text-text-secondary opacity-0 group-hover:opacity-100 hover:text-text-primary hover:bg-background transition-all focus:opacity-100">

                              <Edit2Icon className="w-4 h-4" />
                            </button>
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
      }

      <AddContactModal isOpen={isAddOpen} onClose={() => setIsAddOpen(false)} />
      {editingPerson &&
      <EditContactModal
        isOpen={!!editingPerson}
        onClose={() => setEditingPerson(null)}
        person={editingPerson} />
      }
    </div>);

}
