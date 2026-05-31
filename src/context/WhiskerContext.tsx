import React, {
  useState,
  useEffect,
  useMemo,
  useCallback,
  createContext,
  useContext } from
'react';
import {
  Animal,
  Adoption,
  Breed,
  Litter,
  Sex,
  PersonRole,
  FosterInput,
  FosterPlacement,
  MedicalRecord,
  AnimalNote,
  AnimalActionItem,
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
  ClinicSlot,
  ClinicSlotProcedure,
  ClinicSlotProcedureType } from
'../types';
import { supabase } from '../lib/supabase';
import { rowToBreed } from '../lib/breedsApi';
import {
  litterToInsert,
  litterUpdateToRow,
  rowToLitter } from
'../lib/littersApi';
import {
  adoptionToInsert,
  adoptionUpdateToRow,
  rowToAdoption } from
'../lib/adoptionsApi';
import { adoptionStatusPatch } from '../lib/adoptions';
import { useAuth } from './AuthContext';
import {
  rowToAnimal,
  animalToInsert,
  animalUpdateToRow } from
'../lib/animalsApi';
import { rowToNote, noteToInsert } from '../lib/notesApi';
import {
  rowToActionItem,
  actionItemToInsert,
  actionItemUpdateToRow } from
'../lib/actionItemsApi';
import {
  rowToPlacement,
  placementToInsert,
  placementUpdateToRow } from
'../lib/placementsApi';
import {
  rowToMedicalRecord,
  medicalToInsert,
  medicalUpdateToRow } from
'../lib/medicalApi';
import {
  rowToRelationship,
  relationshipToInsert } from
'../lib/relationshipsApi';
import {
  rowToPerson,
  personToInsert,
  personUpdateToRow,
  legacyRoleFor } from
'../lib/peopleApi';
import {
  rowToPhoto,
  photoToInsert,
  NewPhotoInput } from
'../lib/photosApi';
import {
  rowToProduct,
  productToInsert,
  productUpdateToRow } from
'../lib/productsApi';
import {
  rowToSupplyRequest,
  supplyRequestToInsert,
  supplyRequestUpdateToRow,
  rowToSupplyItem,
  supplyItemToInsert } from
'../lib/supplyApi';
import {
  rowToTransport,
  transportToInsert,
  transportUpdateToRow } from
'../lib/transportApi';
import {
  rowToSitting,
  rowToSittingPlacement,
  sittingToInsert,
  sittingUpdateToRow } from
'../lib/sittingApi';
import {
  rowToClinicEvent,
  clinicEventToInsert,
  clinicEventUpdateToRow,
  rowToClinicSlot,
  clinicSlotToInsert,
  clinicSlotUpdateToRow,
  rowToClinicSlotProcedure,
  clinicSlotProcedureToInsert,
  clinicSlotProcedureUpdateToRow } from
