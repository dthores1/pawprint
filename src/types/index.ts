// Lifecycle stage only. "In foster" is NOT a status — it's derived from an
// active FosterPlacement (current_foster_id). Holds/concerns are flags on the
// Animal (is_on_hold / has_behavior_concern / has_medical_concern), orthogonal
// to lifecycle. An active (non-terminal) adoption is signaled via is_on_hold,
// kept in sync by addAdoption/cancelAdoption/completeAdoption.
export type AnimalStatus =
'intake' |
'medical' |
'adoptable' |
'adopted' |
'released' |
'hospice' |
'deceased';

export type Priority = 'normal' | 'needs_attention' | 'urgent' | 'critical';

export type ActionItemStatus = 'open' | 'completed' | 'cancelled';
// A tracked "next step" for an animal. Replaces the single animal.action_needed
// field so completions/cancellations are kept in history (and shown in the
// activity timeline). At most one 'open' item per animal.
export interface AnimalActionItem {
  id: string;
  animal_id: string;
  description: string;
  /** Mirrors the elevated Priority levels (no 'normal'). */
  priority: Exclude<Priority, 'normal'>;
  status: ActionItemStatus;
  /** Auth user id who opened it. Used for archive permission. */
  created_by?: string;
  created_at: string;
  completed_at?: string;
  /** Auth user id who completed/cancelled it. */
  completed_by?: string;
  completion_note?: string;
}

export type Species = 'Dog' | 'Cat' | 'Other';
export type Sex = 'Male' | 'Female' | 'Unknown';

/** How `estimated_birth_date` was derived. */
export type BirthdateSource =
'exact_birthdate' |
'estimated_birthdate' |
'estimated_age';
export type AgeUnit = 'days' | 'weeks' | 'months' | 'years';

export interface Animal {
  id: string;
  /**
   * Display name. Either `name` or `rescue_id` must be present (DB CHECK).
   * Animals can exist with just a Rescue ID (e.g. unnamed cats in a TNR
   * colony) — use `animalDisplayName()` in UI to pick the right label.
   */
  name?: string;
  /**
   * Operational identifier assigned by the rescue (e.g. `DanBH-1`, `ACP-1044`).
   * Unique within an organization (partial unique index, NULL allowed).
   */
  rescue_id?: string;
  species: Species;
  sex: Sex;
  /**
   * Canonical date used to compute current age everywhere. Always set — when
   * the user gives an estimated age instead, it's computed from that.
   */
  estimated_birth_date: string;
  /** Known breed from the `breeds` catalog (mutually exclusive with breed_text). */
  breed_id?: string;
  /** Free-text breed for custom / messy real-world values ("Pit mix", etc.). */
  breed_text?: string;
  is_mixed_breed?: boolean;
  /** Set when this animal belongs to a litter (see Litter). Littermates are
   *  derived from shared litter_id, not from AnimalRelationship rows. */
  litter_id?: string;
  /** Metadata: how `estimated_birth_date` was arrived at. Defaults to estimated_birthdate. */
  birthdate_source?: BirthdateSource;
  /** Original age estimate (audit/context), set when birthdate_source === 'estimated_age'. */
  estimated_age_value?: number;
  estimated_age_unit?: AgeUnit;
  /** The date the age estimate was anchored to (usually intake or today). */
  estimated_age_as_of?: string;
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
   * Denormalized cache: person_id of the active FosterPlacement's foster, if any.
   * The placements collection remains the source of truth for history; kept
   * in sync by placeAnimal / reassignFoster. Components may prefer the
   * derived check (active placement) for consistency with seed data.
   */
  current_foster_id?: string;
  /**
   * Condition flags — orthogonal to lifecycle `status` (an animal can be
   * Adoptable AND On Hold, or Not Ready with a behavior concern). DB columns are
   * NOT NULL DEFAULT false; optional here since optimistic local rows may omit
   * them (treat undefined as false).
   */
  is_on_hold?: boolean;
  has_behavior_concern?: boolean;
  has_medical_concern?: boolean;
  /** Adopter (people.id) once the animal is adopted; set with `adopted_at`. */
  adopted_by_id?: string;
  /** Timestamp the adoption was finalized. */
  adopted_at?: string;
  /** Staff-only notes, separate from the public-facing `description` blurb. */
  internal_notes?: string;
  created_at: string;
  updated_at: string;
}

