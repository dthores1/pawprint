import React, { useState } from 'react';
import { XIcon, PlusIcon, PencilIcon } from 'lucide-react';
import { useWhisker } from '../context/WhiskerContext';
import { useAuth } from '../context/AuthContext';
import { Card } from '../components/ui/Card';
import { Select } from '../components/ui/Forms';
import { Button } from '../components/ui/Button';
import { TraitFormModal } from '../components/settings/TraitFormModal';
import { AdoptionTemplateEditor } from '../components/settings/AdoptionTemplateEditor';
import { SpeciesIcon } from '../lib/speciesIcons';
import { cn } from '../lib/utils';
import { Trait } from '../types';

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
    updateTrait
  } = useWhisker();
  const { currentOrg } = useAuth();
  const isAdmin =
  currentOrg?.role === 'owner' || currentOrg?.role === 'admin';
  const [traitForm, setTraitForm] = useState<{ open: boolean; trait?: Trait }>({
    open: false
  });

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

      {/* Accepted Animal Types ------------------------------------------- */}
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

      {/* Accepted Breeds ------------------------------------------------- */}
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

      {/* Traits — admin-managed trait definitions. */}
      {isAdmin &&
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

      {/* Adoption Profiles — admin-managed posting template. */}
      {isAdmin && <AdoptionTemplateEditor />}

      <TraitFormModal
        isOpen={traitForm.open}
        onClose={() => setTraitForm({ open: false })}
        trait={traitForm.trait} />

    </div>);

}
