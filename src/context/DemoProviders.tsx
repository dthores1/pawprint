import React, { useState } from 'react';
import { AuthContext, AuthContextType, Org } from './AuthContext';
import { WhiskerContext, WhiskerContextType } from './WhiskerContext';
import {
  Animal,
  FosterParent,
  FosterPlacement,
  MedicalRecord,
  AnimalNote,
  AnimalRelationship,
  AnimalPhoto,
  Person,
  Product,
  SupplyRequest,
  SupplyRequestItem,
  TransportRequest,
  SittingRequest,
  SittingRequestPlacement,
  ClinicEvent,
  ClinicSlot } from
'../types';
import { NewPhotoInput } from '../lib/photosApi';
import {
  seedAnimals,
  seedBreeds,
  seedFosters,
  seedPlacements,
  seedMedicalRecords,
  seedNotes,
  seedRelationships,
  seedPhotos,
  seedPeople,
  seedProducts,
  seedSupplyRequests,
  seedSupplyRequestItems,
  seedTransportRequests,
  seedSittingRequests,
  seedSittingRequestPlacements,
  seedClinicEvents,
  seedClinicSlots } from
'../data/seed';
import { generateId } from '../lib/utils';

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
  const [fosters, setFosters] = useState<FosterParent[]>(seedFosters);
  const [placements, setPlacements] =
  useState<FosterPlacement[]>(seedPlacements);
  const [medicalRecords, setMedicalRecords] =
  useState<MedicalRecord[]>(seedMedicalRecords);
  const [notes, setNotes] = useState<AnimalNote[]>(seedNotes);
  const [relationships, setRelationships] =
  useState<AnimalRelationship[]>(seedRelationships);
  const [photos, setPhotos] = useState<AnimalPhoto[]>(seedPhotos);
  const [people, setPeople] = useState<Person[]>(seedPeople);
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

  const now = () => new Date().toISOString();

  const updateAnimal = (id: string, updates: Partial<Animal>) =>
  setAnimals((prev) =>
  prev.map((a) =>
  a.id === id ? { ...a, ...updates, updated_at: now() } : a
  )
  );

  const value: WhiskerContextType = {
    animals,
    animalsLoading: false,
    fosters,
    fostersLoading: false,
    placements,
    medicalRecords,
    notes,
    relationships,
    photos,
    people,
    peopleLoading: false,
    breeds: seedBreeds,
    products,
    supplyRequests,
    supplyRequestItems,
    transportRequests,
    sittingRequests,
    sittingRequestPlacements,
    clinicEvents,
    clinicSlots,

    addAnimal: (animal) =>
    setAnimals((prev) => [
    { ...animal, id: `a${generateId()}`, created_at: now(), updated_at: now() },
    ...prev]
    ),
    updateAnimal,
    deleteAnimal: (id) =>
    setAnimals((prev) => prev.filter((a) => a.id !== id)),
    addLitter: async (shared, members) => {
      const litterId = `litter${generateId()}`;
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
        status: 'intake',
        priority: 'normal',
        description: m.description ?? '',
        litter_id: litterId,
        created_at: now(),
        updated_at: now()
      }));
      setAnimals((prev) => [...created, ...prev]);
    },

    addFoster: (foster) =>
    setFosters((prev) => [{ ...foster, id: `f${generateId()}` }, ...prev]),
    updateFoster: (id, updates) =>
    setFosters((prev) =>
    prev.map((f) => f.id === id ? { ...f, ...updates } : f)
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

    addPlacement: (placement) =>
    setPlacements((prev) => [
    { ...placement, id: `p${generateId()}` },
    ...prev]
    ),
    updatePlacement: (id, updates) =>
    setPlacements((prev) =>
    prev.map((p) => p.id === id ? { ...p, ...updates } : p)
    ),

    addPerson: (person) =>
    setPeople((prev) => [
    { ...person, id: `pe${generateId()}`, created_at: now() },
    ...prev]
    ),
    updatePerson: (id, updates) =>
    setPeople((prev) =>
    prev.map((p) => p.id === id ? { ...p, ...updates } : p)
    ),

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

    placeAnimal: (animal_id, foster_parent_id, start_date, notes) => {
      setPlacements((prev) => [
      {
        id: `p${generateId()}`,
        animal_id,
        foster_parent_id,
        start_date,
        placement_status: 'active',
        placement_type: 'foster',
        notes
      },
      ...prev]
      );
      updateAnimal(animal_id, {
        status: 'fostered',
        current_foster_id: foster_parent_id
      });
    },
    reassignFoster: (
    animal_id,
    new_foster_parent_id,
    start_date,
    reason_ended,
    notes) =>
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
          foster_parent_id: new_foster_parent_id,
          start_date,
          placement_status: 'active' as const,
          placement_type: 'foster' as const,
          notes
        },
        ...closed];

      });
      updateAnimal(animal_id, {
        status: 'fostered',
        current_foster_id: new_foster_parent_id
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
    addClinicSlot: (slot) =>
    setClinicSlots((prev) => [
    { ...slot, id: `cs${generateId()}` },
    ...prev]
    ),
    updateClinicSlot: (id, updates) =>
    setClinicSlots((prev) =>
    prev.map((s) => s.id === id ? { ...s, ...updates } : s)
    ),
    deleteClinicSlot: (id) =>
    setClinicSlots((prev) => prev.filter((s) => s.id !== id))
  };

  return (
    <WhiskerContext.Provider value={value}>
      {children}
    </WhiskerContext.Provider>);

}
