export type AnimalStatus =
'intake' |
'medical' |
'hold' |
'fostered' |
'adoptable' |
'adopted' |
'hospice' |
'deceased';

export type Priority = 'normal' | 'needs_attention' | 'urgent' | 'critical';

export type Species = 'Dog' | 'Cat' | 'Other';
export type Sex = 'Male' | 'Female' | 'Unknown';

export interface Animal {
  id: string;
  name: string;
  species: Species;
  sex: Sex;
  estimated_birth_date: string;
  intake_date: string;
  intake_source: string;
  status: AnimalStatus;
  priority: Priority;
  /**
   * Short, specific next-step sentence. Meaningful when priority !== 'normal'.
   * e.g. "Daily soft food + finish 10-day antibiotic course".
   */
  action_needed?: string;
  description: string;
  microchip_number?: string;
  primary_photo_url?: string;
  /**
   * Public adoption-listing URL (e.g. Petfinder, Adopt-a-Pet, the org's own site).
   * Meaningful when status is 'adoptable'.
   */
  adoption_profile_url?: string;
  /**
   * Denormalized cache: foster_parent_id of the active FosterPlacement, if any.
   * The placements collection remains the source of truth for history; kept
   * in sync by placeAnimal / reassignFoster. Components may prefer the
   * derived check (active placement) for consistency with seed data.
   */
  current_foster_id?: string;
  /** Staff-only notes, separate from the public-facing `description` blurb. */
  internal_notes?: string;
  created_at: string;
  updated_at: string;
}

export type PhotoCategory =
'intake' |
'profile' |
'medical' |
'foster' |
'adoption' |
'post_adoption' |
'other';

export interface AnimalPhoto {
  id: string;
  animal_id: string;
  url: string;
  category: PhotoCategory;
  caption?: string;
  uploaded_at: string;
}

export interface FosterParent {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  address: string;
  max_capacity: number;
  preferred_species: Species[];
  notes: string;
  active: boolean;
  photo_url?: string;
}

export type PlacementType = 'foster' | 'medical_foster' | 'trial_adoption';

export interface FosterPlacement {
  id: string;
  animal_id: string;
  foster_parent_id: string;
  start_date: string;
  /** Nullable while the placement is active. */
  end_date?: string;
  placement_status: 'active' | 'completed' | 'interrupted';
  /** Defaults to 'foster' on creation; more types may be added later. */
  placement_type: PlacementType;
  /** Free-form reason a placement ended (e.g. "Reassigned", "Adopted"). */
  reason_ended?: string;
  notes?: string;
}

export type ProcedureType =
'vaccine' |
'exam' |
'spay_neuter' |
'medication' |
'surgery' |
'microchip' |
'deworming' |
'test';

export type MedicalStatus =
'completed' |
'due' |
'scheduled' |
'overdue' |
'canceled';

export interface MedicalRecord {
  id: string;
  animal_id: string;
  procedure_type: ProcedureType;
  procedure_name: string;
  performed_date?: string;
  due_date?: string;
  status: MedicalStatus;
  provider_name?: string;
  notes?: string;
}

export type NoteType =
'behavior' |
'medical' |
'foster_update' |
'adoption' |
'general';

export interface AnimalNote {
  id: string;
  animal_id: string;
  author_name: string;
  note_type: NoteType;
  body: string;
  created_at: string;
}

export interface AnimalRelationship {
  id: string;
  animal_id: string;
  related_animal_id: string;
  relationship_type:
  'mother' |
  'father' |
  'sibling' |
  'child' |
  'bonded_pair' |
  'littermate';
  notes?: string;
}

export type PersonRole = 'vet' | 'rescue_staff' | 'volunteer' | 'adopter';
export type VolunteerType =
'foster_parent' |
'administrative' |
'trapper' |
'transport' |
'event_support' |
'social_media' |
'other';

export interface Person {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone?: string;
  role: PersonRole;
  volunteer_type?: VolunteerType;
  organization_name?: string;
  notes?: string;
  photo_url?: string;
  active: boolean;
  created_at: string;
}

export type SupplyRequestStatus =
'submitted' |
'reviewing' |
'approved' |
'ordered' |
'ready_for_pickup' |
'delivered' |
'completed' |
'canceled';

export type SupplyRequestPriority = 'normal' | 'urgent' | 'critical';

export type DeliveryMethod = 'pickup' | 'drop_off' | 'shipped';

export type ProductCategory =
'food' |
'litter' |
'medical' |
'bedding' |
'enrichment' |
'cleaning' |
'other';

