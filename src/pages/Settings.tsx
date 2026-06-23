import React, { useState } from 'react';
import { XIcon, PlusIcon, PencilIcon, InfoIcon } from 'lucide-react';
import { Tooltip } from '../components/ui/Tooltip';
import { useWhisker } from '../context/WhiskerContext';
import { useAuth } from '../context/AuthContext';
import { Card } from '../components/ui/Card';
import { Select } from '../components/ui/Forms';
import { Button } from '../components/ui/Button';
import { TraitFormModal } from '../components/settings/TraitFormModal';
import { SavedLocationFormModal } from '../components/settings/SavedLocationFormModal';
import { AdoptionTemplateEditor } from '../components/settings/AdoptionTemplateEditor';
import { MemberPermissionManager } from '../components/settings/MemberPermissionManager';
import { PillTabs } from '../components/ui/PillTabs';
import { navItems } from '../components/layout/Sidebar';
import { AddressDisplay } from '../components/ui/AddressDisplay';
import { SpeciesIcon } from '../lib/speciesIcons';
import { cn } from '../lib/utils';
import { Trait, SavedLocation } from '../types';

// Curated timezone list (US-focused, the app's primary audience, + UTC). Used
// to render clinic dates/times in notifications. Expand as orgs need it.
const TIMEZONES: { value: string; label: string }[] = [
{ value: 'America/New_York', label: 'Eastern (New York)' },
{ value: 'America/Chicago', label: 'Central (Chicago)' },
{ value: 'America/Denver', label: 'Mountain (Denver)' },
{ value: 'America/Phoenix', label: 'Mountain, no DST (Phoenix)' },
{ value: 'America/Los_Angeles', label: 'Pacific (Los Angeles)' },
{ value: 'America/Anchorage', label: 'Alaska (Anchorage)' },
{ value: 'Pacific/Honolulu', label: 'Hawaii (Honolulu)' },
{ value: 'UTC', label: 'UTC' }];

