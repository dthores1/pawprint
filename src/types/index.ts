// Lifecycle stage only. "In foster" is NOT a status — it's derived from an
// active FosterPlacement (current_foster_id). Holds/concerns are flags on the
// Animal (is_on_hold / has_behavior_concern / has_medical_concern), orthogonal
// to lifecycle. An active (non-terminal) adoption is signaled via is_on_hold,
// kept in sync by addAdoption/cancelAdoption/completeAdoption.
export type AnimalStatus =
'intake' |
'in_care' |
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

/**
 * Legacy species union, still the type of the `animals.species` text column
 * during the catalog migration. Being phased out in favor of the `species`
 * catalog table + `animals.species_id` (see SpeciesCatalog / migration 0040).
 */
export type Species = 'Dog' | 'Cat' | 'Other';
export type Sex = 'Male' | 'Female' | 'Unknown';

/** A row from the global `species` catalog (migration 0037). Shared across
 *  orgs; the app reads it to drive species pickers and (later) per-org config. */
export interface SpeciesCatalog {
  id: string;
  name: string;
  slug: string;
  icon_name?: string;
  sort_order: number;
  active: boolean;
}

/** How `estimated_birth_date` was derived. `unknown` = no age on file yet. */
export type BirthdateSource =
'exact_birthdate' |
'estimated_birthdate' |
'estimated_age' |
'unknown';
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
  /**
   * Species display name (e.g. "Dog", "Rabbit"). DERIVED at load time from
   * `species_id` via the species catalog (WhiskerContext) — the legacy
   * `animals.species` text column was dropped (migration 0044). Read-only for
   * display; writes go through `species_id`.
   */
  species: string;
  /** FK into the global `species` catalog — the authoritative species reference. */
  species_id?: string;
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
  /** Optional link to the Rescue Site the animal was taken from (sites.id). */
  site_id?: string;
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
   * Denormalized cache: person_id of the active FosterPlacement's foster, if any.
   * The placements collection remains the source of truth for history; kept
   * in sync by placeAnimal / reassignFoster. Components may prefer the
   * derived check (active placement) for consistency with seed data.
   */
  current_foster_id?: string;
  /**
   * Condition flags — orthogonal to lifecycle `status` (an animal can be
   * Adoptable AND On Hold, or In Care with a behavior concern). DB columns are
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

// Breed reference catalog (global, shared across orgs). `species` is the legacy
// lowercase slug; `species_id` (migration 0037) is the catalog FK and the
// preferred key for filtering breeds by species.
export type BreedSpecies =
'dog' | 'cat' | 'rabbit' | 'bird' |
'reptile' | 'small_mammal' | 'farm_animal' | 'horse' | 'other';
export interface Breed {
  id: string;
  species: BreedSpecies;
  /** FK into the `species` catalog. Preferred over the `species` slug. */
  species_id?: string;
  name: string;
  active: boolean;
}

// Per-org enablement layer over the global catalogs (migration 0042).
/** Which catalog species an org accepts (one row per org+species). */
export interface OrganizationSpecies {
  id: string;
  organization_id: string;
  species_id: string;
  is_enabled: boolean;
  is_default: boolean;
  sort_order: number;
}
/**
 * Per-org breed restriction (opt-in). No rows for a species → all of that
 * species' breeds are allowed; rows present → only those breeds are allowed.
 */
export interface OrganizationBreed {
  id: string;
  organization_id: string;
  breed_id: string;
  is_enabled: boolean;
  sort_order: number;
}

