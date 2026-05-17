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

export interface AnimalPlacement {
  id: string;
  animal_id: string;
  foster_parent_id: string;
  start_date: string;
  end_date?: string;
  placement_status: 'active' | 'completed' | 'interrupted';
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