// Organization settings:
//  - Accepted Animal Types → organization_species (enable/disable + default)
//  - Accepted Breeds → organization_breeds (opt-in: restrict a species to a
//    subset of breeds; no rows for a species = all breeds accepted)
//  - Traits → per-org trait definitions (admin-managed)
export function Settings() {
  const {
    species,
    breeds,
    organizationSpecies,
    organizationBreeds,
    setSpeciesEnabled,
    setDefaultSpecies,
    setAllowedBreeds,
    traits,
    updateTrait,
    savedLocations,
    updateSavedLocation,
    isTabVisible,
    setTabVisible,
    restoreNavigationDefaults
  } = useWhisker();
  const { currentOrg, updateOrgTimezone, updateOrgShowAllReports } = useAuth();
  const isAdmin =
  currentOrg?.role === 'owner' || currentOrg?.role === 'admin';
  const [traitForm, setTraitForm] = useState<{ open: boolean; trait?: Trait }>({
    open: false
  });
  const [locationForm, setLocationForm] = useState<{
    open: boolean;
    location?: SavedLocation;
  }>({ open: false });
  // Three tabs: Animal Options (catalog/traits/adoption), Locations (saved
  // places), and Permissions (member access grants — admin-only).
  const [tab, setTab] = useState<
    'animal' | 'locations' | 'navigation' | 'permissions' | 'general'>(
    'animal'
  );
  const tabs = [
  { key: 'animal', label: 'Animal Options' },
  ...isAdmin ?
  [
  { key: 'navigation', label: 'Navigation' },
  { key: 'locations', label: 'Locations' },
  { key: 'permissions', label: 'Permissions' },
  { key: 'general', label: 'General' }] :
  []];

  const rowFor = (id: string) =>
  organizationSpecies.find((r) => r.species_id === id);
  const isEnabled = (id: string) => rowFor(id)?.is_enabled ?? false;
  const enabledCount = species.filter((s) => isEnabled(s.id)).length;
  const defaultId = organizationSpecies.find((r) => r.is_default)?.species_id;

  // Accepted breed ids for a species (intersection of its catalog breeds and
  // the org_breeds rows). Empty → no restriction (all accepted).
  const acceptedBreedIds = (speciesId: string) => {
    const ids = new Set(
      breeds.filter((b) => b.species_id === speciesId).map((b) => b.id)
    );
    return organizationBreeds.
    filter((r) => ids.has(r.breed_id)).
    map((r) => r.breed_id);
  };
  const enabledSpeciesWithBreeds = species.filter(
    (s) => isEnabled(s.id) && breeds.some((b) => b.species_id === s.id)
  );

  // Navigation summary — so admins don't forget what they've hidden.
  const visibleTabCount = navItems.filter(
    (i) => i.locked || isTabVisible(i.key)
  ).length;
  const hiddenTabs = navItems.filter((i) => !i.locked && !isTabVisible(i.key));

  return (
    <div className="max-w-3xl mx-auto p-6 md:p-8 space-y-6">
      <div>
        <h1 className="text-3xl font-heading font-bold text-text-primary">
          Settings
        </h1>
        <p className="text-text-secondary mt-1">
          Configure how your organization works.
        </p>
      </div>

      {tabs.length > 1 &&
      <PillTabs tabs={tabs} value={tab} onChange={(k) => setTab(k as typeof tab)} />
      }

      {/* Accepted Animal Types ------------------------------------------- */}
      {tab === 'animal' &&
      <Card className="p-0 overflow-hidden">
        <div className="p-5 border-b border-border">
          <h2 className="font-heading font-semibold text-lg text-text-primary">
            Accepted Animal Types
          </h2>
          <p className="text-sm text-text-secondary mt-1">
            Choose which species your organization handles. The default is
            preselected when adding an animal. At least one species must stay
            enabled.
          </p>
        </div>
        <ul className="divide-y divide-border">
          {species.map((s) => {
            const enabled = isEnabled(s.id);
            const isDefault = defaultId === s.id;
            const lastEnabled = enabled && enabledCount <= 1;
            return (
              <li
                key={s.id}
                className="flex items-center justify-between gap-4 px-5 py-3.5">

                <div className="flex items-center gap-3 min-w-0">
                  <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-background text-text-secondary shrink-0">
                    <SpeciesIcon iconName={s.icon_name} className="w-4 h-4" />
                  </span>
                  <span className="font-medium text-text-primary">{s.name}</span>
                  {isDefault &&
                  <span className="text-xs font-medium text-primary bg-primary/10 px-2 py-0.5 rounded-full">
                      Default
                    </span>
                  }
                </div>
                <div className="flex items-center gap-4 shrink-0">
                  {enabled && !isDefault &&
                  <button
                    type="button"
                    onClick={() => setDefaultSpecies(s.id)}
                    className="text-xs font-medium text-text-secondary hover:text-primary transition-colors">

                      Set default
                    </button>
                  }
                  <button
                    type="button"
                    role="switch"
                    aria-checked={enabled}
                    aria-label={`${enabled ? 'Disable' : 'Enable'} ${s.name}`}
                    disabled={lastEnabled}
                    onClick={() => setSpeciesEnabled(s.id, !enabled)}
                    title={
                    lastEnabled ?
                    'At least one species must stay enabled' :
                    undefined
                    }
                    className={cn(
                      'relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40',
                      enabled ? 'bg-primary' : 'bg-border',
                      lastEnabled && 'opacity-50 cursor-not-allowed'
                    )}>

                    <span
                      className={cn(
                        'inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform',
                        enabled ? 'translate-x-6' : 'translate-x-1'
                      )} />

                  </button>
                </div>
              </li>);

          })}
        </ul>
      </Card>
      }

      {/* Accepted Breeds ------------------------------------------------- */}
      {tab === 'animal' &&
      <Card className="p-0 overflow-hidden">
        <div className="p-5 border-b border-border">
          <h2 className="font-heading font-semibold text-lg text-text-primary">
            Accepted Breeds
          </h2>
          <p className="text-sm text-text-secondary mt-1">
            Every breed is accepted by default. Restrict a species to specific
            breeds (e.g. a breed-specific rescue) by adding them below.
          </p>
        </div>
        {enabledSpeciesWithBreeds.length === 0 ?
        <p className="p-5 text-sm text-text-secondary">
            No enabled species have breeds to restrict.
          </p> :

        <ul className="divide-y divide-border">
            {enabledSpeciesWithBreeds.map((s) => {
            const speciesBreeds = breeds.filter((b) => b.species_id === s.id);
            const accepted = acceptedBreedIds(s.id);
            const acceptedSet = new Set(accepted);
            const restricted = accepted.length > 0;
            const remaining = speciesBreeds.filter(
              (b) => !acceptedSet.has(b.id)
            );
            return (
              <li key={s.id} className="px-5 py-4 space-y-2.5">
                  <div className="flex items-center gap-2">
                    <SpeciesIcon
                    iconName={s.icon_name}
                    className="w-4 h-4 text-text-secondary shrink-0" />

                    <span className="font-medium text-text-primary">
                      {s.name}
                    </span>
                    <span className="text-xs text-text-secondary">
                      {restricted ?
                    `Accepting ${accepted.length} of ${speciesBreeds.length} breeds` :
                    'Accepting all breeds'}
                    </span>
                    {restricted &&
                  <button
                    type="button"
                    onClick={() => setAllowedBreeds(s.id, [])}
                    className="ml-auto text-xs font-medium text-text-secondary hover:text-primary transition-colors">

                        Accept all
                      </button>
                  }
                  </div>

                  {restricted &&
                <div className="flex flex-wrap gap-1.5">
                      {accepted.map((bid) => {
                    const b = speciesBreeds.find((x) => x.id === bid);
                    if (!b) return null;
                    return (
                      <span
                        key={bid}
                        className="inline-flex items-center gap-1 rounded-full bg-primary/10 text-primary text-xs font-medium pl-2.5 pr-1 py-1">

                            {b.name}
                            <button
                          type="button"
                          aria-label={`Remove ${b.name}`}
                          onClick={() =>
                          setAllowedBreeds(
                            s.id,
                            accepted.filter((x) => x !== bid)
                          )
                          }
                          className="rounded-full hover:bg-primary/20 p-0.5">

                              <XIcon className="w-3 h-3" />
                            </button>
                          </span>);

                  })}
                    </div>
                }

                  {remaining.length > 0 &&
                <Select
                  aria-label={`Add ${s.name} breed`}
                  value=""
                  onChange={(e) => {
                    if (e.target.value)
                    setAllowedBreeds(s.id, [...accepted, e.target.value]);
                  }}
                  className="max-w-xs">

                      <option value="">
                        {restricted ?
                    'Add another breed…' :
                    'Restrict to specific breeds…'}
                      </option>
                      {remaining.map((b) =>
                  <option key={b.id} value={b.id}>
                          {b.name}
                        </option>
                  )}
                    </Select>
                }
                </li>);

          })}
          </ul>
        }
      </Card>
      }

      {/* Traits — admin-managed trait definitions. */}
      {tab === 'animal' && isAdmin &&
      <Card className="p-0 overflow-hidden">
          <div className="p-5 border-b border-border flex items-start justify-between gap-3">
            <div>
              <h2 className="font-heading font-semibold text-lg text-text-primary">
                Traits
              </h2>
              <p className="text-sm text-text-secondary mt-1">
                Behavioral and placement labels you can assign to animals.
                Deactivate (rather than delete) to keep history intact.
              </p>
            </div>
            <Button
            size="sm"
            onClick={() => setTraitForm({ open: true })}
            className="shrink-0">

              <PlusIcon className="w-4 h-4 mr-1.5" /> New trait
            </Button>
          </div>
          <ul className="divide-y divide-border max-h-[28rem] overflow-y-auto">
            {[...traits].
          sort((a, b) => a.name.localeCompare(b.name)).
          map((t) => {
            const scope = t.species_id ?
            species.find((s) => s.id === t.species_id)?.name ?? 'Species' :
            'All species';
            return (
              <li
                key={t.id}
                className="flex items-center justify-between gap-4 px-5 py-3">

                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span
                      className={cn(
                        'font-medium',
                        t.active ?
                        'text-text-primary' :
                        'text-text-secondary line-through'
                      )}>

                        {t.name}
                      </span>
                      <span className="text-xs text-text-secondary bg-background border border-border rounded-md px-1.5 py-0.5">
                        {scope}
                      </span>
                      {!t.active &&
                    <span className="text-xs text-text-secondary">Inactive</span>
                    }
                    </div>
                    {t.description &&
                  <p className="text-xs text-text-secondary mt-0.5 truncate">
                        {t.description}
                      </p>
                  }
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <button
                    type="button"
                    onClick={() => updateTrait(t.id, { active: !t.active })}
                    className="text-xs font-medium text-text-secondary hover:text-primary transition-colors">

                      {t.active ? 'Deactivate' : 'Reactivate'}
                    </button>
                    <button
                    type="button"
                    aria-label={`Edit ${t.name}`}
                    onClick={() => setTraitForm({ open: true, trait: t })}
                    className="p-1 rounded-md text-text-secondary hover:text-text-primary hover:bg-background transition-colors">

                      <PencilIcon className="w-4 h-4" />
                    </button>
                  </div>
                </li>);

          })}
          </ul>
        </Card>
      }

      {/* Saved Locations — admin-curated places for transport pickup/dropoff. */}
      {tab === 'locations' && isAdmin &&
      <Card className="p-0 overflow-hidden">
          <div className="p-5 border-b border-border flex items-start justify-between gap-3">
            <div>
              <h2 className="font-heading font-semibold text-lg text-text-primary">
                Saved Locations
              </h2>
              <p className="text-sm text-text-secondary mt-1">
                Reusable places (clinic, common foster homes) members can pick
                when requesting transport. Deactivate to retire one without
                losing past requests.
              </p>
            </div>
            <Button
            size="sm"
            onClick={() => setLocationForm({ open: true })}
            className="shrink-0">

              <PlusIcon className="w-4 h-4 mr-1.5" /> New location
            </Button>
          </div>
          {savedLocations.length === 0 ?
          <p className="px-5 py-6 text-sm text-text-secondary">
              No saved locations yet.
            </p> :

          <ul className="divide-y divide-border max-h-[28rem] overflow-y-auto">
            {[...savedLocations].
            sort((a, b) => a.name.localeCompare(b.name)).
            map((loc) =>
            <li
              key={loc.id}
              className="flex items-center justify-between gap-4 px-5 py-3">

                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span
                      className={cn(
                        'font-medium',
                        loc.active ?
                        'text-text-primary' :
                        'text-text-secondary line-through'
                      )}>

                        {loc.name}
                      </span>
                      {!loc.active &&
                    <span className="text-xs text-text-secondary">Inactive</span>
                    }
                    </div>
                    <div className="text-xs text-text-secondary mt-0.5 truncate">
                      <AddressDisplay value={loc.address} singleLine />
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <button
                    type="button"
                    onClick={() =>
                    updateSavedLocation(loc.id, { active: !loc.active })
                    }
                    className="text-xs font-medium text-text-secondary hover:text-primary transition-colors">

                      {loc.active ? 'Deactivate' : 'Reactivate'}
                    </button>
                    <button
                    type="button"
                    aria-label={`Edit ${loc.name}`}
                    onClick={() => setLocationForm({ open: true, location: loc })}
                    className="p-1 rounded-md text-text-secondary hover:text-text-primary hover:bg-background transition-colors">

                      <PencilIcon className="w-4 h-4" />
                    </button>
                  </div>
                </li>
            )}
            </ul>
          }
        </Card>
      }

      {/* Adoption Profiles — admin-managed posting template. */}
      {tab === 'animal' && isAdmin && <AdoptionTemplateEditor />}

      {/* Navigation — show/hide sidebar tabs the org doesn't use. */}
      {tab === 'navigation' && isAdmin &&
      <Card className="p-0 overflow-hidden">
        <div className="p-5 border-b border-border flex items-start justify-between gap-3">
          <div>
            <h2 className="font-heading font-semibold text-lg text-text-primary">
              Sidebar Tabs
            </h2>
            <p className="text-sm text-text-secondary mt-1">
              Hide tabs your organization doesn’t use to simplify the sidebar.
              Hidden tabs are removed from the sidebar only — this does not change
              user permissions or block direct access by URL.
            </p>
          </div>
          <button
            type="button"
            onClick={restoreNavigationDefaults}
            className="shrink-0 text-xs font-medium text-text-secondary hover:text-primary transition-colors">
            Restore defaults
          </button>
        </div>
        <div className="px-5 py-3 border-b border-border bg-background/40 text-sm">
          <span className="font-medium text-text-primary">
            {visibleTabCount} of {navItems.length} tabs visible
          </span>
          {hiddenTabs.length > 0 &&
          <span className="text-text-secondary">
              {' '}· Hidden: {hiddenTabs.map((i) => i.label).join(', ')}
            </span>
          }
        </div>
        <ul className="divide-y divide-border">
          {navItems.map((item) => {
            const visible = item.locked || isTabVisible(item.key);
            return (
              <li
                key={item.key}
                className="flex items-center justify-between gap-4 px-5 py-3.5">

                <div className="flex items-center gap-3 min-w-0">
                  <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-background text-text-secondary shrink-0">
                    <item.icon className="w-4 h-4" />
                  </span>
                  <span className="font-medium text-text-primary">
                    {item.label}
                  </span>
                </div>
                {item.locked ?
                <span className="text-xs font-medium text-text-secondary bg-background border border-border px-2 py-0.5 rounded-full shrink-0">
                    Always on
                  </span> :

                <button
                  type="button"
                  role="switch"
                  aria-checked={visible}
                  aria-label={`${visible ? 'Hide' : 'Show'} ${item.label}`}
                  onClick={() => setTabVisible(item.key, !visible)}
                  className={cn(
                    'relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 shrink-0',
                    visible ? 'bg-primary' : 'bg-border'
                  )}>

                  <span
                    className={cn(
                      'inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform',
                      visible ? 'translate-x-6' : 'translate-x-1'
                    )} />

                </button>
                }
              </li>);

          })}
        </ul>
      </Card>
      }

      {/* Member Permissions — grant non-admins specific management access. */}
      {tab === 'permissions' && isAdmin &&
      <Card className="p-0 overflow-hidden">
        <div className="p-5 border-b border-border">
          <h2 className="font-heading font-semibold text-lg text-text-primary">
            Member Permissions
          </h2>
          <p className="text-sm text-text-secondary mt-1">
            Every member can view animals. Grant specific members the ability to
            manage them. Owners and admins always have full access.
          </p>
        </div>
        <div className="p-5 space-y-6">
          <MemberPermissionManager
            permissionType="MANAGE_ANIMALS"
            title="Animal Management"
            description="Add, edit, and delete animals and litters, and manage relationships." />

          <MemberPermissionManager
            permissionType="MANAGE_MEDICAL"
            title="Medical & Clinics"
            description="Add and edit medical records and run spay/neuter & vaccine clinics." />

          <MemberPermissionManager
            permissionType="MANAGE_EXTERNAL_LISTINGS"
            title="External Listings"
            description="Manage public adoption posts (Petfinder, the org site, social…)." />

          <MemberPermissionManager
            permissionType="MANAGE_SITES"
            title="Rescue Sites"
            description="Create and edit rescue sites — colonies, pickups, and trapping locations." />

        </div>
      </Card>
      }

      {/* General — org-wide settings (timezone). Admin-only. */}
      {tab === 'general' && isAdmin &&
      <Card className="p-0 overflow-hidden">
        <div className="p-5 border-b border-border">
          <h2 className="font-heading font-semibold text-lg text-text-primary">
            Time zone
          </h2>
          <p className="text-sm text-text-secondary mt-1">
            Used to show clinic dates and times in notifications (e.g. “a clinic
            appointment on June 20 at 9:00 AM”). Set this to your rescue’s local zone.
          </p>
        </div>
        <div className="p-5">
          <Select
            className="max-w-sm"
            value={currentOrg?.timezone ?? 'America/Los_Angeles'}
            onChange={(e) => updateOrgTimezone(e.target.value)}>
            {TIMEZONES.map((tz) =>
            <option key={tz.value} value={tz.value}>
                {tz.label}
              </option>
            )}
            {/* Surface an unrecognized stored value so it isn't silently lost. */}
            {currentOrg?.timezone &&
            !TIMEZONES.some((t) => t.value === currentOrg.timezone) &&
            <option value={currentOrg.timezone}>{currentOrg.timezone}</option>
            }
          </Select>
        </div>
      </Card>
      }

      {/* Reports visibility — org-wide. Admin-only. */}
      {tab === 'general' && isAdmin &&
      <Card className="p-0 overflow-hidden">
        <div className="p-5 flex items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-1.5">
              <h2 className="font-heading font-semibold text-lg text-text-primary">
                Show All Reports to Everyone
              </h2>
              <Tooltip
                content="When on, every member can see all report sections — including Rescue Sites and Supply spend (financial data). When off, report sections follow each member’s permissions; sensitive sections stay limited to owners, admins, and members granted access.">
                <InfoIcon className="w-4 h-4 text-text-secondary" />
              </Tooltip>
            </div>
            <p className="text-sm text-text-secondary mt-1">
              Full transparency for orgs that want it. Off by default — reports
              follow each member’s permissions.
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={!!currentOrg?.show_all_reports}
            aria-label="Show all reports to everyone"
            onClick={() =>
            updateOrgShowAllReports(!currentOrg?.show_all_reports)
            }
            className={cn(
              'relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 shrink-0',
              currentOrg?.show_all_reports ? 'bg-primary' : 'bg-border'
            )}>

            <span
              className={cn(
                'inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform',
                currentOrg?.show_all_reports ? 'translate-x-6' : 'translate-x-1'
              )} />

          </button>
        </div>
      </Card>
      }

      <TraitFormModal
        isOpen={traitForm.open}
        onClose={() => setTraitForm({ open: false })}
        trait={traitForm.trait} />

      <SavedLocationFormModal
        isOpen={locationForm.open}
        onClose={() => setLocationForm({ open: false })}
        location={locationForm.location} />

    </div>);

}
