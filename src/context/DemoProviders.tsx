import React, { useState, useMemo } from 'react';
import { AuthContext, AuthContextType, Org } from './AuthContext';
import { WhiskerContext, WhiskerContextType } from './WhiskerContext';
import {
  Animal,
  FosterPlacement,
  MedicalRecord,
  AnimalNote,
  AnimalRelationship,
  AnimalExternalListing,
  MemberPermission,
  OrgMember,
  AnimalPhoto,
  Person,
  PersonRole,
  Product,
  SupplyRequest,
  SupplyRequestItem,
  TransportRequest,
  SittingRequest,
  SittingRequestPlacement,
  ClinicEvent,
  ClinicSlot,
  ClinicSlotProcedure,
  AnimalActionItem,
  Litter,
  Site,
  SiteNote,
  SiteVolunteer,
  Adoption } from
'../types';
import { NewPhotoInput } from '../lib/photosApi';
import { legacyRoleFor } from '../lib/peopleApi';
import {
  seedAnimals,
  seedBreeds,
  seedSpecies,
  seedOrganizationSpecies,
  seedOrganizationBreeds,
  seedTraits,
  seedAnimalTraits,
  seedPlacements,
  seedMedicalRecords,
  seedNotes,
  seedActionItems,
  seedRelationships,
  seedExternalListings,
  seedOrgMembers,
  seedMemberPermissions,
  seedPhotos,
  seedPeople,
  seedProducts,
  seedSupplyRequests,
  seedSupplyRequestItems,
  seedTransportRequests,
  seedSittingRequests,
  seedSittingRequestPlacements,
  seedClinicEvents,
  seedClinicSlots,
  seedClinicSlotProcedures,
  seedLitters,
  seedSites,
  seedSiteNotes,
  seedSiteVolunteers,
  seedAdoptions } from
'../data/seed';
import { generateId } from '../lib/utils';
import { adoptionStatusPatch } from '../lib/adoptions';

// ============================================================
// Demo mode providers — public portfolio. No auth, no Supabase.
// Seed data lives in memory; mutations are local and reset on refresh.
// Both providers feed the SAME contexts as production, so every page,
// component, and hook (`useWhisker` / `useAuth`) works unchanged.
// ============================================================

const DEMO_ORG: Org = {
  id: 'demo-org',
  name: 'Alley Cat Project (Demo)',
  role: 'owner'
};

// 'p_dan' is a seed Person, so attribution reads as a real name.
const demoAuthValue: AuthContextType = {
  loading: false,
  session: null,
  user: null,
  orgsLoading: false,
  organizations: [DEMO_ORG],
  currentOrg: DEMO_ORG,
  setCurrentOrgId: () => {},
  refreshOrganizations: async () => {},
  currentPersonId: 'p_dan',
  currentMemberId: 'm_dan',
  signInWithGoogle: async () => {},
  signInWithPassword: async () => ({ error: null }),
  signUpWithPassword: async () => ({ error: null, needsConfirmation: false }),
  signOut: async () => {}
};

export function DemoAuthProvider({ children }: { children: React.ReactNode }) {
  return (
    <AuthContext.Provider value={demoAuthValue}>
      {children}
    </AuthContext.Provider>);

}