// Breed reference catalog (global, shared across orgs). `species` is lowercase
// and includes rabbit/bird/other, unlike the app's TitleCase `Species`.
export type BreedSpecies = 'dog' | 'cat' | 'rabbit' | 'bird' | 'other';
export interface Breed {
  id: string;
  species: BreedSpecies;
  name: string;
  active: boolean;
}

export type PhotoCategory =
'intake' |
'medical' |
'general' |
'adoption_listing';

export interface AnimalPhoto {
  id: string;
  animal_id: string;
  url: string;
  /**
   * Path within the Supabase Storage `animal-photos` bucket. Present for
   * uploaded files (used to delete the object); absent for external URLs.
   */
  storage_path?: string;
  category: PhotoCategory;
  caption?: string;
  /** Auth user id who uploaded it. Used for archive permission. */
  created_by?: string;
  uploaded_at: string;
}

// The foster-specific fields captured by the Add/Edit Foster forms. A foster is
// created/updated as a `people` row (role 'volunteer' + roles ['foster_parent']).
export interface FosterInput {
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  /** Legacy single-line address (kept in sync with address_formatted). */
  address: string;
  // Structured address (optional — populated by AddressAutocomplete).
  address_google_place_id?: string;
  address_formatted?: string;
  address_street_1?: string;
  address_street_2?: string;
  address_city?: string;
  address_state?: string;
  address_postal_code?: string;
  address_country?: string;
  address_latitude?: number;
  address_longitude?: number;
  max_capacity: number;
  preferred_species: Species[];
  notes: string;
  active: boolean;
  photo_url?: string;
  /** Always includes 'foster_parent'; may include other roles too. */
  roles: PersonRole[];
}

export type PlacementType = 'foster' | 'medical_foster' | 'trial_adoption';

export interface FosterPlacement {
  id: string;
  animal_id: string;
  /** The foster — a `people` row (with the 'foster_parent' role). */
  person_id: string;
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
  /** Known person who performed/administered it (people row). */
  provider_contact_id?: string;
  /** Free-text performer fallback when not a known contact. */
  provider_name?: string;
  /** Scheduled clinic event it was done at (clinic_events row). */
  clinic_id?: string;
  /** Free-text facility fallback (vet office, shelter, hospital, …). */
  facility_name?: string;
  /**
   * Captured chip number when procedure_type === 'microchip'. Optional —
   * the chip may be implanted before the number is registered. The app
   * mirrors a populated value onto animals.microchip_number on save.
   */
  microchip_number?: string;
  notes?: string;
  /**
   * When a recurring procedure (vaccine/exam/surgery/medication) becomes due
   * again — e.g. a rabies shot renewed in a year. Optional; many procedures
   * aren't recurring.
   */
  next_due_date?: string;
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
  /** auth.users.id of whoever wrote the note. Used for archive permission. */
  created_by?: string;
  note_type: NoteType;
  body: string;
  created_at: string;
}

export interface AnimalRelationship {
  id: string;
  animal_id: string;
  related_animal_id: string;
  // 'littermate' intentionally removed — littermates are derived from a shared
  // litter_id (avoids the N² relationship rows). See Litter + RelationshipsCard.
  relationship_type: 'mother' | 'father' | 'sibling' | 'child' | 'bonded_pair';
  notes?: string;
}

// Operational adoption workflow. One row per adoption attempt for an animal;
// an animal can have at most one *active* (non-terminal) adoption at a time.
// Completing it sets the animal to 'adopted' + stamps adopted_by_id/adopted_at.
export type AdoptionStatus =
'inquiry' |
'application_submitted' |
'meet_and_greet' |
'pending_paperwork' |
'ready_for_placement' |
'completed' |
'cancelled' |
'returned';

