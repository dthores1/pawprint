import React, { useState, useMemo, useRef } from 'react';
import { AuthContext, AuthContextType, Org } from './AuthContext';
import { WhiskerContext, WhiskerContextType } from './WhiskerContext';
import {
  Animal,
  FosterPlacement,
  MedicalRecord,
  AnimalNote,
  AnimalRelationship,
  AnimalExternalListing,
  AnimalAiContent,
  OrganizationAdoptionTemplate,
  MemberPermission,
  OrgMember,
  AnimalPhoto,
  AnimalFile,
  Person,
  PersonRole,
  Product,
  SupplyRequest,
  SupplyRequestItem,
  TransportRequest,
  TransportRequestAnimal,
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
  Adoption,
  NotificationItem,
  GuidanceSeen } from
'../types';
import { NewPhotoInput } from '../lib/photosApi';
import { NewFileInput } from '../lib/filesApi';
import { legacyRoleFor } from '../lib/peopleApi';
import {
  seedAnimals,
  seedBreeds,
  seedSpecies,
  seedOrganizationSpecies,
  seedOrganizationBreeds,
  seedTraits,
  seedSavedLocations,
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
  seedAnimalFiles,
  seedPeople,
  seedProducts,
  seedSupplyRequests,
  seedSupplyRequestItems,
  seedTransportRequests,
  seedTransportRequestAnimals,
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
import { DEFAULT_GUIDANCE } from '../lib/guidanceContent';
import { adoptionStatusPatch } from '../lib/adoptions';
import {
  assembleAdoptionProfile,
  animalTemplateVars } from
'../lib/adoptionTemplate';
import { computeAnimalInputsFingerprint } from '../lib/aiContentFingerprint';

// ============================================================
// Demo mode providers — public portfolio. No auth, no Supabase.
// Seed data lives in memory; mutations are local and reset on refresh.
// Both providers feed the SAME contexts as production, so every page,
// component, and hook (`useWhisker` / `useAuth`) works unchanged.
// ============================================================

const DEMO_ORG: Org = {
  id: 'demo-org',
  name: 'Second Chance Animal Rescue (Demo)',
  role: 'owner',
  timezone: 'America/Los_Angeles',
  show_all_reports: false,
  show_guidance: true,
  foster_management_enabled: true
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
  updateOrgTimezone: async () => {},
  updateOrgShowAllReports: async () => {},
  updateOrgShowGuidance: async () => {},
  updateOrgFosterManagement: async () => {},
  currentPersonId: 'p_dan',
  currentMemberId: 'm_dan',
  // "View as" needs real multi-member orgs + auth; inert in demo.
  isViewingAs: false,
  viewingAsName: null,
  canViewAs: false,
  viewAsMember: () => {},
  exitViewAs: () => {},
  signInWithGoogle: async () => {},
  signInWithPassword: async () => ({ error: null }),
  signUpWithPassword: async () => ({ error: null, needsConfirmation: false }),
  signOut: async () => {},
  // Account credential changes need real Supabase auth — inert in the demo.
  updateEmail: async () => ({ error: 'Not available in the demo.' }),
  updatePassword: async () => ({ error: 'Not available in the demo.' }),
  // Passkeys need real Supabase auth; demo mode exposes inert stubs (the UI that
  // calls these is hidden in demo).
  signInWithPasskey: async () => ({ error: null }),
  registerPasskey: async () => ({ error: null }),
  listPasskeys: async () => ({ data: [], error: null }),
  deletePasskey: async () => ({ error: null })
};

export function DemoAuthProvider({ children }: { children: React.ReactNode }) {
  // Foster management is toggleable in-memory so demo visitors can preview
  // the shelter (non-foster) persona from Settings; resets on refresh.
  const [fosterEnabled, setFosterEnabled] = useState(true);
  const value = useMemo<AuthContextType>(() => {
    const org = { ...DEMO_ORG, foster_management_enabled: fosterEnabled };
    return {
      ...demoAuthValue,
      organizations: [org],
      currentOrg: org,
      updateOrgFosterManagement: async (v: boolean) => setFosterEnabled(v)
    };
  }, [fosterEnabled]);
  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>);

}

