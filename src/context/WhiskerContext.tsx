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
  AdoptionReturnReason,
  Breed,
  SpeciesCatalog,
  OrganizationSpecies,
  OrganizationBreed,
  Trait,
  AnimalTrait,
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
  ClinicSlotProcedureType,
  ArchiveTable,
  ArchivedRecord } from
'../types';
import { supabase } from '../lib/supabase';
import { rowToBreed } from '../lib/breedsApi';
import { rowToSpecies } from '../lib/speciesApi';
import { rowToOrgSpecies, rowToOrgBreed } from '../lib/organizationCatalogApi';
import {
  rowToTrait,
  rowToAnimalTrait,
  traitToInsert,
  traitUpdateToRow } from
'../lib/traitsApi';
import {
  litterToInsert,
  litterUpdateToRow,
  rowToLitter } from
'../lib/littersApi';
import {
  adoptionToInsert,
  adoptionReturnToInsert,
  adoptionUpdateToRow,
  rowToAdoption } from
'../lib/adoptionsApi';
import { adoptionStatusPatch } from '../lib/adoptions';
import { useAuth } from './AuthContext';
import {
  rowToAnimal,
  animalToInsert,
  animalUpdateToRow,
  fetchAllPages,
  ANIMAL_INDEX_COLUMNS } from
'../lib/animalsApi';
import {
  IN_CARE_STATUSES,
  HISTORICAL_STATUSES } from