export interface Product {
  id: string;
  name: string;
  category: ProductCategory;
  default_unit: string;
  active: boolean;
}

export interface SupplyRequest {
  id: string;
  requester_person_id: string;
  requested_for_animal_id?: string;
  status: SupplyRequestStatus;
  priority: SupplyRequestPriority;
  requested_date: string;
  needed_by_date?: string;
  approved_by_person_id?: string;
  fulfilled_by_person_id?: string;
  fulfilled_date?: string;
  delivery_method?: DeliveryMethod;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface SupplyRequestItem {
  id: string;
  supply_request_id: string;
  product_id?: string;
  custom_item_name?: string;
  quantity: number;
  unit: string;
  notes?: string;
}

// — Transport Requests —————————————————————————————————————
// Volunteers ferry animals or supplies. Common at orgs like Alley Cat Project
// where cats move between trap site → vet → foster, and supplies are dropped
// off at remote foster homes.
export type TransportRequestType = 'animal' | 'supplies' | 'emergency';

export type TransportRequestStatus =
'open' |
'claimed' |
'in_progress' |
'completed' |
'canceled';

export type TransportRequestUrgency = 'normal' | 'urgent' | 'critical';

export interface TransportRequest {
  id: string;
  type: TransportRequestType;
  status: TransportRequestStatus;
  requested_by_person_id: string;
  assigned_volunteer_person_id?: string;
  /** Optional links to whatever is being moved. */
  animal_id?: string;
  clinic_event_id?: string;
  supply_request_id?: string;
  pickup_location: string;
  dropoff_location: string;
  requested_pickup_time: string;
  completed_at?: string;
  notes?: string;
  urgency: TransportRequestUrgency;
  created_at: string;
  updated_at: string;
}

// — Sitting Requests —————————————————————————————————————
// Short-term foster coverage. A foster going out of town requests coverage
// for some or all of their active placements; another org member accepts.
//
// Coverage scope is captured in two parts:
//   - `coverage_scope` records *intent* ("all my current placements" vs.
//     "these specific placements") for display copy.
//   - `SittingRequestPlacement` rows snapshot the actual placement IDs at
//     submit time. Even when scope is `all_current_placements`, we resolve
//     and store the IDs so the request stays accurate if the foster's
//     placements change later.
export type SittingRequestStatus =
'open' |
'claimed' |
'in_progress' |
'completed' |
'canceled';

export type SittingCoverageScope =
'all_current_placements' |
'selected_placements';

export interface SittingRequest {
  id: string;
  requested_by_person_id: string;
  sitter_person_id?: string;
  coverage_scope: SittingCoverageScope;
  start_date: string;
  end_date: string;
  notes?: string;
  medication_required: boolean;
  foster_provides_supplies: boolean;
  transport_needed: boolean;
  status: SittingRequestStatus;
  created_at: string;
  updated_at: string;
}

export interface SittingRequestPlacement {
  id: string;
  sitting_request_id: string;
  foster_placement_id: string;
}

// — Clinic Planning ————————————————————————————————————
// TNR (Trap-Neuter-Return) orgs run periodic clinics — usually weekly — where
// a vet handles a batch of spay/neuter + vaccines. Cats are matched to slots,
// transport is coordinated, and intake paperwork is prepped.
export type ClinicEventStatus =
'planning' |
'scheduled' |
'in_progress' |
'completed' |
'canceled';

export interface ClinicEvent {
  id: string;
  date_time: string;
  location: string;
  /** Vet performing procedures. Person with role 'vet' in `people`. */
  veterinarian_person_id?: string;
  /**
   * Org-side point of contact (often a vet tech, clinic admin, or office
   * manager). Can be the same as veterinarian_person_id or different.
   */
  contact_person_id?: string;
  slot_capacity: number;
  transport_coordinator_person_id?: string;
  intake_coordinator_person_id?: string;
  notes?: string;
  status: ClinicEventStatus;
  created_at: string;
  updated_at: string;
}

export type ClinicSlotProcedureType =
'spay_neuter' |
'vaccines' |
'dental' |
'exam' |
'recheck' |
'other';

export type ClinicSlotStatus =
'reserved' |
'confirmed' |
'completed' |
'no_show' |
'canceled';

export interface ClinicSlot {
  id: string;
  clinic_event_id: string;
  animal_id: string;
  procedure_type: ClinicSlotProcedureType;
  reserved_by_person_id?: string;
  status: ClinicSlotStatus;
  notes?: string;
}