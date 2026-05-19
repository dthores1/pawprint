import React, { useState, createContext, useContext } from 'react';
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
import {
  seedAnimals,
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
interface WhiskerContextType {
  animals: Animal[];
  fosters: FosterParent[];
  placements: FosterPlacement[];
  medicalRecords: MedicalRecord[];
  notes: AnimalNote[];
  relationships: AnimalRelationship[];
  photos: AnimalPhoto[];
  people: Person[];
  products: Product[];
  supplyRequests: SupplyRequest[];
  supplyRequestItems: SupplyRequestItem[];
  addAnimal: (animal: Omit<Animal, 'id' | 'created_at' | 'updated_at'>) => void;
  updateAnimal: (id: string, updates: Partial<Animal>) => void;
  addFoster: (foster: Omit<FosterParent, 'id'>) => void;
  updateFoster: (id: string, updates: Partial<FosterParent>) => void;
  addMedicalRecord: (record: Omit<MedicalRecord, 'id'>) => void;
  updateMedicalRecord: (id: string, updates: Partial<MedicalRecord>) => void;
  addNote: (note: Omit<AnimalNote, 'id' | 'created_at'>) => void;
  addPlacement: (placement: Omit<FosterPlacement, 'id'>) => void;
  updatePlacement: (id: string, updates: Partial<FosterPlacement>) => void;
  addPerson: (person: Omit<Person, 'id' | 'created_at'>) => void;
  updatePerson: (id: string, updates: Partial<Person>) => void;
  addPhoto: (photo: Omit<AnimalPhoto, 'id' | 'uploaded_at'>) => void;
  deletePhoto: (id: string) => void;
  addRelationship: (rel: Omit<AnimalRelationship, 'id'>) => void;
  deleteRelationship: (id: string) => void;
  placeAnimal: (
  animal_id: string,
  foster_parent_id: string,
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
  new_foster_parent_id: string,
  start_date: string,
  reason_ended?: string,
  notes?: string)
  => void;
  addSupplyRequest: (
  req: Omit<SupplyRequest, 'id' | 'created_at' | 'updated_at'>)
  => string;
  updateSupplyRequest: (id: string, updates: Partial<SupplyRequest>) => void;
  addSupplyRequestItem: (item: Omit<SupplyRequestItem, 'id'>) => void;
  // Transport requests
  transportRequests: TransportRequest[];
  addTransportRequest: (
  req: Omit<TransportRequest, 'id' | 'created_at' | 'updated_at'>)
  => string;
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
  => string;
  updateSittingRequest: (
  id: string,
  updates: Partial<SittingRequest>)
  => void;
  /** Convenience: set the sitter + flip status to claimed. */
  acceptSittingRequest: (id: string, sitter_person_id: string) => void;
  // Clinics
  clinicEvents: ClinicEvent[];
  clinicSlots: ClinicSlot[];
  addClinicEvent: (
  event: Omit<ClinicEvent, 'id' | 'created_at' | 'updated_at'>)
  => string;
  updateClinicEvent: (id: string, updates: Partial<ClinicEvent>) => void;
  addClinicSlot: (slot: Omit<ClinicSlot, 'id'>) => void;
  updateClinicSlot: (id: string, updates: Partial<ClinicSlot>) => void;
  deleteClinicSlot: (id: string) => void;
}
const WhiskerContext = createContext<WhiskerContextType | undefined>(undefined);
export function WhiskerProvider({ children }: {children: ReactNode;}) {
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
  const [supplyRequestItems, setSupplyRequestItems] = useState<
    SupplyRequestItem[]>(
    seedSupplyRequestItems);
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
  const addAnimal = (
  animal: Omit<Animal, 'id' | 'created_at' | 'updated_at'>) =>
  {
    const newAnimal: Animal = {
      ...animal,
      id: `a${generateId()}`,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    setAnimals((prev) => [newAnimal, ...prev]);
  };
  const updateAnimal = (id: string, updates: Partial<Animal>) => {
    setAnimals((prev) =>
    prev.map((a) =>
    a.id === id ?
    {
      ...a,
      ...updates,
      updated_at: new Date().toISOString()
    } :
    a
    )
    );
  };
  const addFoster = (foster: Omit<FosterParent, 'id'>) => {
    setFosters((prev) => [
    {
      ...foster,
      id: `f${generateId()}`
    },
    ...prev]
    );
  };
  const updateFoster = (id: string, updates: Partial<FosterParent>) => {
    setFosters((prev) =>
    prev.map((f) =>
    f.id === id ?
    {
      ...f,
      ...updates
    } :
    f
    )
    );
  };
  const addMedicalRecord = (record: Omit<MedicalRecord, 'id'>) => {
    setMedicalRecords((prev) => [
    {
      ...record,
      id: `m${generateId()}`
    },
    ...prev]
    );
  };
  const updateMedicalRecord = (id: string, updates: Partial<MedicalRecord>) => {
    setMedicalRecords((prev) =>
    prev.map((m) =>
    m.id === id ?
    {
      ...m,
      ...updates
    } :
    m
    )
    );
  };
  const addNote = (note: Omit<AnimalNote, 'id' | 'created_at'>) => {
    setNotes((prev) => [
    {
      ...note,
      id: `n${generateId()}`,
      created_at: new Date().toISOString()
    },
    ...prev]
    );
  };
  const addPlacement = (placement: Omit<FosterPlacement, 'id'>) => {
    setPlacements((prev) => [
    {
      ...placement,
      id: `p${generateId()}`
    },
    ...prev]
    );
  };
  const updatePlacement = (id: string, updates: Partial<FosterPlacement>) => {
    setPlacements((prev) =>
    prev.map((p) =>
    p.id === id ?
    {
      ...p,
      ...updates
    } :
    p
    )
    );
  };
  const addPerson = (person: Omit<Person, 'id' | 'created_at'>) => {
    setPeople((prev) => [
    {
      ...person,
      id: `pe${generateId()}`,
      created_at: new Date().toISOString()
    },
    ...prev]
    );
  };
  const updatePerson = (id: string, updates: Partial<Person>) => {
    setPeople((prev) =>
    prev.map((p) =>
    p.id === id ?
    {
      ...p,
      ...updates
    } :
    p
    )
    );
  };
  const addPhoto = (photo: Omit<AnimalPhoto, 'id' | 'uploaded_at'>) => {
    setPhotos((prev) => [
    {
      ...photo,
      id: `ph${generateId()}`,
      uploaded_at: new Date().toISOString()
    },
    ...prev]
    );
  };
  const deletePhoto = (id: string) => {
    setPhotos((prev) => prev.filter((p) => p.id !== id));
  };
  const addRelationship = (rel: Omit<AnimalRelationship, 'id'>) => {
    setRelationships((prev) => [
    {
      ...rel,
      id: `r${generateId()}`
    },
    ...prev]
    );
  };
  const deleteRelationship = (id: string) => {
    setRelationships((prev) => prev.filter((r) => r.id !== id));
  };
  const placeAnimal = (
  animal_id: string,
  foster_parent_id: string,
  start_date: string,
  notes?: string) =>
  {
    addPlacement({
      animal_id,
      foster_parent_id,
      start_date,
      placement_status: 'active',
      placement_type: 'foster',
      notes
    });
    updateAnimal(animal_id, {
      status: 'fostered',
      current_foster_id: foster_parent_id
    });
  };
  const reassignFoster = (
  animal_id: string,
  new_foster_parent_id: string,
  start_date: string,
  reason_ended?: string,
  notes?: string) =>
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
      const next: FosterPlacement = {
        id: `p${generateId()}`,
        animal_id,
        foster_parent_id: new_foster_parent_id,
        start_date,
        placement_status: 'active',
        placement_type: 'foster',
        notes
      };
      return [next, ...closed];
    });
    updateAnimal(animal_id, {
      status: 'fostered',
      current_foster_id: new_foster_parent_id
    });
  };
  const addSupplyRequest = (
  req: Omit<SupplyRequest, 'id' | 'created_at' | 'updated_at'>) =>
  {
    const id = `sr${generateId()}`;
    const now = new Date().toISOString();
    setSupplyRequests((prev) => [
    {
      ...req,
      id,
      created_at: now,
      updated_at: now
    },
    ...prev]
    );
    return id;
  };
  const updateSupplyRequest = (id: string, updates: Partial<SupplyRequest>) => {
    setSupplyRequests((prev) =>
    prev.map((sr) =>
    sr.id === id ?
    {
      ...sr,
      ...updates,
      updated_at: new Date().toISOString()
    } :
    sr
    )
    );
  };
  const addSupplyRequestItem = (item: Omit<SupplyRequestItem, 'id'>) => {
    setSupplyRequestItems((prev) => [
    {
      ...item,
      id: `sri${generateId()}`
    },
    ...prev]
    );
  };
  // — Transport Requests —————————————————————————————————
  const addTransportRequest = (
  req: Omit<TransportRequest, 'id' | 'created_at' | 'updated_at'>) =>
  {
    const id = `tr${generateId()}`;
    const now = new Date().toISOString();
    setTransportRequests((prev) => [
    { ...req, id, created_at: now, updated_at: now },
    ...prev]
    );
    return id;
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
  };
  const claimTransportRequest = (id: string, volunteer_person_id: string) => {
    updateTransportRequest(id, {
      assigned_volunteer_person_id: volunteer_person_id,
      status: 'claimed'
    });
  };
  // — Sitting Requests —————————————————————————————————
  const addSittingRequest = (
  req: Omit<SittingRequest, 'id' | 'created_at' | 'updated_at'>,
  placement_ids: string[]) =>
  {
    const id = `sit${generateId()}`;
    const now = new Date().toISOString();
    setSittingRequests((prev) => [
    { ...req, id, created_at: now, updated_at: now },
    ...prev]
    );
    // Snapshot the covered placements. Done in the same call so the request
    // and its scope land atomically — no orphan rows if one update fails.
    setSittingRequestPlacements((prev) => [
    ...placement_ids.map((pid) => ({
      id: `srp${generateId()}`,
      sitting_request_id: id,
      foster_placement_id: pid
    })),
    ...prev]
    );
    return id;
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
  };
  const acceptSittingRequest = (id: string, sitter_person_id: string) => {
    updateSittingRequest(id, {
      sitter_person_id,
      status: 'claimed'
    });
  };
  // — Clinic Events / Slots ——————————————————————————————
  const addClinicEvent = (
  event: Omit<ClinicEvent, 'id' | 'created_at' | 'updated_at'>) =>
  {
    const id = `ce${generateId()}`;
    const now = new Date().toISOString();
    setClinicEvents((prev) => [
    { ...event, id, created_at: now, updated_at: now },
    ...prev]
    );
    return id;
  };
  const updateClinicEvent = (
  id: string,
  updates: Partial<ClinicEvent>) =>
  {
    setClinicEvents((prev) =>
    prev.map((c) =>
    c.id === id ?
    { ...c, ...updates, updated_at: new Date().toISOString() } :
    c
    )
    );
  };
  const addClinicSlot = (slot: Omit<ClinicSlot, 'id'>) => {
    setClinicSlots((prev) => [
    { ...slot, id: `cs${generateId()}` },
    ...prev]
    );
  };
  const updateClinicSlot = (id: string, updates: Partial<ClinicSlot>) => {
    setClinicSlots((prev) =>
    prev.map((s) => (s.id === id ? { ...s, ...updates } : s))
    );
  };
  const deleteClinicSlot = (id: string) => {
    setClinicSlots((prev) => prev.filter((s) => s.id !== id));
  };
  return (
    <WhiskerContext.Provider
      value={{
        animals,
        fosters,
        placements,
        medicalRecords,
        notes,
        relationships,
        photos,
        people,
        products,
        supplyRequests,
        supplyRequestItems,
        addAnimal,
        updateAnimal,
        addFoster,
        updateFoster,
        addMedicalRecord,
        updateMedicalRecord,
        addNote,
        addPlacement,
        updatePlacement,
        addPerson,
        updatePerson,
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
        addClinicEvent,
        updateClinicEvent,
        addClinicSlot,
        updateClinicSlot,
        deleteClinicSlot
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