'../lib/animalStatus';
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
  legacyRoleFor,
  PEOPLE_INDEX_COLUMNS } from
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
  /**
   * Heavy full rows loaded so far. Starts IN-CARE ONLY; grows on demand via
   * ensureHistoricalLoaded / ensureAnimal. Do NOT assume this equals "in care" —
   * filter by status for the subset you need.
   */
  animals: Animal[];
  /** True while the Supabase-backed animals list is being fetched. */
  animalsLoading: boolean;
  /**
   * Lightweight slim-projection index of EVERY animal (incl. historical), for
   * search / pickers / name-resolution. Use this (not `animals`) wherever you
   * only need to look up or list an animal's name/species/photo/status.
   */
  animalsIndex: Animal[];
  /** True while the all-animals index is being fetched. */
  animalsIndexLoading: boolean;
  /** True once historical full rows have been merged into `animals`. */
  historicalLoaded: boolean;
  /** Merge historical full rows into `animals` (idempotent). */
  ensureHistoricalLoaded: () => Promise<void>;
  /** Fetch one full row by id (any status), merging it into `animals`. */
  ensureAnimal: (id: string) => Promise<Animal | null>;
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
  /**
   * Heavy full rows loaded so far. Starts ACTIVE ONLY (+ self/account records);
   * grows on demand via ensureInactiveLoaded / ensurePerson. Do NOT assume this
   * equals "active" — filter by `active` for the subset you need.
   */
  people: Person[];
  /**
   * Lightweight slim-projection index of EVERY contact (incl. inactive), for
   * search / pickers / name-resolution. Use this (not `people`) wherever you
   * only need to look up or list a person's name/photo/role/status.
   */
  peopleIndex: Person[];
  /** True while the all-people index is being fetched. */
  peopleIndexLoading: boolean;
  /** True once inactive full rows have been merged into `people`. */
  inactiveLoaded: boolean;
  /** Merge inactive full rows into `people` (idempotent). */
  ensureInactiveLoaded: () => Promise<void>;
  /** Fetch one full row by id (any active state), merging it into `people`. */
  ensurePerson: (id: string) => Promise<Person | null>;
  litters: Litter[];
  littersLoading: boolean;
  adoptions: Adoption[];
  adoptionsLoading: boolean;
  /** True while the Supabase-backed people list is being fetched. */
  peopleLoading: boolean;
  /** Global species catalog (not org-scoped). Active rows, sorted for display. */
  species: SpeciesCatalog[];
  /** Global breed catalog (not org-scoped). */
  breeds: Breed[];
  /** Per-org species enablement (migration 0042). */
  organizationSpecies: OrganizationSpecies[];
  /** Per-org breed restriction (opt-in; empty for a species → all allowed). */
  organizationBreeds: OrganizationBreed[];
  /** Enable/disable a species for the current org (upserts the org_species row). */
  setSpeciesEnabled: (speciesId: string, enabled: boolean) => void;
  /** Mark a species as the org's default (and ensure it's enabled). */
  setDefaultSpecies: (speciesId: string) => void;
  /** Replace a species' accepted-breed allowlist ([] clears = all allowed). */
  setAllowedBreeds: (speciesId: string, breedIds: string[]) => void;
  /** Per-org trait definitions (migration 0045). */
  traits: Trait[];
  /** Animal↔trait assignments for the org. */
  animalTraits: AnimalTrait[];
  /** Replace an animal's assigned traits (diffs add/remove animal_traits rows). */
  setAnimalTraits: (animalId: string, traitIds: string[]) => void;
  /** Create a trait definition for the org (Settings). */
  addTrait: (trait: {
    name: string;
    description?: string;
    species_id?: string;
    active?: boolean;
  }) => void;
  /** Edit a trait definition (name/description/species/active). */
  updateTrait: (id: string, updates: Partial<Trait>) => void;
  products: Product[];
  addProduct: (product: Omit<Product, 'id'>) => void;
  updateProduct: (id: string, updates: Partial<Product>) => void;
  supplyRequests: SupplyRequest[];
  supplyRequestItems: SupplyRequestItem[];
  addAnimal: (
  animal: Omit<Animal, 'id' | 'created_at' | 'updated_at'>)
  => Promise<Animal | undefined>;
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
  /**
   * Upload a profile photo for a person to Storage and set their `photo_url`.
   * Used by a signed-in user to set/replace their own avatar (email/password
   * accounts have no provider photo; Google ones are a one-time snapshot).
   */
  uploadPersonPhoto: (personId: string, file: File) => Promise<void>;
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
  /**
   * Reverse a completed adoption: mark the record `returned` (reason/notes) and
   * bring the animal back into care (status -> intake, clears adopter fields).
   */
  returnAdoption: (
  id: string,
  input: {
    returned_at: string;
    return_reason: AdoptionReturnReason;
    return_notes?: string;
  })
  => void;
  /**
   * Record a return when no adoption record exists yet — creates a `returned`
   * adoption row (original adopter + details) and brings the animal into care.
   */
  recordAdoptionReturn: (
  input: {
    animal_id: string;
    adopter_id: string;
    returned_at: string;
    return_reason: AdoptionReturnReason;
    return_notes?: string;
  })
  => Promise<void>;
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
  => Promise<ClinicSlot | undefined>;
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
  // --- Archive / Recycle Bin ---
  /**
   * Soft-delete a record. Goes through the archive_record RPC, which enforces
   * permission (creator-or-admin for low-risk tables, admin-only otherwise)
   * and per-table active-obligation blockers. Throws on failure so callers
   * can show the server's reason.
   */
  archiveRecord: (table: ArchiveTable, id: string) => Promise<void>;
  /** Restore a soft-deleted record (original archiver or admin). Throws on failure. */
  restoreRecord: (table: ArchiveTable, id: string) => Promise<void>;
  /** Read the unified Recycle Bin (newest first). */
  fetchArchived: () => Promise<ArchivedRecord[]>;
}
export const WhiskerContext = createContext<WhiskerContextType | undefined>(
  undefined
);
export function WhiskerProvider({ children }: {children: React.ReactNode;}) {
  // Animals and notes are now Supabase-backed (org-scoped). Other collections
  // remain on seed for now until they're ported.
  const { currentOrg, user } = useAuth();
  const orgId = currentOrg?.id ?? null;
  // `animals` holds the heavy full rows we've loaded so far. It starts as
  // IN-CARE ONLY (the operational default) and grows on demand when historical
  // rows are requested (ensureHistoricalLoaded) or a single historical animal
  // is opened (ensureAnimal). Consumers must therefore filter for the subset
  // they want rather than assume `animals` equals "in care".
  const [animals, setAnimals] = useState<Animal[]>([]);
  const [animalsLoading, setAnimalsLoading] = useState(false);
  const [historicalLoaded, setHistoricalLoaded] = useState(false);
  const loadAnimals = useCallback(async () => {
    if (!orgId) {
      setAnimals([]);
      setHistoricalLoaded(false);
      return;
    }
    setAnimalsLoading(true);
    setHistoricalLoaded(false);
    const { data, error } = await fetchAllPages((from, to) =>
    supabase.
    from('animals').
    select('*').
    eq('organization_id', orgId).
    eq('is_deleted', false).
    in('status', IN_CARE_STATUSES).
    order('updated_at', { ascending: false }).
    range(from, to)
    );
    if (error) {
      console.error('[animals] load failed:', error.message);
    } else {
      setAnimals(data.map(rowToAnimal));
    }
    setAnimalsLoading(false);
  }, [orgId]);
  useEffect(() => {
    loadAnimals();
  }, [loadAnimals]);

  // Lightweight all-animals index (slim projection, every status incl.
  // historical). Powers global search, animal pickers, and name/photo/status
  // resolution across coordination pages without loading heavy historical rows.
  const [animalsIndex, setAnimalsIndex] = useState<Animal[]>([]);
  const [animalsIndexLoading, setAnimalsIndexLoading] = useState(false);
  const loadAnimalsIndex = useCallback(async () => {
    if (!orgId) {
      setAnimalsIndex([]);
      return;
    }
    setAnimalsIndexLoading(true);
    const { data, error } = await fetchAllPages((from, to) =>
    supabase.
    from('animals').
    select(ANIMAL_INDEX_COLUMNS).
    eq('organization_id', orgId).
    eq('is_deleted', false).
    order('updated_at', { ascending: false }).
    range(from, to)
    );
    if (error) {
      console.error('[animals] index load failed:', error.message);
    } else {
      setAnimalsIndex(data.map(rowToAnimal));
    }
    setAnimalsIndexLoading(false);
  }, [orgId]);
  useEffect(() => {
    loadAnimalsIndex();
  }, [loadAnimalsIndex]);

  // Pull historical full rows into `animals` (idempotent). Drives the Animals
  // page "Show Historical Animals" toggle and the Reports page.
  const ensureHistoricalLoaded = useCallback(async () => {
    if (!orgId || historicalLoaded) return;
    const { data, error } = await fetchAllPages((from, to) =>
    supabase.
    from('animals').
    select('*').
    eq('organization_id', orgId).
    eq('is_deleted', false).
    in('status', HISTORICAL_STATUSES).
    order('updated_at', { ascending: false }).
    range(from, to)
    );
    if (error) {
      console.error('[animals] historical load failed:', error.message);
      return;
    }
    const historical = data.map(rowToAnimal);
    setAnimals((cur) => {
      const have = new Set(cur.map((a) => a.id));
      return [...cur, ...historical.filter((a) => !have.has(a.id))];
    });
    setHistoricalLoaded(true);
  }, [orgId, historicalLoaded]);

  // Fetch one full row by id (any status) and merge into `animals` if missing.
  // Lets AnimalProfile resolve a historical animal that isn't in the in-care
  // default load. Returns the animal, or null if not found.
  const ensureAnimal = useCallback(
    async (id: string): Promise<Animal | null> => {
      if (!orgId) return null;
      const existing = animals.find((a) => a.id === id);
      if (existing) return existing;
      const { data, error } = await supabase.
      from('animals').
      select('*').
      eq('organization_id', orgId).
      eq('id', id).
      maybeSingle();
      if (error || !data) {
        if (error) console.error('[animals] fetch by id failed:', error.message);
        return null;
      }
      const animal = rowToAnimal(data);
      setAnimals((cur) =>
      cur.some((a) => a.id === animal.id) ? cur : [...cur, animal]
      );
      return animal;
    },
    [orgId, animals]
  );
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
    eq('is_deleted', false).
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
    eq('is_deleted', false).
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
    eq('is_deleted', false).
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
    eq('organization_id', orgId).
    eq('is_deleted', false);
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
    eq('organization_id', orgId).
    eq('is_deleted', false);
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
    eq('is_deleted', false).
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
    eq('is_deleted', false).
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
    eq('is_deleted', false).
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
  // `people` holds the heavy full rows loaded so far. It starts ACTIVE ONLY
  // (plus self/account records, which must always load for attribution even if
  // inactive) and grows on demand via ensureInactiveLoaded / ensurePerson.
  // Consumers must filter for the subset they want rather than assume `people`
  // equals "active".
  const [people, setPeople] = useState<Person[]>([]);
  const [peopleLoading, setPeopleLoading] = useState(false);
  const [inactiveLoaded, setInactiveLoaded] = useState(false);
  const loadPeople = useCallback(async () => {
    if (!orgId) {
      setPeople([]);
      setInactiveLoaded(false);
      return;
    }
    setPeopleLoading(true);
    setInactiveLoaded(false);
    const { data, error } = await fetchAllPages((from, to) =>
    supabase.
    from('people').
    select('*').
    eq('organization_id', orgId).
    eq('is_deleted', false).
    // Active contacts + self/account records (user_id set) — the latter must
    // always be present so "requested by"/greeting attribution resolves.
    or('active.eq.true,user_id.not.is.null').
    order('last_name', { ascending: true }).
    range(from, to)
    );
    if (error) {
      console.error('[people] load failed:', error.message);
    } else {
      setPeople(data.map(rowToPerson));
    }
    setPeopleLoading(false);
  }, [orgId]);
  useEffect(() => {
    loadPeople();
  }, [loadPeople]);

  // Lightweight all-people index (slim projection, active + inactive). Powers
  // global search, person pickers' selected-value display, and name/photo
  // resolution for historical references to a now-inactive contact.
  const [peopleIndex, setPeopleIndex] = useState<Person[]>([]);
  const [peopleIndexLoading, setPeopleIndexLoading] = useState(false);
  const loadPeopleIndex = useCallback(async () => {
    if (!orgId) {
      setPeopleIndex([]);
      return;
    }
    setPeopleIndexLoading(true);
    const { data, error } = await fetchAllPages((from, to) =>
    supabase.
    from('people').
    select(PEOPLE_INDEX_COLUMNS).
    eq('organization_id', orgId).
    eq('is_deleted', false).
    order('last_name', { ascending: true }).
    range(from, to)
    );
    if (error) {
      console.error('[people] index load failed:', error.message);
    } else {
      setPeopleIndex(data.map(rowToPerson));
    }
    setPeopleIndexLoading(false);
  }, [orgId]);
  useEffect(() => {
    loadPeopleIndex();
  }, [loadPeopleIndex]);

  // Pull inactive full rows into `people` (idempotent). Drives the Contacts
  // "Show Inactive" toggle, the Fosters list, and the Reports page.
  const ensureInactiveLoaded = useCallback(async () => {
    if (!orgId || inactiveLoaded) return;
    const { data, error } = await fetchAllPages((from, to) =>
      supabase.
      from('people').
      select('*').
      eq('organization_id', orgId).
      eq('is_deleted', false).
      eq('active', false).
      order('last_name', { ascending: true }).
      range(from, to)
    );

    if (error) {
      console.error('[people] inactive load failed:', error.message);
      return;
    }

    const inactive = data.map(rowToPerson);

    setPeople((cur) => {
      const have = new Set(cur.map((p) => p.id));
      return [...cur, ...inactive.filter((p) => !have.has(p.id))];
    });

    setInactiveLoaded(true);
  }, [orgId, inactiveLoaded]);

  // Fetch one full row by id (any active state) and merge into `people` if
  // missing. Lets ContactProfile / FosterProfile resolve an inactive person
  // that isn't in the active default load. Returns the person, or null.
  const ensurePerson = useCallback(
    async (id: string): Promise<Person | null> => {
      if (!orgId) return null;
      const existing = people.find((p) => p.id === id);
      if (existing) return existing;
      const { data, error } = await supabase.
      from('people').
      select('*').
      eq('organization_id', orgId).
      eq('id', id).
      maybeSingle();
      if (error || !data) {
        if (error) console.error('[people] fetch by id failed:', error.message);
        return null;
      }
      const person = rowToPerson(data);
      setPeople((cur) =>
      cur.some((p) => p.id === person.id) ? cur : [...cur, person]
      );
      return person;
    },
    [orgId, people]
  );

  // Fosters are a derived view of people (those with the 'foster_parent' role).
  // Active by default (mirrors `people`); inactive fosters appear once
  // ensureInactiveLoaded has run.
  const fosters = useMemo(
    () => people.filter((p) => p.roles.includes('foster_parent')),
    [people]
  );
  const fostersLoading = peopleLoading;
  // Merge the freshest full rows from `people` over the slim index so optimistic
  // adds/edits show in search/pickers immediately; deletes are mirrored at the
  // delete sites.
  const mergedPeopleIndex = useMemo(() => {
    const freshById = new Map(people.map((p) => [p.id, p]));
    const indexIds = new Set(peopleIndex.map((p) => p.id));
    const merged = peopleIndex.map((p) => freshById.get(p.id) ?? p);
    for (const p of people) if (!indexIds.has(p.id)) merged.push(p);
    return merged;
  }, [peopleIndex, people]);
  // Species — global reference catalog (not org-scoped). Read-only here.
  const [species, setSpecies] = useState<SpeciesCatalog[]>([]);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase.
      from('species').
      select('*').
      eq('active', true).
      order('sort_order', { ascending: true }).
      order('name', { ascending: true });
      if (cancelled) return;
      if (error) {
        console.error('[species] load failed:', error.message);
      } else {
        setSpecies((data ?? []).map(rowToSpecies));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);
  // Breeds — global reference catalog (not org-scoped). Read-only here.
  const [breeds, setBreeds] = useState<Breed[]>([]);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase.
      from('breeds').
      select('*').
      eq('active', true).
      order('sort_order', { ascending: true }).
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
        eq('organization_id', orgId).
        eq('is_deleted', false);
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

  // Per-org species/breed enablement (migration 0042). Org-scoped, no is_deleted
  // column, so loaded separately from loadCoordination.
  const [organizationSpecies, setOrganizationSpecies] = useState<
    OrganizationSpecies[]>(
    []);
  const [organizationBreeds, setOrganizationBreeds] = useState<
    OrganizationBreed[]>(
    []);
  const [traits, setTraits] = useState<Trait[]>([]);
  const [animalTraits, setAnimalTraits_] = useState<AnimalTrait[]>([]);
  const loadOrgCatalog = useCallback(async () => {
    if (!orgId) {
      setOrganizationSpecies([]);
      setOrganizationBreeds([]);
      setTraits([]);
      setAnimalTraits_([]);
      return;
    }
    const [os, ob, tr, at] = await Promise.all([
    supabase.from('organization_species').select('*').eq('organization_id', orgId),
    supabase.from('organization_breeds').select('*').eq('organization_id', orgId),
    supabase.from('traits').select('*').eq('organization_id', orgId),
    supabase.from('animal_traits').select('*').eq('organization_id', orgId)]
    );
    if (os.error) console.error('[organization_species] load failed:', os.error.message);
    else setOrganizationSpecies((os.data ?? []).map(rowToOrgSpecies));
    if (ob.error) console.error('[organization_breeds] load failed:', ob.error.message);
    else setOrganizationBreeds((ob.data ?? []).map(rowToOrgBreed));
    if (tr.error) console.error('[traits] load failed:', tr.error.message);
    else setTraits((tr.data ?? []).map(rowToTrait));
    if (at.error) console.error('[animal_traits] load failed:', at.error.message);
    else setAnimalTraits_((at.data ?? []).map(rowToAnimalTrait));
  }, [orgId]);
  useEffect(() => {
    loadOrgCatalog();
  }, [loadOrgCatalog]);

  const setSpeciesEnabled = async (speciesId: string, enabled: boolean) => {
    if (!orgId) return;
    // Optimistic: update existing row, or add a temp one if none exists yet.
    setOrganizationSpecies((prev) => {
      if (prev.some((r) => r.species_id === speciesId)) {
        return prev.map((r) =>
        r.species_id === speciesId ?
        { ...r, is_enabled: enabled, is_default: enabled ? r.is_default : false } :
        r
        );
      }
      return [
      ...prev,
      {
        id: `tmp-${speciesId}`,
        organization_id: orgId,
        species_id: speciesId,
        is_enabled: enabled,
        is_default: false,
        sort_order: 0
      }];

    });
    const payload: Record<string, any> = {
      organization_id: orgId,
      species_id: speciesId,
      is_enabled: enabled
    };
    if (!enabled) payload.is_default = false; // can't be default if disabled
    const { error } = await supabase.
    from('organization_species').
    upsert(payload, { onConflict: 'organization_id,species_id' });
    if (error) console.error('[organization_species] update failed:', error.message);
    loadOrgCatalog(); // reconcile (real id / server state)
  };

  const setDefaultSpecies = async (speciesId: string) => {
    if (!orgId) return;
    setOrganizationSpecies((prev) =>
    prev.map((r) => ({
      ...r,
      is_default: r.species_id === speciesId,
      is_enabled: r.species_id === speciesId ? true : r.is_enabled
    }))
    );
    const clear = await supabase.
    from('organization_species').
    update({ is_default: false }).
    eq('organization_id', orgId).
    neq('species_id', speciesId);
    const set = await supabase.
    from('organization_species').
    update({ is_default: true, is_enabled: true }).
    eq('organization_id', orgId).
    eq('species_id', speciesId);
    if (clear.error || set.error) {
      console.error('[organization_species] set default failed');
      loadOrgCatalog();
    }
  };

  // Set the per-species breed allowlist (opt-in narrowing). breedIds is the full
  // accepted set for that species; an empty array clears the restriction (= all
  // of that species' breeds allowed). Replaces the species' org_breeds rows.
  const setAllowedBreeds = async (speciesId: string, breedIds: string[]) => {
    if (!orgId) return;
    const speciesBreedIds = new Set(
      breeds.filter((b) => b.species_id === speciesId).map((b) => b.id)
    );
    setOrganizationBreeds((prev) => [
    ...prev.filter((r) => !speciesBreedIds.has(r.breed_id)),
    ...breedIds.map((bid) => ({
      id: `tmp-${bid}`,
      organization_id: orgId,
      breed_id: bid,
      is_enabled: true,
      sort_order: 0
    }))]
    );
    if (speciesBreedIds.size) {
      const del = await supabase.
      from('organization_breeds').
      delete().
      eq('organization_id', orgId).
      in('breed_id', [...speciesBreedIds]);
      if (del.error) console.error('[organization_breeds] clear failed:', del.error.message);
    }
    if (breedIds.length) {
      const ins = await supabase.
      from('organization_breeds').
      insert(
        breedIds.map((bid) => ({
          organization_id: orgId,
          breed_id: bid,
          is_enabled: true
        }))
      );
      if (ins.error) console.error('[organization_breeds] insert failed:', ins.error.message);
    }
    loadOrgCatalog();
  };

  // Replace an animal's assigned traits with `traitIds` (diff add/remove).
  const setAnimalTraits = async (animalId: string, traitIds: string[]) => {
    if (!orgId) return;
    const current = animalTraits.filter((t) => t.animal_id === animalId);
    const currentIds = new Set(current.map((t) => t.trait_id));
    const nextIds = new Set(traitIds);
    const toAdd = traitIds.filter((id) => !currentIds.has(id));
    const toRemove = current.filter((t) => !nextIds.has(t.trait_id));
    if (toAdd.length === 0 && toRemove.length === 0) return;
    // Optimistic: replace this animal's rows with the new set.
    setAnimalTraits_((prev) => [
    ...prev.filter((t) => t.animal_id !== animalId),
    ...traitIds.map((tid) => ({
      id: `tmp-${animalId}-${tid}`,
      organization_id: orgId,
      animal_id: animalId,
      trait_id: tid
    }))]
    );
    if (toRemove.length) {
      const del = await supabase.
      from('animal_traits').
      delete().
      eq('animal_id', animalId).
      in('trait_id', toRemove.map((t) => t.trait_id));
      if (del.error) console.error('[animal_traits] remove failed:', del.error.message);
    }
    if (toAdd.length) {
      const ins = await supabase.
      from('animal_traits').
      insert(
        toAdd.map((tid) => ({
          organization_id: orgId,
          animal_id: animalId,
          trait_id: tid
        }))
      );
      if (ins.error) console.error('[animal_traits] add failed:', ins.error.message);
    }
    loadOrgCatalog(); // reconcile real ids
  };

  const addTrait: WhiskerContextType['addTrait'] = async (trait) => {
    if (!orgId) return;
    const { data, error } = await supabase.
    from('traits').
    insert(traitToInsert(trait, orgId)).
    select('*').
    single();
    if (error) {
      console.error('[traits] create failed:', error.message);
      return;
    }
    if (data) setTraits((prev) => [...prev, rowToTrait(data)]);
  };
  const updateTrait = (id: string, updates: Partial<Trait>) => {
    setTraits((prev) =>
    prev.map((t) =>
    t.id === id ?
    { ...t, ...updates, updated_at: new Date().toISOString() } :
    t
    )
    );
    const row = traitUpdateToRow(updates);
    if (Object.keys(row).length === 0) return;
    supabase.
    from('traits').
    update(row).
    eq('id', id).
    then(({ error }) => {
      if (error) {
        console.error('[traits] update failed:', error.message);
        loadOrgCatalog();
      }
    });
  };

  const addAnimal = async (
  animal: Omit<Animal, 'id' | 'created_at' | 'updated_at'>)
  : Promise<Animal | undefined> => {
    if (!orgId) {
      console.error('[animals] cannot create — no current organization');
      return undefined;
    }
    const { data, error } = await supabase.
    from('animals').
    insert(animalToInsert(animal, orgId)).
    select('*').
    single();
    if (error) {
      console.error('[animals] create failed:', error.message);
      return undefined;
    }
    if (!data) return undefined;
    const created = rowToAnimal(data);
    setAnimals((prev) => [created, ...prev]);
    return created;
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
    const prevIndex = animalsIndex;
    setAnimals((cur) => cur.filter((a) => a.id !== id));
    setAnimalsIndex((cur) => cur.filter((a) => a.id !== id));
    supabase.
    from('animals').
    delete().
    eq('id', id).
    then(({ error }) => {
      if (error) {
        console.error('[animals] delete failed:', error.message);
        setAnimals(prev); // restore
        setAnimalsIndex(prevIndex);
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
    // Resolve the catalog species_id from the litter's species name so members
    // match single-add animals (and stay valid for a future NOT NULL).
    const sharedSpeciesId = species.find((s) => s.name === shared.species)?.id;
    const rows = members.map((m) =>
    animalToInsert(
      {
        name: m.name,
        species: shared.species,
        species_id: sharedSpeciesId,
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
      address_google_place_id: foster.address_google_place_id,
      address_formatted: foster.address_formatted,
      address_street_1: foster.address_street_1,
      address_street_2: foster.address_street_2,
      address_city: foster.address_city,
      address_state: foster.address_state,
      address_postal_code: foster.address_postal_code,
      address_country: foster.address_country,
      address_latitude: foster.address_latitude,
      address_longitude: foster.address_longitude,
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
    insert(actionItemToInsert(item, orgId, user?.id ?? null)).
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
  // Upload a person's avatar to the public `animal-photos` bucket (reusing the
  // same storage + RLS as animal photos) and persist the resulting URL onto
  // their `people.photo_url`. Path is org-scoped so storage RLS lets any org
  // member write it: <org>/people/<person>/<uuid>.<ext>.
  const uploadPersonPhoto = async (
  personId: string,
  file: File)
  : Promise<void> => {
    if (!orgId) {
      console.error('[people] cannot upload photo — no current organization');
      return;
    }
    const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg';
    const path = `${orgId}/people/${personId}/${crypto.randomUUID()}.${ext}`;
    const { error: upErr } = await supabase.storage.
    from('animal-photos').
    upload(path, file, { upsert: false });
    if (upErr) {
      console.error('[people] photo upload failed:', upErr.message);
      return;
    }
    const publicUrl = supabase.storage.
    from('animal-photos').
    getPublicUrl(path).data.publicUrl;
    // Best-effort: remove the previously uploaded object (only if it lived in
    // our bucket) so replacing a photo doesn't orphan storage. External URLs
    // (e.g. a Google avatar) are left untouched.
    const marker = '/animal-photos/';
    const prevUrl = people.find((p) => p.id === personId)?.photo_url;
    if (prevUrl && prevUrl.includes(marker)) {
      const prevPath = prevUrl.split(marker)[1];
      if (prevPath) {
        void supabase.storage.
        from('animal-photos').
        remove([prevPath]).
        then(({ error }) => {
          if (error) console.error('[people] old photo remove failed:', error.message);
        });
      }
    }
    updatePerson(personId, { photo_url: publicUrl });
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
  // Shared: bring a returned animal back into the care pipeline. Inverse of the
  // animal side of completeAdoption — re-enter at 'intake' for reassessment and
  // drop the now-stale adopter stamps.
  const bringAnimalBackIntoCare = (animalId: string) => {
    const animalUpdates: Partial<Animal> = {
      status: 'intake',
      is_on_hold: false
    };
    (animalUpdates as Record<string, unknown>).adopted_by_id = null;
    (animalUpdates as Record<string, unknown>).adopted_at = null;
    updateAnimal(animalId, animalUpdates);
  };
  const returnAdoption: WhiskerContextType['returnAdoption'] = (id, input) => {
    const adoption = adoptions.find((a) => a.id === id);
    if (!adoption) return;
    updateAdoption(id, {
      status: 'returned',
      returned_at: input.returned_at,
      return_reason: input.return_reason,
      return_notes: input.return_notes?.trim() || undefined
    });
    bringAnimalBackIntoCare(adoption.animal_id);
  };
  const recordAdoptionReturn: WhiskerContextType['recordAdoptionReturn'] = async (
  input) =>
  {
    if (!orgId) {
      console.error('[adoptions] cannot record return — no current organization');
      return;
    }
    const { data, error } = await supabase.
    from('adoptions').
    insert(adoptionReturnToInsert(input, orgId)).
    select('*').
    single();
    if (error || !data) {
      console.error('[adoptions] record-return failed:', error?.message);
      return;
    }
    setAdoptions((prev) => [rowToAdoption(data), ...prev]);
    ensureAdopterRole(input.adopter_id);
    bringAnimalBackIntoCare(input.animal_id);
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
        orgId,
        user?.id ?? null
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
  // Placing an animal with someone makes them a foster parent — the "Place in
  // Foster" picker lets you choose any contact, so add the role on placement if
  // they don't already have it (idempotent; mirrors ensureAdopterRole).
  const ensureFosterRole = (personId: string) => {
    const person = people.find((p) => p.id === personId);
    if (!person || person.roles.includes('foster_parent')) return;
    const nextRoles: PersonRole[] = [...person.roles, 'foster_parent'];
    updatePerson(personId, { roles: nextRoles, role: legacyRoleFor(nextRoles) });
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
    ensureFosterRole(person_id);
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
    ensureFosterRole(new_person_id);
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
  procedureTypes: ClinicSlotProcedureType[])
  : Promise<ClinicSlot | undefined> => {
    if (!orgId) return undefined;
    const { data, error } = await supabase.
    from('clinic_slots').
    insert(clinicSlotToInsert(slot, orgId)).
    select('*').
    single();
    if (error || !data) {
      console.error('[clinic slot] create failed:', error?.message);
      return undefined;
    }
    const newSlot = rowToClinicSlot(data);
    setClinicSlots((prev) => [newSlot, ...prev]);
    if (procedureTypes.length === 0) return newSlot;
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
      return newSlot;
    }
    if (procs) {
      setClinicSlotProcedures((prev) => [
      ...procs.map(rowToClinicSlotProcedure),
      ...prev]
      );
    }
    return newSlot;
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

  // --- Archive / Recycle Bin --------------------------------------------
  // Loader-by-table map so restoreRecord can refetch the right collection
  // without an extra round-trip to figure out where the row belongs.
  const loaderForTable: Partial<Record<ArchiveTable, () => void>> = {
    animals: loadAnimals,
    animal_notes: loadNotes,
    animal_photos: loadPhotos,
    animal_action_items: loadActionItems,
    animal_relationships: loadRelationships,
    people: loadPeople,
    medical_records: loadMedicalRecords,
    foster_placements: loadPlacements,
    litters: loadLitters,
    adoptions: loadAdoptions,
    clinic_events: loadCoordination,
    clinic_slots: loadCoordination,
    clinic_slot_procedures: loadCoordination,
    products: loadCoordination,
    supply_requests: loadCoordination,
    supply_request_items: loadCoordination,
    transport_requests: loadCoordination,
    sitting_requests: loadCoordination,
    sitting_request_placements: loadCoordination
  };

  const removeLocalById = (table: ArchiveTable, id: string) => {
    switch (table) {
      case 'animals':
        setAnimals((p) => p.filter((r) => r.id !== id));
        setAnimalsIndex((p) => p.filter((r) => r.id !== id));
        break;
      case 'animal_notes': setNotes((p) => p.filter((r) => r.id !== id)); break;
      case 'animal_photos': setPhotos((p) => p.filter((r) => r.id !== id)); break;
      case 'animal_action_items': setActionItems((p) => p.filter((r) => r.id !== id)); break;
      case 'animal_relationships': setRelationships((p) => p.filter((r) => r.id !== id)); break;
      case 'people':
        setPeople((p) => p.filter((r) => r.id !== id));
        setPeopleIndex((p) => p.filter((r) => r.id !== id));
        break;
      case 'medical_records': setMedicalRecords((p) => p.filter((r) => r.id !== id)); break;
      case 'foster_placements': setPlacements((p) => p.filter((r) => r.id !== id)); break;
      case 'litters': setLitters((p) => p.filter((r) => r.id !== id)); break;
      case 'adoptions': setAdoptions((p) => p.filter((r) => r.id !== id)); break;
      case 'clinic_events': setClinicEvents((p) => p.filter((r) => r.id !== id)); break;
      case 'clinic_slots': setClinicSlots((p) => p.filter((r) => r.id !== id)); break;
      case 'clinic_slot_procedures': setClinicSlotProcedures((p) => p.filter((r) => r.id !== id)); break;
      case 'products': setProducts((p) => p.filter((r) => r.id !== id)); break;
      case 'supply_requests': setSupplyRequests((p) => p.filter((r) => r.id !== id)); break;
      case 'supply_request_items': setSupplyRequestItems((p) => p.filter((r) => r.id !== id)); break;
      case 'transport_requests': setTransportRequests((p) => p.filter((r) => r.id !== id)); break;
      case 'sitting_requests': setSittingRequests((p) => p.filter((r) => r.id !== id)); break;
      case 'sitting_request_placements': setSittingRequestPlacements((p) => p.filter((r) => r.id !== id)); break;
    }
  };

  const archiveRecord = async (table: ArchiveTable, id: string) => {
    const { error } = await supabase.rpc('archive_record', {
      p_table: table,
      p_id: id
    });
    if (error) throw new Error(error.message);
    removeLocalById(table, id);
  };
  const restoreRecord = async (table: ArchiveTable, id: string) => {
    const { error } = await supabase.rpc('restore_record', {
      p_table: table,
      p_id: id
    });
    if (error) throw new Error(error.message);
    loaderForTable[table]?.();
  };
  const fetchArchived = async (): Promise<ArchivedRecord[]> => {
    if (!orgId) return [];
    const { data, error } = await supabase.rpc('list_archived', {
      p_org_id: orgId
    });
    if (error) {
      console.error('[archive] list failed:', error.message);
      return [];
    }
    return (data ?? []) as ArchivedRecord[];
  };

  // The `animals.species` text column is retired (migration 0044); the species
  // display name is derived here from species_id via the catalog so every
  // `animal.species` read keeps working.
  const enrichedAnimals = useMemo(() => {
    const nameById = new Map(species.map((s) => [s.id, s.name]));
    return animals.map((a) =>
    a.species_id ? { ...a, species: nameById.get(a.species_id) ?? a.species } : a
    );
  }, [animals, species]);
  const enrichedAnimalsIndex = useMemo(() => {
    const nameById = new Map(species.map((s) => [s.id, s.name]));
    const enrich = (a: Animal) =>
    a.species_id ? { ...a, species: nameById.get(a.species_id) ?? a.species } : a;
    // Overlay the freshest full rows from `animals` so optimistic adds/edits
    // (rename, status change, brand-new animals) show in search/pickers
    // immediately, rather than the stale once-loaded index snapshot. Deletes
    // are mirrored into `animalsIndex` at the delete sites.
    const freshById = new Map(animals.map((a) => [a.id, a]));
    const indexIds = new Set(animalsIndex.map((a) => a.id));
    const merged = animalsIndex.map((a) => freshById.get(a.id) ?? a);
    for (const a of animals) if (!indexIds.has(a.id)) merged.push(a);
    return merged.map(enrich);
  }, [animalsIndex, animals, species]);

  return (
    <WhiskerContext.Provider
      value={{
        animals: enrichedAnimals,
        animalsLoading,
        animalsIndex: enrichedAnimalsIndex,
        animalsIndexLoading,
        historicalLoaded,
        ensureHistoricalLoaded,
        ensureAnimal,
        fosters,
        fostersLoading,
        placements,
        medicalRecords,
        notes,
        actionItems,
        relationships,
        photos,
        people,
        peopleIndex: mergedPeopleIndex,
        peopleIndexLoading,
        inactiveLoaded,
        ensureInactiveLoaded,
        ensurePerson,
        peopleLoading,
        litters,
        littersLoading,
        adoptions,
        adoptionsLoading,
        species,
        breeds,
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
        uploadPersonPhoto,
        addAdoption,
        updateAdoption,
        setAdoptionStatus,
        completeAdoption,
        cancelAdoption,
        returnAdoption,
        recordAdoptionReturn,
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
        deleteClinicSlotProcedure,
        archiveRecord,
        restoreRecord,
        fetchArchived
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