// A few example notifications so a demo visitor sees the bell badge + a
// populated list immediately. Mix of unread/read; entity ids point at seeded
// demo animals so clicking through navigates somewhere real.
function makeDemoNotifications(): NotificationItem[] {
  const ago = (mins: number) => new Date(Date.now() - mins * 60_000).toISOString();
  const rows: Array<Omit<NotificationItem, 'user_notification_id' | 'notification_id'>> = [
  {
    type: 'clinic_appointment_scheduled',
    title: 'Clinic Appointment Scheduled',
    body: 'Marmalade has been scheduled for a clinic appointment on June 22 at 9:00 AM.',
    entity_type: 'clinic_event',
    entity_id: 'ce1',
    metadata: { animal_name: 'Marmalade' },
    created_at: ago(15)
  },
  {
    type: 'clinic_appointment_reminder',
    title: 'Upcoming Clinic Appointment',
    body: 'Marmalade has a clinic appointment tomorrow at 9:00 AM — ACP Clinic.',
    entity_type: 'clinic_event',
    entity_id: 'ce1',
    metadata: { animal_name: 'Marmalade', location: 'ACP Clinic' },
    created_at: ago(30)
  },
  {
    type: 'transport_reminder_unaccepted',
    title: 'Transport Still Needs Volunteer',
    body: 'Your transport request scheduled for tomorrow has not yet been accepted. Additional coordination may be needed.',
    entity_type: 'transport_request',
    entity_id: 'tr_demo',
    metadata: {},
    created_at: ago(55)
  },
  {
    type: 'foster_placement_ending',
    title: 'Foster Placement Ending Soon',
    body: "Juniper's foster placement is scheduled to end in 3 days.",
    entity_type: 'animal',
    entity_id: 'a3',
    metadata: { animal_name: 'Juniper' },
    created_at: ago(70)
  },
  {
    type: 'foster_placement_assigned',
    title: 'New foster placement',
    body: 'Marmalade was placed in your foster care.',
    entity_type: 'animal',
    entity_id: 'a2',
    metadata: { animal_name: 'Marmalade' },
    created_at: ago(90)
  },
  {
    type: 'foster_animal_medical_record_added',
    title: 'New medical record',
    body: 'A new medical record was added for Duffy.',
    entity_type: 'animal',
    entity_id: 'a11',
    metadata: { animal_name: 'Duffy' },
    created_at: ago(320)
  },
  {
    type: 'transport_request_assigned',
    title: 'You were assigned a transport',
    body: 'You were assigned to transport Juniper.',
    entity_type: 'transport_request',
    entity_id: 'tr_demo',
    metadata: { animal_name: 'Juniper' },
    created_at: ago(600)
  },
  {
    type: 'supply_request_status_changed',
    title: 'Supply request updated',
    body: 'Your supply request status changed to approved.',
    entity_type: 'supply_request',
    entity_id: 'sr_demo',
    metadata: { status: 'approved' },
    read_at: ago(1500),
    created_at: ago(1600)
  },
  {
    type: 'foster_animal_status_changed',
    title: 'Animal status updated',
    body: "Juniper's status changed to adoptable.",
    entity_type: 'animal',
    entity_id: 'a3',
    metadata: { animal_name: 'Juniper', status: 'adoptable' },
    read_at: ago(2800),
    created_at: ago(2880)
  }];

  return rows.map((r, i) => ({
    ...r,
    user_notification_id: `un_demo_${i}`,
    notification_id: `n_demo_${i}`
  }));
}