// Why an adopter returned an animal. Required (DB CHECK) when status='returned'.
export type AdoptionReturnReason =
'behavior' |
'medical' |
'financial' |
'housing' |
'pet_compatibility' |
'family_compatibility' |
'life_changes' |
'rescue_request' |
'other';
export interface Adoption {
  id: string;
  animal_id: string;
  adopter_id: string;
  status: AdoptionStatus;
  submitted_at?: string;
  approved_at?: string;
  completed_at?: string;
  cancelled_at?: string;
  paperwork_sent_at?: string;
  paperwork_completed_at?: string;
  /** Set when a completed adoption is reversed (animal returned to the rescue). */
  returned_at?: string;
  return_reason?: AdoptionReturnReason;
  return_notes?: string;
  donation_amount?: number;
  notes?: string;
  created_at: string;
  updated_at?: string;
}

// A litter groups animals that share intake/age/origin metadata. Members link
// via animals.litter_id; littermates are derived from that, not relationships.
export interface Litter {
  id: string;
  name?: string;
  species: Species;
  breed_id?: string;
  breed_text?: string;
  estimated_birth_date?: string;
  intake_date: string;
  intake_source?: string;
  /** The mother (an existing Animal), if known. */
  mother_animal_id?: string;
  notes?: string;
}

// A person's roles/capabilities — a single flat, non-hierarchical set (this
// replaced the old role + volunteer_type split). Selectable roles are grouped in
// RolesMultiSelect (Animal Care / Volunteer & Support / Organization). 'volunteer'
// is NOT offered — it's retained only for the legacy NOT-NULL `people.role` column
// + role-less legacy rows. `roles` is a free-form text[] in Postgres, so adding
// values here needs no migration.
export type PersonRole =
'vet' |
'rescue_staff' |
'volunteer' |
'adopter' |
'donor' |
'foster_parent' |
'trapper' |
'transport' |
'admin' |
'event_support' |
'social_media';
export type VolunteerType =
'foster_parent' |
'administrative' |
'trapper' |
'transport' |
'event_support' |
'social_media' |
'other';

// A structured address resolved from a Google Places lookup (or typed by hand,
// in which case only `formatted` is set). Stored flat on entities as
// `address_*` columns; AddressAutocomplete emits/consumes this shape. See
// `src/lib/address.ts` for the row ↔ value mappers.
export interface AddressValue {
  /** Single-line display string (Google `formatted_address`, or raw typed text). */
  formatted: string;
  /** Google Place ID — the durable key; safe to store long-term. */
  placeId?: string;
  /** Street number + route, e.g. "123 Main St". */
  street1?: string;
  /** Unit / apt / suite (Google `subpremise`). */
  street2?: string;
  city?: string;
  /** State / province (2-letter where available). */
  state?: string;
  postalCode?: string;
  /** ISO country code (e.g. "US"). */
  country?: string;
  latitude?: number;
  longitude?: number;
}

export interface Person {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone?: string;
  /**
   * Multi-role: a person can be e.g. ['vet', 'foster_parent']. This is the
   * source of truth for what someone does. Fosters are people whose `roles`
   * include 'foster_parent'.
   */
  roles: PersonRole[];
  /**
   * Legacy single role — still written for back-compat (DB column is NOT NULL),
   * but read from `roles`. New foster-people use role 'volunteer'.
   */
  role: PersonRole;
  volunteer_type?: VolunteerType;
  organization_name?: string;
  notes?: string;
  photo_url?: string;
  active: boolean;
  created_at: string;
  /**
   * Set when this record is an app-user account (the signed-in user's "self"
   * record), as opposed to a directory contact. Account records are used for
   * attribution but hidden from the Contacts directory.
   */
  user_id?: string;
  // — Address —————————————————————————————————————————————————————
  /**
   * Legacy single-line address. Kept in sync with `address_formatted` so older
   * displays keep working; new writes go through the structured fields below.
   */
  address?: string;
  /** Structured address from Google Places (see AddressValue / address.ts). */
  address_google_place_id?: string;
  address_formatted?: string;
  address_street_1?: string;
  address_street_2?: string;
  address_city?: string;
  address_state?: string;
  address_postal_code?: string;
  address_country?: string;
  address_latitude?: number;
  address_longitude?: number;
  // — Foster-specific (meaningful when roles includes 'foster_parent') —
  max_capacity?: number;
  preferred_species?: Species[];
}