export function DemoWhiskerProvider({
  children
}: {
  children: React.ReactNode;
}) {
  const [animals, setAnimals] = useState<Animal[]>(seedAnimals);
  const [placements, setPlacements] =
  useState<FosterPlacement[]>(seedPlacements);
  const [medicalRecords, setMedicalRecords] =
  useState<MedicalRecord[]>(seedMedicalRecords);
  const [notes, setNotes] = useState<AnimalNote[]>(seedNotes);
  const [actionItems, setActionItems] =
  useState<AnimalActionItem[]>(seedActionItems);
  const [relationships, setRelationships] =
  useState<AnimalRelationship[]>(seedRelationships);
  const [externalListings, setExternalListings] =
  useState<AnimalExternalListing[]>(seedExternalListings);
  const [orgMembers] = useState<OrgMember[]>(seedOrgMembers);
  const [memberPermissions, setMemberPermissions] = useState<MemberPermission[]>(
    seedMemberPermissions
  );
  const [photos, setPhotos] = useState<AnimalPhoto[]>(seedPhotos);
  const [litters, setLitters] = useState<Litter[]>(seedLitters);
  const [adoptions, setAdoptions] = useState<Adoption[]>(seedAdoptions);
  const [people, setPeople] = useState<Person[]>(seedPeople);
  // Fosters are a derived view of people (those with the 'foster_parent' role).
  const fosters = people.filter((p) => p.roles.includes('foster_parent'));
  const [products, setProducts] = useState<Product[]>(seedProducts);
  const [supplyRequests, setSupplyRequests] =
  useState<SupplyRequest[]>(seedSupplyRequests);
  const [supplyRequestItems, setSupplyRequestItems] =
  useState<SupplyRequestItem[]>(seedSupplyRequestItems);
  const [transportRequests, setTransportRequests] =
  useState<TransportRequest[]>(seedTransportRequests);
  const [sittingRequests, setSittingRequests] =
  useState<SittingRequest[]>(seedSittingRequests);
  const [sittingRequestPlacements, setSittingRequestPlacements] =
  useState<SittingRequestPlacement[]>(seedSittingRequestPlacements);
  const [clinicEvents, setClinicEvents] =
  useState<ClinicEvent[]>(seedClinicEvents);
  const [clinicSlots, setClinicSlots] =
  useState<ClinicSlot[]>(seedClinicSlots);
  const [clinicSlotProcedures, setClinicSlotProcedures] = useState<
    ClinicSlotProcedure[]>(
    seedClinicSlotProcedures);
  const [sites, setSites] = useState<Site[]>(seedSites);
  const [siteNotes, setSiteNotes] = useState<SiteNote[]>(seedSiteNotes);
  const [siteVolunteers, setSiteVolunteers] =
  useState<SiteVolunteer[]>(seedSiteVolunteers);

  const [organizationSpecies, setOrganizationSpecies] = useState(
    seedOrganizationSpecies
  );
  const [organizationBreeds, setOrganizationBreeds] = useState(
    seedOrganizationBreeds
  );
  // Mirror production: derive the species display name from species_id.
  const enrichedAnimals = useMemo(() => {
    const nameById = new Map(seedSpecies.map((s) => [s.id, s.name]));
    return animals.map((a) =>
    a.species_id ? { ...a, species: nameById.get(a.species_id) ?? a.species } : a
    );
  }, [animals]);

  const now = () => new Date().toISOString();

  const [traits, setTraits] = useState(seedTraits);
  const addTrait = (t: {
    name: string;
    description?: string;
    species_id?: string;
    active?: boolean;
  }) =>
  setTraits((prev) => [
  ...prev,
  {
    id: `tr_new_${prev.length}`,
    organization_id: 'demo-org',
    name: t.name,
    description: t.description,
    species_id: t.species_id,
    active: t.active ?? true,
    created_at: now(),
    updated_at: now()
  }]
  );
  const updateTrait = (id: string, updates: Partial<(typeof seedTraits)[number]>) =>
  setTraits((prev) =>
  prev.map((t) => t.id === id ? { ...t, ...updates, updated_at: now() } : t)
  );
  const [animalTraits, setAnimalTraits_] = useState(seedAnimalTraits);
  const setAnimalTraits = (animalId: string, traitIds: string[]) =>
  setAnimalTraits_((prev) => [
  ...prev.filter((t) => t.animal_id !== animalId),
  ...traitIds.map((tid, i) => ({
    id: `at_${animalId}_${i}`,
    organization_id: 'demo-org',
    animal_id: animalId,
    trait_id: tid
  }))]
  );

  const setAllowedBreeds = (speciesId: string, breedIds: string[]) => {
    const sb = new Set(
      seedBreeds.filter((b) => b.species_id === speciesId).map((b) => b.id)
    );
    setOrganizationBreeds((prev) => [
    ...prev.filter((r) => !sb.has(r.breed_id)),
    ...breedIds.map((bid) => ({
      id: `ob_${bid}`,
      organization_id: 'demo-org',
      breed_id: bid,
      is_enabled: true,
      sort_order: 0
    }))]
    );
  };

  const setSpeciesEnabled = (speciesId: string, enabled: boolean) =>
  setOrganizationSpecies((prev) =>
  prev.map((r) =>
  r.species_id === speciesId ?
  { ...r, is_enabled: enabled, is_default: enabled ? r.is_default : false } :
  r
  )
  );
  const setDefaultSpecies = (speciesId: string) =>
  setOrganizationSpecies((prev) =>
  prev.map((r) => ({
    ...r,
    is_default: r.species_id === speciesId,
    is_enabled: r.species_id === speciesId ? true : r.is_enabled
  }))
  );

  const updateAnimal = (id: string, updates: Partial<Animal>) =>
  setAnimals((prev) =>
  prev.map((a) =>
  a.id === id ? { ...a, ...updates, updated_at: now() } : a
  )
  );

  const value: WhiskerContextType = {
    animals: enrichedAnimals,
    animalsLoading: false,
    // Demo holds every animal in memory already, so the index is the same set
    // and historical data is always "loaded" — the in-care default still works
    // because AnimalsList filters by status, not by what's been fetched.
    animalsIndex: enrichedAnimals,
    animalsIndexLoading: false,
    historicalLoaded: true,
    ensureHistoricalLoaded: async () => {},
    ensureAnimal: async (id: string) =>
    enrichedAnimals.find((a) => a.id === id) ?? null,
    fosters,
    fostersLoading: false,
    placements,
    medicalRecords,
    notes,
    actionItems,
    relationships,
    externalListings,
    orgMembers,
    memberPermissions,
    grantSupplyPermission: (memberId: string) =>
    setMemberPermissions((prev) =>
    prev.some(
      (p) =>
      p.member_id === memberId &&
      p.permission_type === 'MANAGE_SUPPLY_REQUESTS' &&
      p.is_active
    ) ?
    prev :
    [
    ...prev,
    {
      id: `mp${generateId()}`,
      organization_id: 'demo-org',
      member_id: memberId,
      permission_type: 'MANAGE_SUPPLY_REQUESTS',
      is_active: true,
      starts_at: new Date().toISOString()
    }]
    ),
    revokeSupplyPermission: (memberId: string) =>
    setMemberPermissions((prev) =>
    prev.map((p) =>
    p.member_id === memberId &&
    p.permission_type === 'MANAGE_SUPPLY_REQUESTS' ?
    { ...p, is_active: false } :
    p
    )
    ),
    photos,
    people,
    // Demo holds every contact in memory, so the index is the same set and
    // inactive data is always "loaded" — the active-only default still works
    // because the Contacts/Fosters pages filter by `active`, not by what's
    // been fetched.
    peopleIndex: people,
    peopleIndexLoading: false,
    inactiveLoaded: true,
    ensureInactiveLoaded: async () => {},
    ensurePerson: async (id: string) =>
    people.find((p) => p.id === id) ?? null,
    peopleLoading: false,
    litters,
    littersLoading: false,
    adoptions,
    adoptionsLoading: false,
    species: seedSpecies,
    breeds: seedBreeds,
    organizationSpecies,
    organizationBreeds,
    setSpeciesEnabled,
    setDefaultSpecies,
    setAllowedBreeds,
    traits,
    animalTraits,
    setAnimalTraits,
    addTrait,
    updateTrait,
    products,
    supplyRequests,
    supplyRequestItems,
    transportRequests,
    sittingRequests,
    sittingRequestPlacements,
    clinicEvents,
    clinicSlots,

    addAnimal: async (animal) => {
      const created = {
        ...animal,
        id: `a${generateId()}`,
        created_at: now(),
        updated_at: now()
      };
      setAnimals((prev) => [created, ...prev]);
      return created;
    },
    updateAnimal,
    deleteAnimal: (id) =>
    setAnimals((prev) => prev.filter((a) => a.id !== id)),
    addLitter: async (shared, members) => {
      const litterId = `litter${generateId()}`;
      setLitters((prev) => [
      {
        id: litterId,
        name: shared.name,
        species: shared.species,
        breed_id: shared.breed_id,
        breed_text: shared.breed_text,
        estimated_birth_date: shared.estimated_birth_date,
        intake_date: shared.intake_date,
        intake_source: shared.intake_source,
        mother_animal_id: shared.mother_animal_id,
        notes: shared.notes
      },
      ...prev]
      );
      const created: Animal[] = members.map((m) => ({
        id: `a${generateId()}`,
        name: m.name,
        species: shared.species,
        sex: m.sex,
        breed_id: shared.breed_id,
        breed_text: shared.breed_text,
        estimated_birth_date: shared.estimated_birth_date ?? '',
        birthdate_source: shared.birthdate_source,
        estimated_age_value: shared.estimated_age_value,
        estimated_age_unit: shared.estimated_age_unit,
        estimated_age_as_of: shared.estimated_age_as_of,
        intake_date: shared.intake_date,
        intake_source: shared.intake_source ?? '',
        site_id: shared.site_id,
        status: 'intake',
        priority: 'normal',
        description: m.description ?? '',
        litter_id: litterId,
        created_at: now(),
        updated_at: now()
      }));
      setAnimals((prev) => [...created, ...prev]);
    },
    updateLitter: (id, updates) =>
    setLitters((prev) =>
    prev.map((l) => l.id === id ? { ...l, ...updates } : l)
    ),

    // Fosters are people that include the 'foster_parent' role.
    addFoster: (foster) => {
      const roles: PersonRole[] = foster.roles.includes('foster_parent') ?
      foster.roles :
      ['foster_parent', ...foster.roles];
      setPeople((prev) => [
      {
        ...foster,
        id: `f${generateId()}`,
        role: legacyRoleFor(roles),
        roles,
        created_at: now()
      },
      ...prev]
      );
    },
    updateFoster: (id, updates) =>
    setPeople((prev) =>
    prev.map((p) =>
    p.id === id ?
    {
      ...p,
      ...updates,
      ...(updates.roles ? { role: legacyRoleFor(updates.roles) } : {})
    } :
    p
    )
    ),

    addMedicalRecord: (record) =>
    setMedicalRecords((prev) => [
    { ...record, id: `m${generateId()}` },
    ...prev]
    ),
    updateMedicalRecord: (id, updates) =>
    setMedicalRecords((prev) =>
    prev.map((m) => m.id === id ? { ...m, ...updates } : m)
    ),

    addNote: (note) =>
    setNotes((prev) => [
    { ...note, id: `n${generateId()}`, created_at: now() },
    ...prev]
    ),

    addActionItem: (item) =>
    setActionItems((prev) => [
    {
      ...item,
      id: `ai${generateId()}`,
      status: 'open',
      created_at: now()
    },
    ...prev]
    ),
    updateActionItem: (id, updates) =>
    setActionItems((prev) =>
    prev.map((a) => a.id === id ? { ...a, ...updates } : a)
    ),
    completeActionItem: (id, completionNote) =>
    setActionItems((prev) =>
    prev.map((a) =>
    a.id === id ?
    {
      ...a,
      status: 'completed',
      completed_at: now(),
      completed_by: 'demo',
      completion_note: completionNote || undefined
    } :
    a
    )
    ),
    cancelActionItem: (id, completionNote) =>
    setActionItems((prev) =>
    prev.map((a) =>
    a.id === id ?
    {
      ...a,
      status: 'cancelled',
      completed_at: now(),
      completed_by: 'demo',
      completion_note: completionNote || undefined
    } :
    a
    )
    ),

    addPlacement: (placement) =>
    setPlacements((prev) => [
    { ...placement, id: `p${generateId()}` },
    ...prev]
    ),
    updatePlacement: (id, updates) =>
    setPlacements((prev) =>
    prev.map((p) => p.id === id ? { ...p, ...updates } : p)
    ),

    addPerson: async (person) => {
      const created: Person = {
        ...person,
        id: `pe${generateId()}`,
        created_at: now()
      };
      setPeople((prev) => [created, ...prev]);
      return created;
    },
    updatePerson: (id, updates) =>
    setPeople((prev) =>
    prev.map((p) => p.id === id ? { ...p, ...updates } : p)
    ),
    // No Storage in demo — preview the chosen file via an object URL.
    uploadPersonPhoto: async (personId, file) => {
      const url = URL.createObjectURL(file);
      setPeople((prev) =>
      prev.map((p) => p.id === personId ? { ...p, photo_url: url } : p)
      );
    },

    // — Adoptions —
    addAdoption: async ({ animal_id, adopter_id, notes }) => {
      setAdoptions((prev) => [
      {
        id: `ad${generateId()}`,
        animal_id,
        adopter_id,
        status: 'inquiry',
        notes,
        created_at: now()
      },
      ...prev]
      );
      setPeople((prev) =>
      prev.map((p) =>
      p.id === adopter_id && !p.roles.includes('adopter') ?
      {
        ...p,
        roles: [...p.roles, 'adopter'],
        role: legacyRoleFor([...p.roles, 'adopter'])
      } :
      p
      )
      );
      updateAnimal(animal_id, { is_on_hold: true });
    },
    updateAdoption: (id, updates) => {
      setAdoptions((prev) =>
      prev.map((a) => a.id === id ? { ...a, ...updates } : a)
      );
    },
    setAdoptionStatus: (id, status) =>
    setAdoptions((prev) =>
    prev.map((a) =>
    a.id === id ? { ...a, ...adoptionStatusPatch(a, status) } : a
    )
    ),
    completeAdoption: (id, donationAmount) => {
      const adoption = adoptions.find((a) => a.id === id);
      if (!adoption) return;
      const ts = now();
      setAdoptions((prev) =>
      prev.map((a) =>
      a.id === id ?
      {
        ...a,
        status: 'completed',
        completed_at: ts,
        ...(donationAmount != null ? { donation_amount: donationAmount } : {})
      } :
      a
      )
      );
      updateAnimal(adoption.animal_id, {
        status: 'adopted',
        adopted_by_id: adoption.adopter_id,
        adopted_at: ts,
        current_foster_id: undefined,
        is_on_hold: false
      });
      setPlacements((prev) =>
      prev.map((p) =>
      p.animal_id === adoption.animal_id && p.placement_status === 'active' ?
      {
        ...p,
        placement_status: 'completed' as const,
        end_date: ts.split('T')[0],
        reason_ended: 'Adopted'
      } :
      p
      )
      );
      setPeople((prev) =>
      prev.map((p) =>
      p.id === adoption.adopter_id && !p.roles.includes('adopter') ?
      {
        ...p,
        roles: [...p.roles, 'adopter'],
        role: legacyRoleFor([...p.roles, 'adopter'])
      } :
      p
      )
      );
    },
    cancelAdoption: (id, reason) => {
      const adoption = adoptions.find((a) => a.id === id);
      setAdoptions((prev) =>
      prev.map((a) =>
      a.id === id ?
      {
        ...a,
        status: 'cancelled',
        cancelled_at: now(),
        ...(reason && reason.trim() ? { notes: reason.trim() } : {})
      } :
      a
      )
      );
      if (adoption) {
        updateAnimal(adoption.animal_id, { is_on_hold: false });
      }
    },
    returnAdoption: (id, input) => {
      const adoption = adoptions.find((a) => a.id === id);
      if (!adoption) return;
      setAdoptions((prev) =>
      prev.map((a) =>
      a.id === id ?
      {
        ...a,
        status: 'returned',
        returned_at: input.returned_at,
        return_reason: input.return_reason,
        return_notes: input.return_notes?.trim() || undefined
      } :
      a
      )
      );
      updateAnimal(adoption.animal_id, {
        status: 'intake',
        adopted_by_id: undefined,
        adopted_at: undefined,
        is_on_hold: false
      });
    },
    recordAdoptionReturn: async (input) => {
      setAdoptions((prev) => [
      {
        id: `ad${generateId()}`,
        animal_id: input.animal_id,
        adopter_id: input.adopter_id,
        status: 'returned',
        returned_at: input.returned_at,
        return_reason: input.return_reason,
        return_notes: input.return_notes?.trim() || undefined,
        created_at: now()
      },
      ...prev]
      );
      setPeople((prev) =>
      prev.map((p) =>
      p.id === input.adopter_id && !p.roles.includes('adopter') ?
      {
        ...p,
        roles: [...p.roles, 'adopter'],
        role: legacyRoleFor([...p.roles, 'adopter'])
      } :
      p
      )
      );
      updateAnimal(input.animal_id, {
        status: 'intake',
        adopted_by_id: undefined,
        adopted_at: undefined,
        is_on_hold: false
      });
    },

    addPhoto: async (input: NewPhotoInput) => {
      const url = input.file ?
      URL.createObjectURL(input.file) :
      input.url?.trim() ?? '';
      if (!url) return;
      const newPhoto: AnimalPhoto = {
        id: `ph${generateId()}`,
        animal_id: input.animal_id,
        url,
        category: input.category,
        caption: input.caption,
        uploaded_at: now()
      };
      setPhotos((prev) => [newPhoto, ...prev]);
      const animal = animals.find((a) => a.id === input.animal_id);
      if (input.setAsProfile || animal && !animal.primary_photo_url) {
        updateAnimal(input.animal_id, { primary_photo_url: url });
      }
    },
    deletePhoto: (id) =>
    setPhotos((prev) => prev.filter((p) => p.id !== id)),

    addRelationship: (rel) =>
    setRelationships((prev) => [
    { ...rel, id: `r${generateId()}` },
    ...prev]
    ),
    deleteRelationship: (id) =>
    setRelationships((prev) => prev.filter((r) => r.id !== id)),

    addExternalListing: (listing) =>
    setExternalListings((prev) => [
    {
      ...listing,
      id: `el${generateId()}`,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    },
    ...prev]
    ),
    updateExternalListing: (id, updates) =>
    setExternalListings((prev) =>
    prev.map((l) => l.id === id ? { ...l, ...updates } : l)
    ),
    deleteExternalListing: (id) =>
    setExternalListings((prev) => prev.filter((l) => l.id !== id)),

    placeAnimal: (
    animal_id,
    person_id,
    start_date,
    notes,
    expected_end_date,
    placement_purpose = 'general_foster') =>
    {
      setPlacements((prev) => [
      {
        id: `p${generateId()}`,
        animal_id,
        person_id,
        start_date,
        expected_end_date,
        placement_status: 'active',
        placement_type: 'foster',
        placement_purpose,
        notes
      },
      ...prev]
      );
      // Placing with someone makes them a foster parent (mirror live context).
      setPeople((prev) =>
      prev.map((p) =>
      p.id === person_id && !p.roles.includes('foster_parent') ?
      { ...p, roles: ['foster_parent', ...p.roles] } :
      p
      )
      );
      // Fostered is derived from the active placement; lifecycle status is left alone.
      updateAnimal(animal_id, {
        current_foster_id: person_id
      });
    },
    reassignFoster: (
    animal_id,
    new_person_id,
    start_date,
    reason_ended,
    notes,
    expected_end_date,
    placement_purpose = 'general_foster') =>
    {
      setPlacements((prev) => {
        const closed = prev.map((p) =>
        p.animal_id === animal_id && p.placement_status === 'active' ?
        {
          ...p,
          placement_status: 'completed' as const,
          end_date: start_date,
          reason_ended: reason_ended || 'Reassigned to a new foster.'
        } :
        p
        );
        return [
        {
          id: `p${generateId()}`,
          animal_id,
          person_id: new_person_id,
          start_date,
          expected_end_date,
          placement_status: 'active' as const,
          placement_type: 'foster' as const,
          placement_purpose,
          notes
        },
        ...closed];

      });
      setPeople((prev) =>
      prev.map((p) =>
      p.id === new_person_id && !p.roles.includes('foster_parent') ?
      { ...p, roles: ['foster_parent', ...p.roles] } :
      p
      )
      );
      updateAnimal(animal_id, {
        current_foster_id: new_person_id
      });
    },

    addProduct: (product) =>
    setProducts((prev) => [
    { ...product, id: `prod${generateId()}` },
    ...prev]
    ),
    updateProduct: (id, updates) =>
    setProducts((prev) =>
    prev.map((p) => p.id === id ? { ...p, ...updates } : p)
    ),

    addSupplyRequest: async (req) => {
      const id = `sr${generateId()}`;
      setSupplyRequests((prev) => [
      { ...req, id, created_at: now(), updated_at: now() },
      ...prev]
      );
      return id;
    },
    updateSupplyRequest: (id, updates) =>
    setSupplyRequests((prev) =>
    prev.map((s) =>
    s.id === id ? { ...s, ...updates, updated_at: now() } : s
    )
    ),
    addSupplyRequestItem: (item) =>
    setSupplyRequestItems((prev) => [
    { ...item, id: `sri${generateId()}` },
    ...prev]
    ),

    addTransportRequest: async (req) => {
      const id = `tr${generateId()}`;
      setTransportRequests((prev) => [
      { ...req, id, created_at: now(), updated_at: now() },
      ...prev]
      );
      return id;
    },
    updateTransportRequest: (id, updates) =>
    setTransportRequests((prev) =>
    prev.map((t) =>
    t.id === id ? { ...t, ...updates, updated_at: now() } : t
    )
    ),
    claimTransportRequest: (id, volunteer_person_id) =>
    setTransportRequests((prev) =>
    prev.map((t) =>
    t.id === id ?
    {
      ...t,
      assigned_volunteer_person_id: volunteer_person_id,
      status: 'claimed' as const,
      updated_at: now()
    } :
    t
    )
    ),

    addSittingRequest: async (req, placement_ids) => {
      const id = `sit${generateId()}`;
      setSittingRequests((prev) => [
      { ...req, id, created_at: now(), updated_at: now() },
      ...prev]
      );
      setSittingRequestPlacements((prev) => [
      ...placement_ids.map((pid) => ({
        id: `srp${generateId()}`,
        sitting_request_id: id,
        foster_placement_id: pid
      })),
      ...prev]
      );
      return id;
    },
    updateSittingRequest: (id, updates) =>
    setSittingRequests((prev) =>
    prev.map((s) =>
    s.id === id ? { ...s, ...updates, updated_at: now() } : s
    )
    ),
    acceptSittingRequest: (id, sitter_person_id) =>
    setSittingRequests((prev) =>
    prev.map((s) =>
    s.id === id ?
    {
      ...s,
      sitter_person_id,
      status: 'claimed' as const,
      updated_at: now()
    } :
    s
    )
    ),

    addClinicEvent: async (event) => {
      const id = `ce${generateId()}`;
      setClinicEvents((prev) => [
      { ...event, id, created_at: now(), updated_at: now() },
      ...prev]
      );
      return id;
    },
    updateClinicEvent: (id, updates) =>
    setClinicEvents((prev) =>
    prev.map((c) =>
    c.id === id ? { ...c, ...updates, updated_at: now() } : c
    )
    ),
    addClinicSlot: async (slot, procedureTypes) => {
      const slotId = `cs${generateId()}`;
      const newSlot = { ...slot, id: slotId };
      setClinicSlots((prev) => [newSlot, ...prev]);
      if (procedureTypes.length) {
        setClinicSlotProcedures((prev) => [
        ...procedureTypes.map((t) => ({
          id: `csp${generateId()}`,
          clinic_slot_id: slotId,
          procedure_type: t,
          completed: false
        })),
        ...prev]
        );
      }
      return newSlot;
    },
    updateClinicSlot: (id, updates) =>
    setClinicSlots((prev) =>
    prev.map((s) => s.id === id ? { ...s, ...updates } : s)
    ),
    deleteClinicSlot: (id) => {
      setClinicSlots((prev) => prev.filter((s) => s.id !== id));
      setClinicSlotProcedures((prev) =>
      prev.filter((p) => p.clinic_slot_id !== id)
      );
    },
    clinicSlotProcedures,
    addClinicSlotProcedure: (clinic_slot_id, procedure_type, opts) =>
    setClinicSlotProcedures((prev) => [
    {
      id: `csp${generateId()}`,
      clinic_slot_id,
      procedure_type,
      completed: opts?.completed ?? false
    },
    ...prev]
    ),
    updateClinicSlotProcedure: (id, updates) =>
    setClinicSlotProcedures((prev) =>
    prev.map((p) => p.id === id ? { ...p, ...updates } : p)
    ),
    deleteClinicSlotProcedure: (id) =>
    setClinicSlotProcedures((prev) => prev.filter((p) => p.id !== id)),
    // Rescue Sites
    sites,
    siteNotes,
    siteVolunteers,
    addSiteVolunteer: (vol) =>
    setSiteVolunteers((prev) =>
    prev.some(
      (v) => v.site_id === vol.site_id && v.contact_id === vol.contact_id
    ) ?
    prev :
    [
    ...prev,
    {
      ...vol,
      id: `svol${generateId()}`,
      added_at: now()
    }]
    ),
    removeSiteVolunteer: (id) =>
    setSiteVolunteers((prev) => prev.filter((v) => v.id !== id)),
    addSite: async (site) => {
      const id = `site${generateId()}`;
      setSites((prev) => [
      {
        ...site,
        id,
        organization_id: 'demo-org',
        created_at: now(),
        updated_at: now()
      },
      ...prev]
      );
      return id;
    },
    updateSite: (id, updates) =>
    setSites((prev) =>
    prev.map((s) =>
    s.id === id ? { ...s, ...updates, updated_at: now() } : s
    )
    ),
    deleteSite: async (id) =>
    setSites((prev) => prev.filter((s) => s.id !== id)),
    addSiteNote: (note) =>
    setSiteNotes((prev) => [
    {
      ...note,
      id: `sn${generateId()}`,
      author_name: 'You',
      created_by: 'u_dan',
      created_at: now()
    },
    ...prev]
    ),
    grantSitePermission: (memberId: string) =>
    setMemberPermissions((prev) =>
    prev.some(
      (p) =>
      p.member_id === memberId &&
      p.permission_type === 'MANAGE_SITES' &&
      p.is_active
    ) ?
    prev :
    [
    ...prev,
    {
      id: `mp${generateId()}`,
      organization_id: 'demo-org',
      member_id: memberId,
      permission_type: 'MANAGE_SITES',
      is_active: true,
      starts_at: new Date().toISOString()
    }]
    ),
    revokeSitePermission: (memberId: string) =>
    setMemberPermissions((prev) =>
    prev.map((p) =>
    p.member_id === memberId && p.permission_type === 'MANAGE_SITES' ?
    { ...p, is_active: false } :
    p
    )
    ),
    // Demo mode has no real archive layer (the demo store is in-memory),
    // so these are stubs that no-op against the seed. Recycle Bin returns
    // an empty list. This keeps the contract while ensuring demo never
    // pretends to permanently remove seed records.
    archiveRecord: async () => {},
    restoreRecord: async () => {},
    fetchArchived: async () => []
  };

  return (
    <WhiskerContext.Provider value={value}>
      {children}
    </WhiskerContext.Provider>);

}