export function DemoWhiskerProvider({
  children
}: {
  children: React.ReactNode;
}) {
  const [animals, setAnimals] = useState<Animal[]>(seedAnimals);
  const [notifications, setNotifications] = useState<NotificationItem[]>(
    makeDemoNotifications
  );
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
  // Demo mode has no edge function / OpenAI — AI content lives purely in memory
  // and "generation" produces a deterministic placeholder so the flow is
  // exercisable without an API key.
  const [aiContent, setAiContent] = useState<AnimalAiContent[]>([]);
  const [adoptionTemplates, setAdoptionTemplates] = useState<
    OrganizationAdoptionTemplate[]>(
    [
    {
      id: 'tmpl-default',
      organization_id: 'demo-org',
      name: 'Default',
      template_body:
      'Please read the full posting before applying.\n\n{{ai_intro}}\n\n{{ai_body}}\n\nWhat {{animal.name}} is looking for in a home:\n\n{{ai_home_requirements}}\n\nAll of our animals are spayed/neutered, microchipped, and vaccinated prior to adoption.\n\nAdoption fees apply. Thank you for your interest in adopting {{animal.name}}!',
      tone: 'warm_conversational',
      length: 'standard',
      style_notes: undefined,
      is_default: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }]
    );
  const [orgMembers] = useState<OrgMember[]>(seedOrgMembers);
  const [memberPermissions, setMemberPermissions] = useState<MemberPermission[]>(
    seedMemberPermissions
  );
  const [photos, setPhotos] = useState<AnimalPhoto[]>(seedPhotos);
  const [animalFiles, setAnimalFiles] = useState<AnimalFile[]>(seedAnimalFiles);
  // Demo has no real storage; remember object URLs for uploaded files so View/
  // Download work in-session. Seeded files fall back to a sample PDF.
  const demoFileUrls = useRef<Map<string, string>>(new Map());
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
  const [transportRequestAnimals, setTransportRequestAnimals] =
  useState<TransportRequestAnimal[]>(seedTransportRequestAnimals);
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

  // Demo mode keeps tab visibility in memory; every tab is visible by default.
  const [navigationSettings, setNavigationSettings] = useState<
    { tab_key: string; is_visible: boolean }[]>(
    []);
  const isTabVisible = (tabKey: string) =>
  navigationSettings.find((r) => r.tab_key === tabKey)?.is_visible ?? true;
  const setTabVisible = (tabKey: string, visible: boolean) =>
  setNavigationSettings((prev) =>
  prev.some((r) => r.tab_key === tabKey) ?
  prev.map((r) => r.tab_key === tabKey ? { ...r, is_visible: visible } : r) :
  [...prev, { tab_key: tabKey, is_visible: visible }]
  );
  const restoreNavigationDefaults = () => setNavigationSettings([]);
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
  const [savedLocations, setSavedLocations] = useState(seedSavedLocations);
  const addSavedLocation = (
  loc: Omit<
    (typeof seedSavedLocations)[number],
    'id' | 'organization_id' | 'created_at' | 'updated_at'>) =>
  setSavedLocations((prev) =>
  [
  ...prev,
  {
    ...loc,
    id: `sl_new_${prev.length}`,
    organization_id: 'demo-org',
    created_at: now(),
    updated_at: now()
  }].
  sort((a, b) => a.name.localeCompare(b.name))
  );
  const updateSavedLocation = (
  id: string,
  updates: Partial<(typeof seedSavedLocations)[number]>) =>
  setSavedLocations((prev) =>
  prev.map((l) => l.id === id ? { ...l, ...updates, updated_at: now() } : l)
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

  // Guidance: demo holds the seen-markers + switches in memory so inline links,
  // help drawers, and the onboarding checklist all behave like production.
  const [guidanceSeen, setGuidanceSeen] = useState<GuidanceSeen[]>([]);
  const [tipsHidden, setTipsHiddenState] = useState(false);
  const [checklistDismissed, setChecklistDismissedState] = useState(false);

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
    aiContent,
    adoptionTemplates,
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
    navigationSettings,
    isTabVisible,
    setTabVisible,
    restoreNavigationDefaults,
    setSpeciesEnabled,
    setDefaultSpecies,
    setAllowedBreeds,
    traits,
    savedLocations,
    addSavedLocation,
    updateSavedLocation,
    animalTraits,
    setAnimalTraits,
    addTrait,
    updateTrait,
    products,
    supplyRequests,
    supplyRequestItems,
    // Demo holds every request in memory, so closed history is already present —
    // the *HistoryLoaded flags are pre-true and the ensure* helpers are no-ops.
    supplyHistoryLoaded: true,
    // Demo data is synchronous, so requests are never in a loading state.
    requestsLoading: false,
    ensureSupplyHistoryLoaded: async () => {},
    // Support tickets aren't part of the demo dataset — no-op surface so the
    // Support page renders an empty "no requests yet" state.
    supportTickets: [],
    supportTicketsLoaded: true,
    ensureSupportTicketsLoaded: async () => {},
    addSupportTicket: async () => null,
    supportAccess: { active: false, expires_at: null },
    auditEvents: [],
    grantSupportAccess: async () => null,
    revokeSupportAccess: async () => null,
    transportRequests,
    transportRequestAnimals,
    transportHistoryLoaded: true,
    ensureTransportHistoryLoaded: async () => {},
    sittingRequests,
    sittingRequestPlacements,
    sittingHistoryLoaded: true,
    ensureSittingHistoryLoaded: async () => {},
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
    recordDirectAdoption: async (input) => {
      // Born-completed adoption row dated to the (possibly historical)
      // adoption date; mirrors the Supabase recordDirectAdoption.
      setAdoptions((prev) => [
      {
        id: `ad${generateId()}`,
        animal_id: input.animal_id,
        adopter_id: input.adopter_id,
        status: 'completed',
        source: 'direct',
        completed_at: input.adopted_on,
        notes: input.notes?.trim() || undefined,
        created_at: now()
      },
      ...prev]
      );
      updateAnimal(input.animal_id, {
        status: 'adopted',
        adopted_by_id: input.adopter_id,
        adopted_at: input.adopted_on,
        current_foster_id: undefined,
        is_on_hold: false
      });
      setPlacements((prev) =>
      prev.map((p) =>
      p.animal_id === input.animal_id && p.placement_status === 'active' ?
      {
        ...p,
        placement_status: 'completed' as const,
        end_date: input.adopted_on,
        reason_ended: 'Adopted'
      } :
      p
      )
      );
      if (input.adopter_id) {
        const adopterId = input.adopter_id;
        setPeople((prev) =>
        prev.map((p) =>
        p.id === adopterId && !p.roles.includes('adopter') ?
        {
          ...p,
          roles: [...p.roles, 'adopter'],
          role: legacyRoleFor([...p.roles, 'adopter'])
        } :
        p
        )
        );
      }
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
        status: input.new_status ?? 'intake',
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
        status: input.new_status ?? 'intake',
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
    animalFiles,
    addAnimalFile: async (input: NewFileInput) => {
      const id = `af${generateId()}`;
      demoFileUrls.current.set(id, URL.createObjectURL(input.file));
      const newFile: AnimalFile = {
        id,
        animal_id: input.animal_id,
        file_name: input.file.name,
        file_type: input.file.type || undefined,
        file_size: input.file.size,
        storage_path: `demo/${id}`,
        category: input.category,
        notes: input.notes,
        uploaded_by_user_id: 'demo-user',
        created_at: now()
      };
      setAnimalFiles((prev) => [newFile, ...prev]);
    },
    deleteAnimalFile: (id) => {
      demoFileUrls.current.delete(id);
      setAnimalFiles((prev) => prev.filter((f) => f.id !== id));
    },
    getAnimalFileUrl: async (file) =>
    demoFileUrls.current.get(file.id) ??
    'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf',

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

    generateAiSummary: async (animalId: string) => {
      const animal = enrichedAnimals.find((a) => a.id === animalId);
      const now = new Date().toISOString();
      const name = animal?.name || 'This animal';
      const traitCount = animalTraits.filter(
        (at) => at.animal_id === animalId
      ).length;
      const content =
      `${name} is a ${animal?.species ?? 'pet'} currently in the rescue's care. ` +
      `This is a demo summary generated without an AI provider — connect the ` +
      `generate-animal-summary edge function to produce real summaries from ` +
      `${traitCount} personality trait(s), notes, and medical history.`;
      const fingerprint = animal ?
      computeAnimalInputsFingerprint({
        animal,
        traitIds: animalTraits.
        filter((at) => at.animal_id === animalId).
        map((at) => at.trait_id),
        notes: notes.filter((n) => n.animal_id === animalId),
        medical: medicalRecords.filter((m) => m.animal_id === animalId)
      }) :
      undefined;
      setAiContent((prev) => [
      {
        id: `ai${generateId()}`,
        organization_id: 'demo-org',
        animal_id: animalId,
        content_type: 'summary',
        ai_generated_content: content,
        draft_content: content,
        user_edited: false,
        model: 'demo',
        source_fingerprint: fingerprint,
        generated_at: now,
        created_at: now,
        updated_at: now
      },
      ...prev.filter(
        (c) => !(c.animal_id === animalId && c.content_type === 'summary')
      )]
      );
    },
    updateAiDraft: (id: string, draft: string) =>
    setAiContent((prev) =>
    prev.map((c) =>
    c.id === id ?
    {
      ...c,
      draft_content: draft,
      user_edited: draft !== c.ai_generated_content
    } :
    c
    )
    ),
    resetAiDraft: (id: string) =>
    setAiContent((prev) =>
    prev.map((c) =>
    c.id === id ?
    { ...c, draft_content: c.ai_generated_content, user_edited: false } :
    c
    )
    ),

    computeAnimalFingerprint: (animalId: string) => {
      const animal = enrichedAnimals.find((a) => a.id === animalId);
      if (!animal) return '';
      return computeAnimalInputsFingerprint({
        animal,
        traitIds: animalTraits.
        filter((at) => at.animal_id === animalId).
        map((at) => at.trait_id),
        notes: notes.filter((n) => n.animal_id === animalId),
        medical: medicalRecords.filter((m) => m.animal_id === animalId)
      });
    },

    generateAdoptionProfile: async (
    animalId: string,
    guidance?: string,
    templateId?: string) =>
    {
      const animal = enrichedAnimals.find((a) => a.id === animalId);
      const now = new Date().toISOString();
      const template =
      (templateId ?
      adoptionTemplates.find((t) => t.id === templateId) :
      null) ??
      adoptionTemplates.find((t) => t.is_default) ??
      adoptionTemplates[0];
      const name = animal?.name || 'This animal';
      const sections = {
        ai_intro: `Meet ${name}! (Demo intro — connect the generate-adoption-profile edge function for real output.)`,
        ai_body:
        `${name} is a ${animal?.species ?? 'pet'} in our care.${
        guidance ? ` (Guidance applied: ${guidance})` : ''
        } This demo text is assembled into your organization's template.`,
        ai_home_requirements:
        `- ${name} needs a loving home.\n- Demo bullet generated without AI.`
      };
      const content = template ?
      assembleAdoptionProfile(
        template.template_body,
        animal ? animalTemplateVars(animal, seedBreeds) : {},
        sections
      ) :
      `${sections.ai_intro}\n\n${sections.ai_body}`;
      setAiContent((prev) => [
      {
        id: `ai${generateId()}`,
        organization_id: 'demo-org',
        animal_id: animalId,
        content_type: 'adoption_profile',
        ai_generated_content: content,
        draft_content: content,
        user_edited: false,
        model: 'demo',
        source_fingerprint: animal ?
        computeAnimalInputsFingerprint({
          animal,
          traitIds: animalTraits.
          filter((at) => at.animal_id === animalId).
          map((at) => at.trait_id),
          notes: notes.filter((n) => n.animal_id === animalId),
          medical: medicalRecords.filter((m) => m.animal_id === animalId)
        }) :
        undefined,
        generated_at: now,
        created_at: now,
        updated_at: now
      },
      ...prev.filter(
        (c) =>
        !(c.animal_id === animalId && c.content_type === 'adoption_profile')
      )]
      );
    },
    updateAdoptionTemplate: (id, updates) =>
    setAdoptionTemplates((prev) =>
    prev.map((t) => t.id === id ? { ...t, ...updates } : t)
    ),
    addAdoptionTemplate: async (name: string) => {
      const base =
      adoptionTemplates.find((t) => t.is_default) ?? adoptionTemplates[0];
      const id = `tmpl-${generateId()}`;
      const now = new Date().toISOString();
      setAdoptionTemplates((prev) => [
      ...prev,
      {
        id,
        organization_id: 'demo-org',
        name: name.trim() || 'New template',
        template_body: base?.template_body ?? '{{ai_intro}}\n\n{{ai_body}}',
        tone: base?.tone ?? 'warm_conversational',
        length: base?.length ?? 'standard',
        style_notes: undefined,
        is_default: false,
        created_at: now,
        updated_at: now
      }]
      );
      return id;
    },
    setDefaultAdoptionTemplate: (id: string) =>
    setAdoptionTemplates((prev) =>
    prev.map((t) => ({ ...t, is_default: t.id === id }))
    ),
    deleteAdoptionTemplate: (id: string) =>
    setAdoptionTemplates((prev) => {
      const target = prev.find((t) => t.id === id);
      if (!target || target.is_default) return prev;
      return prev.filter((t) => t.id !== id);
    }),

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
        notes,
        created_at: now()
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
      // Fostered is derived from the active placement; lifecycle status is
      // left alone — except 'intake', which fostering promotes to In Care.
      const placedAnimal = animals.find((a) => a.id === animal_id);
      updateAnimal(animal_id, {
        current_foster_id: person_id,
        ...(placedAnimal?.status === 'intake' ?
        { status: 'in_care' as const } :
        {})
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
          notes,
          created_at: now()
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
      const reassignedAnimal = animals.find((a) => a.id === animal_id);
      updateAnimal(animal_id, {
        current_foster_id: new_person_id,
        ...(reassignedAnimal?.status === 'intake' ?
        { status: 'in_care' as const } :
        {})
      });
    },

    endPlacement: async (animal_id, end_date, reason_ended) => {
      setPlacements((prev) =>
      prev.map((p) =>
      p.animal_id === animal_id && p.placement_status === 'active' ?
      {
        ...p,
        placement_status: 'completed' as const,
        end_date,
        reason_ended: reason_ended?.trim() || 'Returned to the organization.'
      } :
      p
      )
      );
      updateAnimal(animal_id, { current_foster_id: undefined });
    },

    addProduct: async (product) => {
      // Mirror the server's (org, lower(name)) uniqueness guard.
      if (
      products.some(
        (p) => p.name.trim().toLowerCase() === product.name.trim().toLowerCase()
      ))
      {
        return 'A product with this name already exists.';
      }
      setProducts((prev) => [
      { ...product, id: `prod${generateId()}` },
      ...prev]
      );
      return null;
    },
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
    cancelSupplyRequest: async (id) => {
      // In-memory mirror of the real status re-check (here local state IS the
      // source of truth, so it just gates on the current status).
      const current = supplyRequests.find((s) => s.id === id);
      if (!current) return { ok: false };
      if (current.status !== 'submitted') {
        return { ok: false, status: current.status };
      }
      setSupplyRequests((prev) =>
      prev.map((s) =>
      s.id === id ? { ...s, status: 'cancelled', updated_at: now() } : s
      )
      );
      return { ok: true };
    },
    addSupplyRequestItem: (item) =>
    setSupplyRequestItems((prev) => [
    { ...item, id: `sri${generateId()}` },
    ...prev]
    ),

    addTransportRequest: async (req, animalIds = []) => {
      const id = `tr${generateId()}`;
      setTransportRequests((prev) => [
      { ...req, id, created_at: now(), updated_at: now() },
      ...prev]
      );
      setTransportRequestAnimals((prev) => [
      ...animalIds.map((aid) => ({
        id: `tra${generateId()}`,
        transport_request_id: id,
        animal_id: aid
      })),
      ...prev]
      );
      return id;
    },
    updateTransportRequest: (id, updates, animalIds) => {
      setTransportRequests((prev) =>
      prev.map((t) =>
      t.id === id ? { ...t, ...updates, updated_at: now() } : t
      )
      );
      if (animalIds) {
        setTransportRequestAnimals((prev) => [
        ...prev.filter((ta) => ta.transport_request_id !== id),
        ...animalIds.map((aid) => ({
          id: `tra${generateId()}`,
          transport_request_id: id,
          animal_id: aid
        }))]
        );
      }
    },
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
    assignTransportRequest: (id, volunteer_person_id) =>
    setTransportRequests((prev) =>
    prev.map((t) =>
    t.id === id ?
    {
      ...t,
      assigned_volunteer_person_id: volunteer_person_id,
      status: 'assigned' as const,
      updated_at: now()
    } :
    t
    )
    ),
    acceptTransportRequest: (id) =>
    setTransportRequests((prev) =>
    prev.map((t) =>
    t.id === id ? { ...t, status: 'accepted' as const, updated_at: now() } : t
    )
    ),
    unassignTransportRequest: (id) =>
    setTransportRequests((prev) =>
    prev.map((t) =>
    t.id === id ?
    {
      ...t,
      assigned_volunteer_person_id: null,
      status: 'open' as const,
      updated_at: now()
    } :
    t
    )
    ),
    completeTransportRequest: (id) =>
    setTransportRequests((prev) =>
    prev.map((t) =>
    t.id === id ?
    {
      ...t,
      status: 'completed' as const,
      completed_at: now(),
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
    releaseSittingRequest: (id) =>
    setSittingRequests((prev) =>
    prev.map((s) =>
    s.id === id ?
    {
      ...s,
      sitter_person_id: null,
      status: 'open' as const,
      updated_at: now()
    } :
    s
    )
    ),
    completeSittingRequest: (id) =>
    setSittingRequests((prev) =>
    prev.map((s) =>
    s.id === id ?
    { ...s, status: 'completed' as const, updated_at: now() } :
    s
    )
    ),

    // Notifications: seeded in memory so the bell badge + list are populated;
    // mark-read is interactive (no persistence — resets on refresh).
    notifications,
    unreadNotificationCount: notifications.filter((n) => !n.read_at).length,
    refreshNotifications: () => {},
    markNotificationRead: (id: string) =>
    setNotifications((prev) =>
    prev.map((n) =>
    n.user_notification_id === id && !n.read_at ?
    { ...n, read_at: now() } :
    n
    )
    ),
    markAllNotificationsRead: () =>
    setNotifications((prev) =>
    prev.map((n) => (n.read_at ? n : { ...n, read_at: now() }))
    ),
    // Guidance: same content as production (from the shared seed) so the inline
    // links, drawers, and checklist render for portfolio visitors.
    guidanceMessages: DEFAULT_GUIDANCE,
    guidanceSeen,
    tipsHidden,
    checklistDismissed,
    markGuidanceSeen: (key: string, version: number) =>
    setGuidanceSeen((prev) =>
    prev.some((s) => s.guidance_key === key && s.version === version) ?
    prev :
    [
    ...prev,
    {
      id: `demo-${key}-${version}`,
      user_id: 'demo-user',
      guidance_key: key,
      version,
      dismissed_at: now()
    }]

    ),
    setTipsHidden: (v: boolean) => setTipsHiddenState(v),
    dismissChecklist: () => setChecklistDismissedState(true),

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
    grantPermission: (memberId, type) =>
    setMemberPermissions((prev) =>
    prev.some(
      (p) =>
      p.member_id === memberId &&
      p.permission_type === type &&
      p.is_active
    ) ?
    prev :
    [
    ...prev,
    {
      id: `mp${generateId()}`,
      organization_id: 'demo-org',
      member_id: memberId,
      permission_type: type,
      is_active: true,
      starts_at: new Date().toISOString()
    }]
    ),
    revokePermission: (memberId, type) =>
    setMemberPermissions((prev) =>
    prev.map((p) =>
    p.member_id === memberId && p.permission_type === type ?
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