// Simplified five-state lifecycle. Fulfillment details (pickup vs. shipping)
// live on the supply request as separate fields, not as statuses. `denied` is
// the reviewer-side rejection (with a required denial_reason); `cancelled` is
// the requester pulling the request themselves.
export type SupplyRequestStatus =
'submitted' |
'in_progress' |
'fulfilled' |
'cancelled' |
'denied';

export type SupplyRequestPriority = 'normal' | 'urgent' | 'critical';

export type DeliveryMethod = 'pickup' | 'drop_off' | 'shipped';

// Constrained at the DB level (see 0006/0019 migrations) — keep in sync.
export type SupplySupplier =
'Amazon' |
'Chewy' |
'Petco' |
'PetSmart' |
'Target' |
'Walmart' |
'Costco' |
'Tractor Supply' |
'Local Store' |
'Other';

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
  /** Where the order was placed (Amazon, Chewy, …). Set when fulfilling. */
  supplier?: SupplySupplier;
  /** Total order cost in USD. Captured at fulfillment for spend tracking. */
  total_cost?: number;
  /** Required when status is 'denied'. Free text from the reviewer. */
  denial_reason?: string;
  /**
   * When true, this request doubles as a reusable "common request" template for
   * its requester. Reusing it creates a brand-new request copied from this one
   * (this row is never mutated except to bump `common_request_last_used_at`).
   */
  is_common_request?: boolean;
  common_request_name?: string;
  common_request_last_used_at?: string;
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
  /** Requester-provided product URL (Amazon link, Chewy link, etc.). */
  product_url?: string;
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
  /** Legacy single-line locations, kept in sync with the structured addresses. */
  pickup_location: string;
  dropoff_location: string;
  /** Structured addresses from Google Places (see address.ts column mappers). */
  pickup_address?: AddressValue | null;
  dropoff_address?: AddressValue | null;
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
  /** Legacy single-line location, kept in sync with `location_address`. */
  location: string;
  /** Structured location from Google Places (see address.ts column mappers). */
  location_address?: AddressValue | null;
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
'flea_treatment' |
'deworming' |
'microchip' |
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
  reserved_by_person_id?: string;
  status: ClinicSlotStatus;
  notes?: string;
}

// A slot's individual procedures (an animal usually gets several per visit).
// Stored in clinic_slot_procedures; `completed` tracks per-procedure progress.
export interface ClinicSlotProcedure {
  id: string;
  clinic_slot_id: string;
  procedure_type: ClinicSlotProcedureType;
  notes?: string;
  completed: boolean;
}

// Every archive-supporting table. Used as the discriminant for archive_record /
// restore_record RPC calls and the row.record_type returned by list_archived.
export type ArchiveTable =
'animals' |
'animal_notes' |
'animal_photos' |
'animal_action_items' |
'animal_relationships' |
'people' |
'medical_records' |
'foster_placements' |
'clinic_events' |
'clinic_slots' |
'clinic_slot_procedures' |
'litters' |
'adoptions' |
'products' |
'supply_requests' |
'supply_request_items' |
'transport_requests' |
'sitting_requests' |
'sitting_request_placements';

// One row in the Recycle Bin — returned by the list_archived() RPC.
export interface ArchivedRecord {
  /** Logical type, e.g. 'animal_note' (singular form of the table name). */
  record_type: string;
  record_id: string;
  /** e.g. animal_id for notes/photos/relationships; null when n/a. */
  parent_id?: string;
  /** Best-effort short label rendered by the bin's "Name" column. */
  display_name: string;
  deleted_at: string;
  deleted_by: string | null;
}