'../lib/clinicApi';
export interface WhiskerContextType {
  animals: Animal[];
  /** True while the Supabase-backed animals list is being fetched. */
  animalsLoading: boolean;
  /** Fosters are `people` whose roles include 'foster_parent' (derived view). */
  fosters: Person[];
  /** True while the Supabase-backed people list is being fetched. */
  fostersLoading: boolean;
  placements: FosterPlacement[];
  medicalRecords: MedicalRecord[];
  notes: AnimalNote[];
  actionItems: AnimalActionItem[];
  relationships: AnimalRelationship[];
  photos: AnimalPhoto[];
  people: Person[];
  litters: Litter[];
  littersLoading: boolean;
  adoptions: Adoption[];
  adoptionsLoading: boolean;
  /** True while the Supabase-backed people list is being fetched. */
  peopleLoading: boolean;
  /** Global breed catalog (not org-scoped). */
  breeds: Breed[];
  products: Product[];
  addProduct: (product: Omit<Product, 'id'>) => void;
  updateProduct: (id: string, updates: Partial<Product>) => void;
  supplyRequests: SupplyRequest[];
  supplyRequestItems: SupplyRequestItem[];
  addAnimal: (animal: Omit<Animal, 'id' | 'created_at' | 'updated_at'>) => void;
  updateAnimal: (id: string, updates: Partial<Animal>) => void;
  deleteAnimal: (id: string) => void;
  /**
   * Create a litter (one `litters` row) plus a member `animals` row each,
   * stamped with the shared metadata and the new litter_id. Members differ
   * only by name / sex / description.
   */
  addLitter: (
  shared: Omit<Litter, 'id'> & {
    birthdate_source?: Animal['birthdate_source'];
    estimated_age_value?: number;
    estimated_age_unit?: Animal['estimated_age_unit'];
    estimated_age_as_of?: string;
  },
  members: { name: string; sex: Sex; description?: string }[])
  => Promise<void>;
  updateLitter: (id: string, updates: Partial<Litter>) => void;
  addFoster: (foster: FosterInput) => void;
  updateFoster: (id: string, updates: Partial<FosterInput>) => void;
  addMedicalRecord: (record: Omit<MedicalRecord, 'id'>) => void;
  updateMedicalRecord: (id: string, updates: Partial<MedicalRecord>) => void;
  addNote: (note: Omit<AnimalNote, 'id' | 'created_at'>) => void;
  // — Action items (tracked next-steps) —
  addActionItem: (
  item: Pick<AnimalActionItem, 'animal_id' | 'description' | 'priority'>)
  => void;
  updateActionItem: (id: string, updates: Partial<AnimalActionItem>) => void;
  /** Mark the item completed (stamps completed_at/by). */
  completeActionItem: (id: string, completionNote?: string) => void;
  /** Mark the item cancelled (stamps completed_at/by). */
  cancelActionItem: (id: string, completionNote?: string) => void;
  addPlacement: (placement: Omit<FosterPlacement, 'id'>) => void;
  updatePlacement: (id: string, updates: Partial<FosterPlacement>) => void;
  addPerson: (
  person: Omit<Person, 'id' | 'created_at'>)
  => Promise<Person | undefined>;
  updatePerson: (id: string, updates: Partial<Person>) => void;
  // — Adoptions (operational workflow) —
  addAdoption: (
  input: { animal_id: string; adopter_id: string; notes?: string })
  => Promise<void>;
  updateAdoption: (id: string, updates: Partial<Adoption>) => void;
  /** Advance an adoption to a workflow status, stamping milestone timestamps. */
  setAdoptionStatus: (id: string, status: Adoption['status']) => void;
  /** Finalize: animal -> adopted, set adopted_by/at, close active placement. */
  completeAdoption: (id: string, donationAmount?: number) => void;
  cancelAdoption: (id: string, reason?: string) => void;
  addPhoto: (input: NewPhotoInput) => Promise<void>;
  deletePhoto: (id: string) => void;
  addRelationship: (rel: Omit<AnimalRelationship, 'id'>) => void;
  deleteRelationship: (id: string) => void;
  placeAnimal: (
  animal_id: string,
  person_id: string,
  start_date: string,
  notes?: string)
  => void;
  /**
   * Move an animal from its current foster to a new one. Closes the active
   * placement (sets end_date + reason_ended), opens a new active placement,
   * and updates animal.current_foster_id. If there's no active placement,
   * this falls back to a regular placement.
   */
  reassignFoster: (
  animal_id: string,
  new_person_id: string,
  start_date: string,
  reason_ended?: string,
  notes?: string)
  => void;
  addSupplyRequest: (
  req: Omit<SupplyRequest, 'id' | 'created_at' | 'updated_at'>)
  => Promise<string>;
  updateSupplyRequest: (id: string, updates: Partial<SupplyRequest>) => void;
  addSupplyRequestItem: (item: Omit<SupplyRequestItem, 'id'>) => void;
  // Transport requests
  transportRequests: TransportRequest[];
  addTransportRequest: (
  req: Omit<TransportRequest, 'id' | 'created_at' | 'updated_at'>)
  => Promise<string>;
  updateTransportRequest: (
  id: string,
  updates: Partial<TransportRequest>)
  => void;
  /** Convenience: assign a volunteer + flip status to claimed. */
  claimTransportRequest: (id: string, volunteer_person_id: string) => void;
  // Sitting requests
  sittingRequests: SittingRequest[];
  sittingRequestPlacements: SittingRequestPlacement[];
  /**
   * Create a sitting request along with its placement snapshot. Even when
   * `coverage_scope === 'all_current_placements'`, callers should resolve
   * the foster's active placement IDs and pass them via `placement_ids`
   * so the join table reflects the original intent. Returns the new id.
   */
  addSittingRequest: (
  req: Omit<SittingRequest, 'id' | 'created_at' | 'updated_at'>,
  placement_ids: string[])
  => Promise<string>;
  updateSittingRequest: (
  id: string,
  updates: Partial<SittingRequest>)
  => void;
  /** Convenience: set the sitter + flip status to claimed. */
  acceptSittingRequest: (id: string, sitter_person_id: string) => void;
  // Clinics
  clinicEvents: ClinicEvent[];
  clinicSlots: ClinicSlot[];
  clinicSlotProcedures: ClinicSlotProcedure[];
  addClinicEvent: (
  event: Omit<ClinicEvent, 'id' | 'created_at' | 'updated_at'>)
  => Promise<string>;
  updateClinicEvent: (id: string, updates: Partial<ClinicEvent>) => void;
  /** Create a slot plus its initial procedure rows. */
  addClinicSlot: (
  slot: Omit<ClinicSlot, 'id'>,
  procedureTypes: ClinicSlotProcedureType[])
  => void;
  updateClinicSlot: (id: string, updates: Partial<ClinicSlot>) => void;
  deleteClinicSlot: (id: string) => void;
  addClinicSlotProcedure: (
  clinic_slot_id: string,
  procedure_type: ClinicSlotProcedureType,
  opts?: { completed?: boolean })
  => void;
  updateClinicSlotProcedure: (
  id: string,
  updates: Partial<ClinicSlotProcedure>)
  => void;
  deleteClinicSlotProcedure: (id: string) => void;
}
export const WhiskerContext = createContext<WhiskerContextType | undefined>(
  undefined
);
export function WhiskerProvider({ children }: {children: React.ReactNode;}) {
  // Animals and notes are now Supabase-backed (org-scoped). Other collections
  // remain on seed for now until they're ported.
  const { currentOrg, user } = useAuth();
  const orgId = currentOrg?.id ?? null;
  const [animals, setAnimals] = useState<Animal[]>([]);
  const [animalsLoading, setAnimalsLoading] = useState(false);
  const loadAnimals = useCallback(async () => {
    if (!orgId) {
      setAnimals([]);
      return;
    }
    setAnimalsLoading(true);
    const { data, error } = await supabase.
    from('animals').
    select('*').
    eq('organization_id', orgId).
    order('updated_at', { ascending: false });
    if (error) {
      console.error('[animals] load failed:', error.message);
    } else {
      setAnimals((data ?? []).map(rowToAnimal));
    }
    setAnimalsLoading(false);
  }, [orgId]);
  useEffect(() => {
    loadAnimals();
  }, [loadAnimals]);
  // Notes — Supabase-backed, org-scoped.
  const [notes, setNotes] = useState<AnimalNote[]>([]);
  const currentUserLite = user ?
  { id: user.id, email: user.email ?? undefined } :
  undefined;
  const loadNotes = useCallback(async () => {
    if (!orgId) {
      setNotes([]);
      return;
    }
    const { data, error } = await supabase.
    from('animal_notes').
    select('*').
    eq('organization_id', orgId).
    order('created_at', { ascending: false });
    if (error) {
      console.error('[notes] load failed:', error.message);
    } else {
      setNotes((data ?? []).map((r) => rowToNote(r, currentUserLite)));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgId, user?.id, user?.email]);
  useEffect(() => {
    loadNotes();
  }, [loadNotes]);
  // Action items — Supabase-backed, org-scoped.
  const [actionItems, setActionItems] = useState<AnimalActionItem[]>([]);
  const loadActionItems = useCallback(async () => {
    if (!orgId) {
      setActionItems([]);
      return;
    }
    const { data, error } = await supabase.
    from('animal_action_items').
    select('*').
    eq('organization_id', orgId).
    order('created_at', { ascending: false });
    if (error) {
      console.error('[action items] load failed:', error.message);
    } else {
      setActionItems((data ?? []).map(rowToActionItem));
    }
  }, [orgId]);
  useEffect(() => {
    loadActionItems();
  }, [loadActionItems]);
  // Placements — Supabase-backed, org-scoped. (Fosters are derived from
  // `people` further down — see the `fosters` useMemo.)
  const [placements, setPlacements] = useState<FosterPlacement[]>([]);
  const loadPlacements = useCallback(async () => {
    if (!orgId) {
      setPlacements([]);
      return;
    }
    const { data, error } = await supabase.
    from('foster_placements').
    select('*').
    eq('organization_id', orgId).
    order('start_date', { ascending: false });
    if (error) {
      console.error('[placements] load failed:', error.message);
    } else {
      setPlacements((data ?? []).map(rowToPlacement));
    }
  }, [orgId]);
  useEffect(() => {
    loadPlacements();
  }, [loadPlacements]);
  // Medical records & relationships — Supabase-backed, org-scoped.
  const [medicalRecords, setMedicalRecords] = useState<MedicalRecord[]>([]);
  const loadMedicalRecords = useCallback(async () => {
    if (!orgId) {
      setMedicalRecords([]);
      return;
    }
    const { data, error } = await supabase.
    from('medical_records').
    select('*').
    eq('organization_id', orgId);
    if (error) {
      console.error('[medical] load failed:', error.message);
    } else {
      setMedicalRecords((data ?? []).map(rowToMedicalRecord));
    }
  }, [orgId]);
  useEffect(() => {
    loadMedicalRecords();
  }, [loadMedicalRecords]);
  const [relationships, setRelationships] = useState<AnimalRelationship[]>([]);
  const loadRelationships = useCallback(async () => {
    if (!orgId) {
      setRelationships([]);
      return;
    }
    const { data, error } = await supabase.
    from('animal_relationships').
    select('*').
    eq('organization_id', orgId);
    if (error) {
      console.error('[relationships] load failed:', error.message);
    } else {
      setRelationships((data ?? []).map(rowToRelationship));
    }
  }, [orgId]);
  useEffect(() => {
    loadRelationships();
  }, [loadRelationships]);
  // Litters — org-scoped grouping objects. Members link via animals.litter_id.
  const [litters, setLitters] = useState<Litter[]>([]);
  const [littersLoading, setLittersLoading] = useState(false);
  const loadLitters = useCallback(async () => {
    if (!orgId) {
      setLitters([]);
      return;
    }
    setLittersLoading(true);
    const { data, error } = await supabase.
    from('litters').
    select('*').
    eq('organization_id', orgId).
    order('created_at', { ascending: false });
    if (error) {
      console.error('[litters] load failed:', error.message);
    } else {
      setLitters((data ?? []).map(rowToLitter));
    }
    setLittersLoading(false);
  }, [orgId]);
  useEffect(() => {
    loadLitters();
  }, [loadLitters]);
  // Adoptions — org-scoped operational workflow records.
  const [adoptions, setAdoptions] = useState<Adoption[]>([]);
  const [adoptionsLoading, setAdoptionsLoading] = useState(false);
  const loadAdoptions = useCallback(async () => {
    if (!orgId) {
      setAdoptions([]);
      return;
    }
    setAdoptionsLoading(true);
    const { data, error } = await supabase.
    from('adoptions').
    select('*').
    eq('organization_id', orgId).
    order('created_at', { ascending: false });
    if (error) {
      console.error('[adoptions] load failed:', error.message);
    } else {
      setAdoptions((data ?? []).map(rowToAdoption));
    }
    setAdoptionsLoading(false);
  }, [orgId]);
  useEffect(() => {
    loadAdoptions();
  }, [loadAdoptions]);
  // Photos — metadata in Supabase, image bytes in the `animal-photos` bucket.
  const [photos, setPhotos] = useState<AnimalPhoto[]>([]);
  const loadPhotos = useCallback(async () => {
    if (!orgId) {
      setPhotos([]);
      return;
    }
    const { data, error } = await supabase.
    from('animal_photos').
    select('*').
    eq('organization_id', orgId).
    order('created_at', { ascending: false });
    if (error) {
      console.error('[photos] load failed:', error.message);
    } else {
      setPhotos((data ?? []).map(rowToPhoto));
    }
  }, [orgId]);
  useEffect(() => {
    loadPhotos();
  }, [loadPhotos]);
  // People (contacts) — Supabase-backed, org-scoped.
  const [people, setPeople] = useState<Person[]>([]);
  const [peopleLoading, setPeopleLoading] = useState(false);
  const loadPeople = useCallback(async () => {
    if (!orgId) {
      setPeople([]);
      return;
    }
    setPeopleLoading(true);
    const { data, error } = await supabase.
    from('people').
    select('*').
    eq('organization_id', orgId).
    order('last_name', { ascending: true });
    if (error) {
      console.error('[people] load failed:', error.message);
    } else {
      setPeople((data ?? []).map(rowToPerson));
    }
    setPeopleLoading(false);
  }, [orgId]);
  useEffect(() => {
    loadPeople();
  }, [loadPeople]);
  // Fosters are a derived view of people (those with the 'foster_parent' role).
  const fosters = useMemo(
    () => people.filter((p) => p.roles.includes('foster_parent')),
    [people]
  );
  const fostersLoading = peopleLoading;
  // Breeds — global reference catalog (not org-scoped). Read-only here.
  const [breeds, setBreeds] = useState<Breed[]>([]);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase.
      from('breeds').
      select('*').
      eq('active', true).
      order('name', { ascending: true });
      if (cancelled) return;
      if (error) {
        console.error('[breeds] load failed:', error.message);
      } else {
        setBreeds((data ?? []).map(rowToBreed));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);
  // — Coordination collections — all Supabase-backed, org-scoped. —————
  const [products, setProducts] = useState<Product[]>([]);
  const [supplyRequests, setSupplyRequests] = useState<SupplyRequest[]>([]);
  const [supplyRequestItems, setSupplyRequestItems] = useState<
    SupplyRequestItem[]>(
    []);
  const [transportRequests, setTransportRequests] = useState<
    TransportRequest[]>(
    []);
  const [sittingRequests, setSittingRequests] = useState<SittingRequest[]>([]);
  const [sittingRequestPlacements, setSittingRequestPlacements] = useState<
    SittingRequestPlacement[]>(
    []);
  const [clinicEvents, setClinicEvents] = useState<ClinicEvent[]>([]);
  const [clinicSlots, setClinicSlots] = useState<ClinicSlot[]>([]);
  const [clinicSlotProcedures, setClinicSlotProcedures] = useState<
    ClinicSlotProcedure[]>(
    []);
  const loadCoordination = useCallback(async () => {
    if (!orgId) {
      setProducts([]);
      setSupplyRequests([]);
      setSupplyRequestItems([]);
      setTransportRequests([]);
      setSittingRequests([]);
      setSittingRequestPlacements([]);
      setClinicEvents([]);
      setClinicSlots([]);
      setClinicSlotProcedures([]);
      return;
    }
    const tables = [
    ['products', (rows: any[]) => setProducts(rows.map(rowToProduct))],
    [
    'supply_requests',
    (rows: any[]) => setSupplyRequests(rows.map(rowToSupplyRequest))],

    [
    'supply_request_items',
    (rows: any[]) => setSupplyRequestItems(rows.map(rowToSupplyItem))],

    [
    'transport_requests',
    (rows: any[]) => setTransportRequests(rows.map(rowToTransport))],

    [
    'sitting_requests',
    (rows: any[]) => setSittingRequests(rows.map(rowToSitting))],

    [
    'sitting_request_placements',
    (rows: any[]) =>
    setSittingRequestPlacements(rows.map(rowToSittingPlacement))],

    [
    'clinic_events',
    (rows: any[]) => setClinicEvents(rows.map(rowToClinicEvent))],

    [
    'clinic_slots',
    (rows: any[]) => setClinicSlots(rows.map(rowToClinicSlot))],

    [
    'clinic_slot_procedures',
    (rows: any[]) =>
    setClinicSlotProcedures(rows.map(rowToClinicSlotProcedure))]] as
    const;
    await Promise.all(
      tables.map(async ([table, set]) => {
        const { data, error } = await supabase.
        from(table).
        select('*').
        eq('organization_id', orgId);
        if (error) {
          console.error(`[${table}] load failed:`, error.message);
        } else {
          set(data ?? []);
        }
      })
    );
  }, [orgId]);
  useEffect(() => {
    loadCoordination();
  }, [loadCoordination]);
  const addAnimal = async (
  animal: Omit<Animal, 'id' | 'created_at' | 'updated_at'>) =>
  {
    if (!orgId) {
      console.error('[animals] cannot create — no current organization');
      return;
    }
    const { data, error } = await supabase.
    from('animals').
    insert(animalToInsert(animal, orgId)).
    select('*').
    single();
    if (error) {
      console.error('[animals] create failed:', error.message);
      return;
    }
    if (data) setAnimals((prev) => [rowToAnimal(data), ...prev]);
  };
  const updateAnimal = (id: string, updates: Partial<Animal>) => {
    // Optimistic local update so the UI responds immediately…
    setAnimals((prev) =>
    prev.map((a) =>
    a.id === id ?
    { ...a, ...updates, updated_at: new Date().toISOString() } :
    a
    )
    );
    // …then persist. Reconcile from the server if the write fails.
    const row = animalUpdateToRow(updates);
    if (Object.keys(row).length === 0) return;
    supabase.
    from('animals').
    update(row).
    eq('id', id).
    then(({ error }) => {
      if (error) {
        console.error('[animals] update failed:', error.message);
        loadAnimals();
      }
    });
  };
  const deleteAnimal = (id: string) => {
    const prev = animals;
    setAnimals((cur) => cur.filter((a) => a.id !== id));
    supabase.
    from('animals').
    delete().
    eq('id', id).
    then(({ error }) => {
      if (error) {
        console.error('[animals] delete failed:', error.message);
        setAnimals(prev); // restore
      }
    });
  };
  const addLitter: WhiskerContextType['addLitter'] = async (
  shared,
  members) =>
  {
    if (!orgId) {
      console.error('[litters] cannot create — no current organization');
      return;
    }
    // 1) Create the litter row.
    const { data: litter, error: litterErr } = await supabase.
    from('litters').
    insert(litterToInsert(shared, orgId)).
    select('*').
    single();
    if (litterErr || !litter) {
      console.error('[litters] create failed:', litterErr?.message);
      return;
    }
    setLitters((cur) => [rowToLitter(litter), ...cur]);
    // 2) Create a member animal each, stamped with shared metadata + litter_id.
    const rows = members.map((m) =>
    animalToInsert(
      {
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
        litter_id: litter.id
      } as Omit<Animal, 'id' | 'created_at' | 'updated_at'>,
      orgId
    )
    );
    const { data: created, error: animalsErr } = await supabase.
    from('animals').
    insert(rows).
    select('*');
    if (animalsErr) {
      console.error('[litters] member create failed:', animalsErr.message);
      loadAnimals();
      return;
    }
    if (created) {
      setAnimals((cur) => [...created.map(rowToAnimal), ...cur]);
    }
  };
  const updateLitter: WhiskerContextType['updateLitter'] = async (
  id,
  updates) =>
  {
    const prev = litters;
    setLitters((cur) =>
    cur.map((l) => l.id === id ? { ...l, ...updates } : l)
    );
    const { error } = await supabase.
    from('litters').
    update(litterUpdateToRow(updates)).
    eq('id', id);
    if (error) {
      console.error('[litters] update failed:', error.message);
      setLitters(prev); // restore on failure
    }
  };
  // A foster is a `people` row that includes the 'foster_parent' role. The
  // legacy single `role` is derived from roles[] (it can't be 'foster_parent').
  const addFoster = async (foster: FosterInput) => {
    if (!orgId) {
      console.error('[fosters] cannot create — no current organization');
      return;
    }
    const roles: PersonRole[] = foster.roles.includes('foster_parent') ?
    foster.roles :
    ['foster_parent', ...foster.roles];
    const personPayload = {
      first_name: foster.first_name,
      last_name: foster.last_name,
      email: foster.email,
      phone: foster.phone,
      role: legacyRoleFor(roles),
      roles,
      address: foster.address,
      max_capacity: foster.max_capacity,
      preferred_species: foster.preferred_species,
      notes: foster.notes,
      active: foster.active,
      photo_url: foster.photo_url
    } as Omit<Person, 'id' | 'created_at'>;
    const { data, error } = await supabase.
    from('people').
    insert(personToInsert(personPayload, orgId)).
    select('*').
    single();
    if (error || !data) {
      console.error('[fosters] create failed:', error?.message);
      return;
    }
    setPeople((prev) => [rowToPerson(data), ...prev]);
  };
  const updateFoster = (id: string, updates: Partial<FosterInput>) => {
    // Keep the legacy `role` in sync whenever roles change.
    const patch: Partial<Person> = { ...updates };
    if (updates.roles) patch.role = legacyRoleFor(updates.roles);
    setPeople((prev) =>
    prev.map((p) => p.id === id ? { ...p, ...patch } : p)
    );
    const row = personUpdateToRow(patch);
    if (Object.keys(row).length === 0) return;
    supabase.
    from('people').
    update(row).
    eq('id', id).
    then(({ error }) => {
      if (error) {
        console.error('[fosters] update failed:', error.message);
        loadPeople();
      }
    });
  };
  const addMedicalRecord = async (record: Omit<MedicalRecord, 'id'>) => {
    if (!orgId) {
      console.error('[medical] cannot create — no current organization');
      return;
    }
    const { data, error } = await supabase.
    from('medical_records').
    insert(medicalToInsert(record, orgId)).
    select('*').
    single();
    if (error) {
      console.error('[medical] create failed:', error.message);
      return;
    }
    if (data) setMedicalRecords((prev) => [rowToMedicalRecord(data), ...prev]);
  };
  const updateMedicalRecord = (id: string, updates: Partial<MedicalRecord>) => {
    setMedicalRecords((prev) =>
    prev.map((m) => m.id === id ? { ...m, ...updates } : m)
    );
    const row = medicalUpdateToRow(updates);
    if (Object.keys(row).length === 0) return;
    supabase.
    from('medical_records').
    update(row).
    eq('id', id).
    then(({ error }) => {
      if (error) {
        console.error('[medical] update failed:', error.message);
        loadMedicalRecords();
      }
    });
  };
  const addNote = async (note: Omit<AnimalNote, 'id' | 'created_at'>) => {
    if (!orgId) {
      console.error('[notes] cannot create — no current organization');
      return;
    }
    const { data, error } = await supabase.
    from('animal_notes').
    insert(noteToInsert(note, orgId, user?.id ?? null)).
    select('*').
    single();
    if (error) {
      console.error('[notes] create failed:', error.message);
      return;
    }
    if (data) {
      setNotes((prev) => [rowToNote(data, currentUserLite), ...prev]);
    }
  };
  const addActionItem = async (
  item: Pick<AnimalActionItem, 'animal_id' | 'description' | 'priority'>) =>
  {
    if (!orgId) {
      console.error('[action items] cannot create — no current organization');
      return;
    }
    const { data, error } = await supabase.
    from('animal_action_items').
    insert(actionItemToInsert(item, orgId)).
    select('*').
    single();
    if (error || !data) {
      console.error('[action items] create failed:', error?.message);
      return;
    }
    setActionItems((prev) => [rowToActionItem(data), ...prev]);
  };
  const updateActionItem = (
  id: string,
  updates: Partial<AnimalActionItem>) =>
  {
    setActionItems((prev) =>
    prev.map((a) => a.id === id ? { ...a, ...updates } : a)
    );
    const row = actionItemUpdateToRow(updates);
    if (Object.keys(row).length === 0) return;
    supabase.
    from('animal_action_items').
    update(row).
    eq('id', id).
    then(({ error }) => {
      if (error) {
        console.error('[action items] update failed:', error.message);
        loadActionItems();
      }
    });
  };
  const completeActionItem = (id: string, completionNote?: string) =>
  updateActionItem(id, {
    status: 'completed',
    completed_at: new Date().toISOString(),
    completed_by: user?.id ?? undefined,
    completion_note: completionNote || undefined
  });
  const cancelActionItem = (id: string, completionNote?: string) =>
  updateActionItem(id, {
    status: 'cancelled',
    completed_at: new Date().toISOString(),
    completed_by: user?.id ?? undefined,
    completion_note: completionNote || undefined
  });
  const addPlacement = async (placement: Omit<FosterPlacement, 'id'>) => {
    if (!orgId) {
      console.error('[placements] cannot create — no current organization');
      return;
    }
    const { data, error } = await supabase.
    from('foster_placements').
    insert(placementToInsert(placement, orgId)).
    select('*').
    single();
    if (error) {
      console.error('[placements] create failed:', error.message);
      return;
    }
    if (data) setPlacements((prev) => [rowToPlacement(data), ...prev]);
  };
  const updatePlacement = (id: string, updates: Partial<FosterPlacement>) => {
    setPlacements((prev) =>
    prev.map((p) => p.id === id ? { ...p, ...updates } : p)
    );
    const row = placementUpdateToRow(updates);
    if (Object.keys(row).length === 0) return;
    supabase.
    from('foster_placements').
    update(row).
    eq('id', id).
    then(({ error }) => {
      if (error) {
        console.error('[placements] update failed:', error.message);
        loadPlacements();
      }
    });
  };
  const addPerson = async (
  person: Omit<Person, 'id' | 'created_at'>)
  : Promise<Person | undefined> => {
    if (!orgId) {
      console.error('[people] cannot create — no current organization');
      return undefined;
    }
    const { data, error } = await supabase.
    from('people').
    insert(personToInsert(person, orgId)).
    select('*').
    single();
    if (error) {
      console.error('[people] create failed:', error.message);
      return undefined;
    }
    const created = rowToPerson(data);
    setPeople((prev) => [created, ...prev]);
    return created;
  };
  const updatePerson = (id: string, updates: Partial<Person>) => {
    setPeople((prev) =>
    prev.map((p) => p.id === id ? { ...p, ...updates } : p)
    );
    const row = personUpdateToRow(updates);
    if (Object.keys(row).length === 0) return;
    supabase.
    from('people').
    update(row).
    eq('id', id).
    then(({ error }) => {
      if (error) {
        console.error('[people] update failed:', error.message);
        loadPeople();
      }
    });
  };
  // — Adoptions —————————————————————————————————————————————————————
  const ensureAdopterRole = (personId: string) => {
    const person = people.find((p) => p.id === personId);
    if (!person || person.roles.includes('adopter')) return;
    const nextRoles: PersonRole[] = [...person.roles, 'adopter'];
    updatePerson(personId, { roles: nextRoles, role: legacyRoleFor(nextRoles) });
  };
  const addAdoption: WhiskerContextType['addAdoption'] = async (input) => {
    if (!orgId) {
      console.error('[adoptions] cannot create — no current organization');
      return;
    }
    const { data, error } = await supabase.
    from('adoptions').
    insert(adoptionToInsert(input, orgId)).
    select('*').
    single();
    if (error || !data) {
      console.error('[adoptions] create failed:', error?.message);
      return;
    }
    setAdoptions((prev) => [rowToAdoption(data), ...prev]);
    ensureAdopterRole(input.adopter_id);
    // Mark the animal on hold for the duration of the adoption — this is now
    // the canonical "adoption pending" signal (replaces the old
    // status='adoption_pending'). cancelAdoption / completeAdoption clear it.
    updateAnimal(input.animal_id, { is_on_hold: true });
  };
  const updateAdoption: WhiskerContextType['updateAdoption'] = (id, updates) => {
    const prev = adoptions;
    setAdoptions((cur) =>
    cur.map((a) => a.id === id ? { ...a, ...updates } : a)
    );
    const row = adoptionUpdateToRow(updates);
    if (Object.keys(row).length === 0) return;
    supabase.
    from('adoptions').
    update(row).
    eq('id', id).
    then(({ error }) => {
      if (error) {
        console.error('[adoptions] update failed:', error.message);
        setAdoptions(prev);
      }
    });
  };
  const setAdoptionStatus: WhiskerContextType['setAdoptionStatus'] = (
  id,
  status) =>
  {
    const adoption = adoptions.find((a) => a.id === id);
    if (!adoption) return;
    updateAdoption(id, adoptionStatusPatch(adoption, status));
  };
  const completeAdoption: WhiskerContextType['completeAdoption'] = (
  id,
  donationAmount) =>
  {
    const adoption = adoptions.find((a) => a.id === id);
    if (!adoption) return;
    const ts = new Date().toISOString();
    // 1. The adoption record becomes completed.
    updateAdoption(id, {
      status: 'completed',
      completed_at: ts,
      ...(donationAmount != null ? { donation_amount: donationAmount } : {})
    });
    // 2. The animal becomes adopted; stamp the adopter, clear the foster cache,
    //    and lift the adoption-driven hold.
    const animalUpdates: Partial<Animal> = {
      status: 'adopted',
      adopted_by_id: adoption.adopter_id,
      adopted_at: ts,
      is_on_hold: false
    };
    (animalUpdates as Record<string, unknown>).current_foster_id = null;
    updateAnimal(adoption.animal_id, animalUpdates);
    // 3. Close any active foster placement.
    const active = placements.find(
      (p) =>
      p.animal_id === adoption.animal_id && p.placement_status === 'active'
    );
    if (active) {
      const endDate = ts.split('T')[0];
      setPlacements((cur) =>
      cur.map((p) =>
      p.id === active.id ?
      {
        ...p,
        placement_status: 'completed' as const,
        end_date: endDate,
        reason_ended: 'Adopted'
      } :
      p
      )
      );
      supabase.
      from('foster_placements').
      update({
        placement_status: 'completed',
        end_date: endDate,
        reason_ended: 'Adopted'
      }).
      eq('id', active.id).
      then(({ error }) => {
        if (error) {
          console.error('[placements] close-on-adopt failed:', error.message);
          loadPlacements();
        }
      });
    }
    // 4. Make sure the adopter carries the adopter role.
    ensureAdopterRole(adoption.adopter_id);
  };
  const cancelAdoption: WhiskerContextType['cancelAdoption'] = (id, reason) => {
    const adoption = adoptions.find((a) => a.id === id);
    updateAdoption(id, {
      status: 'cancelled',
      cancelled_at: new Date().toISOString(),
      ...(reason && reason.trim() ? { notes: reason.trim() } : {})
    });
    // Lift the adoption-driven hold so the animal is selectable again.
    if (adoption) {
      updateAnimal(adoption.animal_id, { is_on_hold: false });
    }
  };
  const addPhoto = async (input: NewPhotoInput) => {
    if (!orgId) {
      console.error('[photos] cannot create — no current organization');
      return;
    }
    let storagePath: string | null = null;
    let publicUrl = input.url?.trim() ?? '';
    if (input.file) {
      // Upload the file bytes to Storage at <org>/<animal>/<uuid>.<ext>.
      const ext = input.file.name.split('.').pop()?.toLowerCase() || 'jpg';
      const path = `${orgId}/${input.animal_id}/${crypto.randomUUID()}.${ext}`;
      const { error: upErr } = await supabase.storage.
      from('animal-photos').
      upload(path, input.file, { upsert: false });
      if (upErr) {
        console.error('[photos] upload failed:', upErr.message);
        return;
      }
      storagePath = path;
      publicUrl = supabase.storage.
      from('animal-photos').
      getPublicUrl(path).data.publicUrl;
    }
    if (!publicUrl) {
      console.error('[photos] no file or url provided');
      return;
    }
    const { data, error } = await supabase.
    from('animal_photos').
    insert(
      photoToInsert(
        {
          animal_id: input.animal_id,
          category: input.category,
          caption: input.caption,
          storage_path: storagePath,
          public_url: publicUrl
        },
        orgId
      )
    ).
    select('*').
    single();
    if (error) {
      console.error('[photos] create failed:', error.message);
      return;
    }
    if (data) {
      const newPhoto = rowToPhoto(data);
      setPhotos((prev) => [newPhoto, ...prev]);
      // Set as profile when explicitly requested, or default to the first
      // photo when the animal doesn't have one yet.
      const animal = animals.find((a) => a.id === input.animal_id);
      if (input.setAsProfile || (animal && !animal.primary_photo_url)) {
        updateAnimal(input.animal_id, { primary_photo_url: newPhoto.url });
      }
    }
  };
  const deletePhoto = (id: string) => {
    const target = photos.find((p) => p.id === id);
    const prev = photos;
    setPhotos((cur) => cur.filter((p) => p.id !== id));
    void (async () => {
      // Remove the underlying object first (only for uploaded files).
      if (target?.storage_path) {
        const { error: rmErr } = await supabase.storage.
        from('animal-photos').
        remove([target.storage_path]);
        if (rmErr) {
          console.error('[photos] storage remove failed:', rmErr.message);
        }
      }
      const { error } = await supabase.
      from('animal_photos').
      delete().
      eq('id', id);
      if (error) {
        console.error('[photos] delete failed:', error.message);
        setPhotos(prev); // restore
      }
    })();
  };
  const addRelationship = async (rel: Omit<AnimalRelationship, 'id'>) => {
    if (!orgId) {
      console.error('[relationships] cannot create — no current organization');
      return;
    }
    const { data, error } = await supabase.
    from('animal_relationships').
    insert(relationshipToInsert(rel, orgId)).
    select('*').
    single();
    if (error) {
      console.error('[relationships] create failed:', error.message);
      return;
    }
    if (data) setRelationships((prev) => [rowToRelationship(data), ...prev]);
  };
  const deleteRelationship = (id: string) => {
    const prev = relationships;
    setRelationships((cur) => cur.filter((r) => r.id !== id));
    supabase.
    from('animal_relationships').
    delete().
    eq('id', id).
    then(({ error }) => {
      if (error) {
        console.error('[relationships] delete failed:', error.message);
        setRelationships(prev); // restore
      }
    });
  };
  const placeAnimal = async (
  animal_id: string,
  person_id: string,
  start_date: string,
  notes?: string) =>
  {
    if (!orgId) {
      console.error('[placements] cannot place — no current organization');
      return;
    }
    const { data, error } = await supabase.
    from('foster_placements').
    insert(
      placementToInsert(
        {
          animal_id,
          person_id,
          start_date,
          placement_status: 'active',
          placement_type: 'foster',
          notes
        },
        orgId
      )
    ).
    select('*').
    single();
    if (error) {
      console.error('[placements] place failed:', error.message);
      return;
    }
    if (data) setPlacements((prev) => [rowToPlacement(data), ...prev]);
    // Fostered is derived from the active placement; only sync the cache here.
    // Lifecycle status is left untouched (an animal can be in foster at any stage).
    updateAnimal(animal_id, {
      current_foster_id: person_id
    });
  };
  const reassignFoster = async (
  animal_id: string,
  new_person_id: string,
  start_date: string,
  reason_ended?: string,
  notes?: string) =>
  {
    if (!orgId) {
      console.error('[placements] cannot reassign — no current organization');
      return;
    }
    // Close the current active placement BEFORE opening the new one — the
    // partial unique index allows only one active placement per animal.
    const active = placements.find(
      (p) => p.animal_id === animal_id && p.placement_status === 'active'
    );
    const closedReason = reason_ended || 'Reassigned to a new foster.';
    if (active) {
      const { error: closeErr } = await supabase.
      from('foster_placements').
      update({
        placement_status: 'completed',
        end_date: start_date,
        reason_ended: closedReason
      }).
      eq('id', active.id);
      if (closeErr) {
        console.error('[placements] close failed:', closeErr.message);
        return;
      }
    }
    const { data, error } = await supabase.
    from('foster_placements').
    insert(
      placementToInsert(
        {
          animal_id,
          person_id: new_person_id,
          start_date,
          placement_status: 'active',
          placement_type: 'foster',
          notes
        },
        orgId
      )
    ).
    select('*').
    single();
    if (error) {
      console.error('[placements] reassign insert failed:', error.message);
      loadPlacements(); // reconcile (the old one is already closed)
      return;
    }
    setPlacements((prev) => {
      const closed = prev.map((p) =>
      active && p.id === active.id ?
      {
        ...p,
        placement_status: 'completed' as const,
        end_date: start_date,
        reason_ended: closedReason
      } :
      p
      );
      return data ? [rowToPlacement(data), ...closed] : closed;
    });
    // Only the denormalized cache changes; lifecycle status is independent.
    updateAnimal(animal_id, {
      current_foster_id: new_person_id
    });
  };
  const addProduct = async (product: Omit<Product, 'id'>) => {
    if (!orgId) {
      console.error('[products] cannot create — no current organization');
      return;
    }
    const { data, error } = await supabase.
    from('products').
    insert(productToInsert(product, orgId)).
    select('*').
    single();
    if (error) {
      console.error('[products] create failed:', error.message);
      return;
    }
    if (data) setProducts((prev) => [rowToProduct(data), ...prev]);
  };
  const updateProduct = (id: string, updates: Partial<Product>) => {
    setProducts((prev) =>
    prev.map((p) => p.id === id ? { ...p, ...updates } : p)
    );
    const row = productUpdateToRow(updates);
    if (Object.keys(row).length === 0) return;
    supabase.
    from('products').
    update(row).
    eq('id', id).
    then(({ error }) => {
      if (error) {
        console.error('[products] update failed:', error.message);
        loadCoordination();
      }
    });
  };
  const addSupplyRequest = async (
  req: Omit<SupplyRequest, 'id' | 'created_at' | 'updated_at'>) =>
  {
    if (!orgId) {
      console.error('[supply] cannot create — no current organization');
      return '';
    }
    const { data, error } = await supabase.
    from('supply_requests').
    insert(supplyRequestToInsert(req, orgId)).
    select('*').
    single();
    if (error || !data) {
      console.error('[supply] create failed:', error?.message);
      return '';
    }
    setSupplyRequests((prev) => [rowToSupplyRequest(data), ...prev]);
    return data.id as string;
  };
  const updateSupplyRequest = (id: string, updates: Partial<SupplyRequest>) => {
    setSupplyRequests((prev) =>
    prev.map((sr) =>
    sr.id === id ?
    { ...sr, ...updates, updated_at: new Date().toISOString() } :
    sr
    )
    );
    const row = supplyRequestUpdateToRow(updates);
    if (Object.keys(row).length === 0) return;
    supabase.
    from('supply_requests').
    update(row).
    eq('id', id).
    then(({ error }) => {
      if (error) {
        console.error('[supply] update failed:', error.message);
        loadCoordination();
      }
    });
  };
  const addSupplyRequestItem = async (item: Omit<SupplyRequestItem, 'id'>) => {
    if (!orgId) return;
    const { data, error } = await supabase.
    from('supply_request_items').
    insert(supplyItemToInsert(item, orgId)).
    select('*').
    single();
    if (error) {
      console.error('[supply item] create failed:', error.message);
      return;
    }
    if (data) setSupplyRequestItems((prev) => [rowToSupplyItem(data), ...prev]);
  };
  // — Transport Requests —————————————————————————————————
  const addTransportRequest = async (
  req: Omit<TransportRequest, 'id' | 'created_at' | 'updated_at'>) =>
  {
    if (!orgId) {
      console.error('[transport] cannot create — no current organization');
      return '';
    }
    const { data, error } = await supabase.
    from('transport_requests').
    insert(transportToInsert(req, orgId)).
    select('*').
    single();
    if (error || !data) {
      console.error('[transport] create failed:', error?.message);
      return '';
    }
    setTransportRequests((prev) => [rowToTransport(data), ...prev]);
    return data.id as string;
  };
  const updateTransportRequest = (
  id: string,
  updates: Partial<TransportRequest>) =>
  {
    setTransportRequests((prev) =>
    prev.map((tr) =>
    tr.id === id ?
    { ...tr, ...updates, updated_at: new Date().toISOString() } :
    tr
    )
    );
    const row = transportUpdateToRow(updates);
    if (Object.keys(row).length === 0) return;
    supabase.
    from('transport_requests').
    update(row).
    eq('id', id).
    then(({ error }) => {
      if (error) {
        console.error('[transport] update failed:', error.message);
        loadCoordination();
      }
    });
  };
  const claimTransportRequest = (id: string, volunteer_person_id: string) => {
    updateTransportRequest(id, {
      assigned_volunteer_person_id: volunteer_person_id,
      status: 'claimed'
    });
  };
  // — Sitting Requests —————————————————————————————————
  const addSittingRequest = async (
  req: Omit<SittingRequest, 'id' | 'created_at' | 'updated_at'>,
  placement_ids: string[]) =>
  {
    if (!orgId) {
      console.error('[sitting] cannot create — no current organization');
      return '';
    }
    const { data, error } = await supabase.
    from('sitting_requests').
    insert(sittingToInsert(req, orgId)).
    select('*').
    single();
    if (error || !data) {
      console.error('[sitting] create failed:', error?.message);
      return '';
    }
    const newReq = rowToSitting(data);
    setSittingRequests((prev) => [newReq, ...prev]);
    // Snapshot the covered placements.
    if (placement_ids.length > 0) {
      const rows = placement_ids.map((pid) => ({
        organization_id: orgId,
        sitting_request_id: newReq.id,
        foster_placement_id: pid
      }));
      const { data: placed, error: pErr } = await supabase.
      from('sitting_request_placements').
      insert(rows).
      select('*');
      if (pErr) {
        console.error('[sitting placements] create failed:', pErr.message);
      } else if (placed) {
        setSittingRequestPlacements((prev) => [
        ...placed.map(rowToSittingPlacement),
        ...prev]
        );
      }
    }
    return newReq.id;
  };
  const updateSittingRequest = (
  id: string,
  updates: Partial<SittingRequest>) =>
  {
    setSittingRequests((prev) =>
    prev.map((s) =>
    s.id === id ?
    { ...s, ...updates, updated_at: new Date().toISOString() } :
    s
    )
    );
    const row = sittingUpdateToRow(updates);
    if (Object.keys(row).length === 0) return;
    supabase.
    from('sitting_requests').
    update(row).
    eq('id', id).
    then(({ error }) => {
      if (error) {
        console.error('[sitting] update failed:', error.message);
        loadCoordination();
      }
    });
  };
  const acceptSittingRequest = (id: string, sitter_person_id: string) => {
    updateSittingRequest(id, {
      sitter_person_id,
      status: 'claimed'
    });
  };
  // — Clinic Events / Slots ——————————————————————————————
  const addClinicEvent = async (
  event: Omit<ClinicEvent, 'id' | 'created_at' | 'updated_at'>) =>
  {
    if (!orgId) {
      console.error('[clinic] cannot create — no current organization');
      return '';
    }
    const { data, error } = await supabase.
    from('clinic_events').
    insert(clinicEventToInsert(event, orgId)).
    select('*').
    single();
    if (error || !data) {
      console.error('[clinic] create failed:', error?.message);
      return '';
    }
    setClinicEvents((prev) => [rowToClinicEvent(data), ...prev]);
    return data.id as string;
  };
  const updateClinicEvent = (id: string, updates: Partial<ClinicEvent>) => {
    setClinicEvents((prev) =>
    prev.map((c) =>
    c.id === id ?
    { ...c, ...updates, updated_at: new Date().toISOString() } :
    c
    )
    );
    const row = clinicEventUpdateToRow(updates);
    if (Object.keys(row).length === 0) return;
    supabase.
    from('clinic_events').
    update(row).
    eq('id', id).
    then(({ error }) => {
      if (error) {
        console.error('[clinic] update failed:', error.message);
        loadCoordination();
      }
    });
  };
  const addClinicSlot = async (
  slot: Omit<ClinicSlot, 'id'>,
  procedureTypes: ClinicSlotProcedureType[]) =>
  {
    if (!orgId) return;
    const { data, error } = await supabase.
    from('clinic_slots').
    insert(clinicSlotToInsert(slot, orgId)).
    select('*').
    single();
    if (error || !data) {
      console.error('[clinic slot] create failed:', error?.message);
      return;
    }
    const newSlot = rowToClinicSlot(data);
    setClinicSlots((prev) => [newSlot, ...prev]);
    if (procedureTypes.length === 0) return;
    const rows = procedureTypes.map((t) =>
    clinicSlotProcedureToInsert(
      { clinic_slot_id: newSlot.id, procedure_type: t, completed: false },
      orgId
    )
    );
    const { data: procs, error: procErr } = await supabase.
    from('clinic_slot_procedures').
    insert(rows).
    select('*');
    if (procErr) {
      console.error('[clinic slot procedures] create failed:', procErr.message);
      loadCoordination();
      return;
    }
    if (procs) {
      setClinicSlotProcedures((prev) => [
      ...procs.map(rowToClinicSlotProcedure),
      ...prev]
      );
    }
  };
  const updateClinicSlot = (id: string, updates: Partial<ClinicSlot>) => {
    setClinicSlots((prev) =>
    prev.map((s) => s.id === id ? { ...s, ...updates } : s)
    );
    const row = clinicSlotUpdateToRow(updates);
    if (Object.keys(row).length === 0) return;
    supabase.
    from('clinic_slots').
    update(row).
    eq('id', id).
    then(({ error }) => {
      if (error) {
        console.error('[clinic slot] update failed:', error.message);
        loadCoordination();
      }
    });
  };
  const deleteClinicSlot = (id: string) => {
    const prevSlots = clinicSlots;
    const prevProcs = clinicSlotProcedures;
    setClinicSlots((cur) => cur.filter((s) => s.id !== id));
    // The DB cascades the child procedures; mirror that locally.
    setClinicSlotProcedures((cur) =>
    cur.filter((p) => p.clinic_slot_id !== id)
    );
    supabase.
    from('clinic_slots').
    delete().
    eq('id', id).
    then(({ error }) => {
      if (error) {
        console.error('[clinic slot] delete failed:', error.message);
        setClinicSlots(prevSlots);
        setClinicSlotProcedures(prevProcs);
      }
    });
  };
  const addClinicSlotProcedure = async (
  clinic_slot_id: string,
  procedure_type: ClinicSlotProcedureType,
  opts?: { completed?: boolean }) =>
  {
    if (!orgId) return;
    const { data, error } = await supabase.
    from('clinic_slot_procedures').
    insert(
      clinicSlotProcedureToInsert(
        {
          clinic_slot_id,
          procedure_type,
          completed: opts?.completed ?? false
        },
        orgId
      )
    ).
    select('*').
    single();
    if (error || !data) {
      console.error('[clinic slot procedure] create failed:', error?.message);
      return;
    }
    setClinicSlotProcedures((prev) => [rowToClinicSlotProcedure(data), ...prev]);
  };
  const updateClinicSlotProcedure = (
  id: string,
  updates: Partial<ClinicSlotProcedure>) =>
  {
    setClinicSlotProcedures((prev) =>
    prev.map((p) => p.id === id ? { ...p, ...updates } : p)
    );
    const row = clinicSlotProcedureUpdateToRow(updates);
    if (Object.keys(row).length === 0) return;
    supabase.
    from('clinic_slot_procedures').
    update(row).
    eq('id', id).
    then(({ error }) => {
      if (error) {
        console.error('[clinic slot procedure] update failed:', error.message);
        loadCoordination();
      }
    });
  };
  const deleteClinicSlotProcedure = (id: string) => {
    const prev = clinicSlotProcedures;
    setClinicSlotProcedures((cur) => cur.filter((p) => p.id !== id));
    supabase.
    from('clinic_slot_procedures').
    delete().
    eq('id', id).
    then(({ error }) => {
      if (error) {
        console.error('[clinic slot procedure] delete failed:', error.message);
        setClinicSlotProcedures(prev);
      }
    });
  };
  return (
    <WhiskerContext.Provider
      value={{
        animals,
        animalsLoading,
        fosters,
        fostersLoading,
        placements,
        medicalRecords,
        notes,
        actionItems,
        relationships,
        photos,
        people,
        peopleLoading,
        litters,
        littersLoading,
        adoptions,
        adoptionsLoading,
        breeds,
        products,
        addProduct,
        updateProduct,
        supplyRequests,
        supplyRequestItems,
        addAnimal,
        updateAnimal,
        deleteAnimal,
        addLitter,
        updateLitter,
        addFoster,
        updateFoster,
        addMedicalRecord,
        updateMedicalRecord,
        addNote,
        addActionItem,
        updateActionItem,
        completeActionItem,
        cancelActionItem,
        addPlacement,
        updatePlacement,
        addPerson,
        updatePerson,
        addAdoption,
        updateAdoption,
        setAdoptionStatus,
        completeAdoption,
        cancelAdoption,
        addPhoto,
        deletePhoto,
        addRelationship,
        deleteRelationship,
        placeAnimal,
        reassignFoster,
        addSupplyRequest,
        updateSupplyRequest,
        addSupplyRequestItem,
        transportRequests,
        addTransportRequest,
        updateTransportRequest,
        claimTransportRequest,
        sittingRequests,
        sittingRequestPlacements,
        addSittingRequest,
        updateSittingRequest,
        acceptSittingRequest,
        clinicEvents,
        clinicSlots,
        clinicSlotProcedures,
        addClinicEvent,
        updateClinicEvent,
        addClinicSlot,
        updateClinicSlot,
        deleteClinicSlot,
        addClinicSlotProcedure,
        updateClinicSlotProcedure,
        deleteClinicSlotProcedure
      }}>
      
      {children}
    </WhiskerContext.Provider>);

}
export function useWhisker() {
  const context = useContext(WhiskerContext);
  if (context === undefined) {
    throw new Error('useWhisker must be used within a WhiskerProvider');
  }
  return context;
}