// Per-org behavioral/personality labels (migration 0045). `species_id` null
// means the trait applies to all species; set scopes it to one species.
export interface Trait {
  id: string;
  organization_id: string;
  name: string;
  description?: string;
  species_id?: string;
  active: boolean;
  created_at: string;
  updated_at: string;
}
/** Junction: a trait assigned to an animal. */
export interface AnimalTrait {
  id: string;
  organization_id: string;
  animal_id: string;
  trait_id: string;
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

// Document attachments on an animal (PDFs, forms, records, legacy exports).
// Stored in the PRIVATE `animal-files` bucket; the app serves bytes via
// short-lived signed URLs (no public URL).
export type AnimalFileCategory =
'medical_record' |
'adoption_application' |
'legacy_export' |
'intake_document' |
'other';

export interface AnimalFile {
  id: string;
  animal_id: string;
  file_name: string;
  /** MIME type, e.g. 'application/pdf'. */
  file_type?: string;
  /** Size in bytes. */
  file_size?: number;
  /** Path within the private `animal-files` bucket; used for signed URLs + delete. */
  storage_path: string;
  category: AnimalFileCategory;
  notes?: string;
  /** Auth user id who uploaded it (resolved to a name via peopleIndex). */
  uploaded_by_user_id?: string;
  created_at: string;
}

// Where an animal is posted online for adoption. Replaces the old single
// `adoption_profile_url` field — orgs often post the same animal to several
// platforms. Groundwork for future automated syncing (Petfinder, etc.).
export type ExternalListingProvider =
'petfinder' |
'adopt_a_pet' |
'rescue_website' |
'facebook' |
'instagram' |
'other';

export type ExternalListingStatus =
'draft' |
'published' |
'removed' |
'unknown';

export interface AnimalExternalListing {
  id: string;
  animal_id: string;
  provider: ExternalListingProvider;
  url: string;
  status: ExternalListingStatus;
  notes?: string;
  created_at: string;
  updated_at: string;
}

/**
 * Kind of AI-generated content. `summary` backs the animal page's Summary tab;
 * the rest are reserved for future AI surfaces sharing the same table
 * (migration 0055). Keep in sync with the CHECK constraint on
 * `animal_ai_content.content_type`.
 */
export type AiContentType =
'summary' |
'adoption_profile' |
'internal_summary' |
'medical_summary' |
'foster_update';

/**
 * One piece of AI-generated content for an animal (migration 0055). Both content
 * fields start identical: `ai_generated_content` is the verbatim model output
 * and never changes through hand-edits; `draft_content` is what the UI shows
 * and edits. `user_edited` flips true once draft diverges from the AI version.
 * "Reset" copies ai_generated_content back into draft; "Regenerate" replaces
 * both with fresh output. At most one row per (animal_id, content_type).
 */
export interface AnimalAiContent {
  id: string;
  organization_id: string;
  animal_id: string;
  content_type: AiContentType;
  ai_generated_content: string;
  draft_content: string;
  user_edited: boolean;
  /** Model id used for the current ai_generated_content (e.g. 'gpt-4o-mini'). */
  model?: string;
  /**
   * Hash of the generation inputs (traits/notes/medical/animal fields) captured
   * when this content was produced. Compared to the current fingerprint to flag
   * "may be outdated". Null for rows generated before migration 0057.
   */
  source_fingerprint?: string;
  /** When the current ai_generated_content was produced. */
  generated_at: string;
  created_at: string;
  updated_at: string;
}

/** Org-level generation controls for adoption profiles (migration 0056). */
export type AdoptionProfileTone =
'warm_conversational' |
'professional' |
'playful';

export type AdoptionProfileLength = 'short' | 'standard' | 'detailed';

/**
 * An org's adoption-posting template (migration 0056). `template_body` is fixed
 * text plus placeholders: AI sections ({{ai_intro}}, {{ai_body}},
 * {{ai_home_requirements}}) and animal variables ({{animal.name}} etc.).
 * `tone`/`length`/`style_notes` steer the AI. MVP: one default per org.
 */
export interface OrganizationAdoptionTemplate {
  id: string;
  organization_id: string;
  name: string;
  template_body: string;
  tone: AdoptionProfileTone;
  length: AdoptionProfileLength;
  style_notes?: string;
  is_default: boolean;
  created_at: string;
  updated_at: string;
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
  /** Catalog species names this foster accepts (was the Dog/Cat/Other union). */
  preferred_species: string[];
  notes: string;
  active: boolean;
  photo_url?: string;
  /** Always includes 'foster_parent'; may include other roles too. */
  roles: PersonRole[];
  // Contact-info visibility (opt-in sharing with non-admin org members).
  share_phone?: boolean;
  share_email?: boolean;
  share_address?: boolean;
}

export type PlacementType = 'foster' | 'medical_foster' | 'trial_adoption';

// Why an animal is placed with a foster. 'general_foster' is the open-ended
// default; the rest are time-boxed (surfaced with an expected end date). Labels
// live in src/lib/placementPurpose.ts.
export type PlacementPurpose =
'general_foster' |
'temporary_holding' |
'medical_recovery' |
'behavioral_observation' |
'transport_staging';

export interface FosterPlacement {
  id: string;
  animal_id: string;
  /** The foster — a `people` row (with the 'foster_parent' role). */
  person_id: string;
  start_date: string;
  /** Actual close date. Nullable while the placement is active. */
  end_date?: string;
  /**
   * Optional planned end date — flags a time-boxed (temporary) foster stay
   * (emergency hold, until-clinic, transport staging…). Distinct from `end_date`
   * (the date it actually closed). Surfaced as "expected through …".
   */
  expected_end_date?: string;
  placement_status: 'active' | 'completed' | 'interrupted';
  /** Defaults to 'foster' on creation; more types may be added later. */
  placement_type: PlacementType;
  /**
   * Why the animal is here. Always populated at runtime (DB default +
   * rowToPlacement + the place/reassign actions); optional only so seed/raw
   * literals can omit it. Treat a missing value as 'general_foster'.
   */
  placement_purpose?: PlacementPurpose;
  /** Free-form reason a placement ended (e.g. "Reassigned", "Adopted"). */
  reason_ended?: string;
  notes?: string;
}

export type ProcedureType =
'vaccine' |
'spay_neuter' |
'microchip' |
'parasite_prevention' |
'exam' |
'surgery' |
'diagnostic_test' |
'medication' |
'other';

/**
 * Structured subtype within a `procedure_type` (e.g. 'rabies' under 'vaccine').
 * Optional on a record: null means legacy/unstructured (see custom_procedure_name).
 * The selectable set is gated per type/species/sex in `lib/medicalOptions.ts`.
 */
export type Procedure =
// vaccine
'rabies' | 'fvrcp' | 'felv' | 'dhpp' | 'bordetella' |
'leptospirosis' | 'canine_influenza' | 'rhdv2' |
// spay/neuter
'spay' | 'neuter' |
// parasite prevention
'flea_tick_prevention' | 'heartworm_prevention' | 'deworming' |
// exam
'wellness_exam' | 'intake_exam' | 'recheck_exam' | 'sick_exam' |
// diagnostic test
'felv_fiv_test' | 'heartworm_test' | 'fecal_test' |
'bloodwork' | 'urinalysis' | 'xray' | 'ultrasound' |
// microchip
'microchip_implant' | 'microchip_scan' |
// medication
'antibiotic' | 'pain_medication' | 'anti_inflammatory' | 'sedative' |
// surgery
'dental_surgery' | 'mass_removal' | 'wound_repair' |
'eye_surgery' | 'orthopedic_surgery' |
// catch-all
'other';

export type Route =
'oral' | 'topical' | 'subcutaneous' | 'intramuscular' | 'intravenous' |
'intranasal' | 'otic' | 'ophthalmic' | 'other';

export type DoseUnit =
'ml' | 'mg' | 'tablet' | 'capsule' | 'dose' | 'drop' | 'application' | 'other';

export type MedicalStatus =
'completed' |
'due' |
'scheduled' |
'overdue' |
'cancelled' |
'not_applicable';

export interface MedicalRecord {
  id: string;
  animal_id: string;
  procedure_type: ProcedureType;
  /**
   * Structured subtype. Null for legacy/unstructured records (their text
   * lives in custom_procedure_name). When 'other', custom_procedure_name
   * is required (DB-enforced).
   */
  procedure?: Procedure;
  /**
   * Legacy display name. Retained NOT NULL for backwards compatibility; the
   * app keeps it populated with a derived label. New code should prefer
   * `procedure` / `custom_procedure_name` as the source of truth.
   */
  procedure_name: string;
  /** Free-text custom name, used when `procedure === 'other'`. */
  custom_procedure_name?: string;
  /** Optional product/treatment brand (e.g. "Revolution Plus"). */
  product_name?: string;
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
  // Clinical detail (mostly for vaccines / medications).
  lot_number?: string;
  manufacturer?: string;
  dosage?: number;
  dose_unit?: DoseUnit;
  route?: Route;
  body_location?: string;
  expiration_date?: string;
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

export type SiteStatus =
'reported' |
'assessing' |
'active' |
'monitoring' |
'closed';

/** A physical location reported to the rescue that animals are taken from. */
export interface Site {
  id: string;
  organization_id: string;
  name: string;
  status: SiteStatus;
  /** Point-of-contact person (people.id). */
  contact_id?: string;
  /** Person coordinating the site (people.id). Defaults to the creator. */
  site_lead?: string;
  notes?: string;
  /** Structured address (carries the map pin + lat/long). */
  address?: AddressValue | null;
  created_by?: string;
  created_at: string;
  updated_at: string;
}

/** A person assigned to help at a site (many-to-many people <-> sites). */
export interface SiteVolunteer {
  id: string;
  site_id: string;
  contact_id: string;
  /** Free-text role at this site, e.g. "Feeder", "Trapper". */
  role?: string;
  added_at: string;
}

/** A free-form note attached to a Site (parallel to AnimalNote). */
export interface SiteNote {
  id: string;
  site_id: string;
  author_name: string;
  created_by?: string;
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
  /** Catalog species name (was the Dog/Cat/Other union). */
  species: string;
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
'social_media' |
'community_contact';
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

// Reusable per-org operational place (e.g. "ACP Clinic", "Melissa's House"),
// curated by admins under Settings → Locations and selectable as a transport
// pickup/dropoff. The `address` carries the structured coordinates for maps.
export interface SavedLocation {
  id: string;
  organization_id: string;
  name: string;
  address: AddressValue | null;
  active: boolean;
  created_at: string;
  updated_at: string;
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
  preferred_species?: string[];
  // — Contact-info visibility (opt-in sharing with non-admin org members) —
  // Admins always see everything; a user always sees their own record. Server-
  // enforced via the people_masked view, which nulls a field that isn't shared.
  share_phone?: boolean;
  share_email?: boolean;
  share_address?: boolean;
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

// ---- Member permissions ----------------------------------------------------
// A restricted action is allowed when the member is an org admin/owner OR holds
// an active grant for the matching permission type. Grants attach to an
// organization_members.id (a membership). Only MANAGE_SUPPLY_REQUESTS is
// enforced today; the rest are reserved for future Transport/Sitting gating.
export type MemberPermissionType =
'MANAGE_SUPPLY_REQUESTS' |
'MANAGE_SUPPLY_OPTIONS' |
'MANAGE_TRANSPORT_REQUESTS' |
'MANAGE_SITTING_REQUESTS' |
'MANAGE_SITES' |
'MANAGE_ANIMALS' |
'MANAGE_MEDICAL' |
'MANAGE_EXTERNAL_LISTINGS';

export interface MemberPermission {
  id: string;
  organization_id: string;
  member_id: string;
  permission_type: MemberPermissionType;
  is_active: boolean;
  starts_at?: string;
  ends_at?: string;
  granted_by_member_id?: string;
}

/** A row from organization_members — an account's membership in an org. */
export interface OrgMember {
  id: string;
  user_id: string;
  role: 'owner' | 'admin' | 'member';
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
'cancelled' |
'expired';

export type TransportRequestUrgency = 'normal' | 'urgent' | 'critical';

// When the transport is needed. Only `exact` auto-expires once its time passes.
export type TransportScheduleType =
'exact' |
'flexible' |
'asap' |
'coordinate_later';

export interface TransportRequest {
  id: string;
  type: TransportRequestType;
  status: TransportRequestStatus;
  schedule_type: TransportScheduleType;
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
  /** Optional link to the Saved Location a leg was picked from (friendly name).
   *  `null` on update clears it (e.g. switching to a typed address). */
  pickup_saved_location_id?: string | null;
  dropoff_saved_location_id?: string | null;
  /** Exact pickup datetime — set only for `exact` schedule_type. */
  requested_pickup_time?: string;
  /** Optional preferred date window — set only for `flexible` schedule_type. */
  preferred_window_start?: string;
  preferred_window_end?: string;
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
// `expired` is set by a nightly cron when an unclaimed request's end date
// passes — the request stays in history but never returns to the unclaimed
// queue. Treat it as terminal alongside `completed` and `cancelled`.
export type SittingRequestStatus =
'open' |
'claimed' |
'in_progress' |
'completed' |
'cancelled' |
'expired';

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
'cancelled';

export interface ClinicEvent {
  id: string;
  date_time: string;
  /** Legacy single-line location, kept in sync with `location_address`. */
  location: string;
  /** Structured location from Google Places (see address.ts column mappers). */
  location_address?: AddressValue | null;
  /** Optional link to the Saved Location this was picked from (friendly name).
   *  `null` on update clears it (e.g. switching to a typed address). */
  location_saved_location_id?: string | null;
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
'cancelled';

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
'animal_external_listings' |
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

// ---------- Notifications ----------
// Split model: a canonical `notifications` row fans out to one
// `user_notification` row per recipient (created exclusively by DB triggers —
// see migration 0066). The UI works with the joined `NotificationItem`.

export type NotificationType =
// Reactive (DB-trigger) events — migrations 0066/0067
'transport_request_claimed' |
'transport_request_assigned' |
'sitting_request_accepted' |
'supply_request_status_changed' |
'foster_animal_status_changed' |
'foster_animal_adoption_status_changed' |
'foster_animal_medical_record_added' |
'foster_placement_assigned' |
'foster_placement_ended' |
'clinic_appointment_scheduled' |
// Time-based reminders — scheduled pg_cron job, migration 0068
'clinic_appointment_reminder' |
'clinic_event_reminder' |
'transport_reminder_volunteer' |
'transport_reminder_requester' |
'transport_reminder_unaccepted' |
'sitting_reminder_volunteer' |
'sitting_reminder_requester' |
'sitting_reminder_unaccepted' |
'foster_placement_ending';

// The navigation target a notification links to. For foster/medical/adoption
// events this is the animal, not the source row (whose id lives in metadata).
export type NotificationEntityType =
'animal' |
'transport_request' |
'sitting_request' |
'supply_request' |
'clinic_event';

// One notification as the signed-in user sees it: the shared event joined with
// this user's per-recipient read state.
export interface NotificationItem {
  /** user_notification.id — the per-recipient row; target of mark-read. */
  user_notification_id: string;
  /** notifications.id — the shared event row. */
  notification_id: string;
  type: NotificationType | string;
  title: string;
  body: string;
  entity_type: NotificationEntityType | string;
  entity_id: string;
  actor_user_id?: string;
  metadata: Record<string, any>;
  read_at?: string;
  created_at: string;
}