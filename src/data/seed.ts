import {
  Animal,
  Breed,
  BreedSpecies,
  FosterInput,
  FosterPlacement,
  MedicalRecord,
  AnimalNote,
  AnimalRelationship,
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
  Adoption } from
'../types';

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** YYYY-MM-DD, N calendar days from today (local). Demo seed only. */
function seedDateOnly(daysFromNow: number): string {
  return new Date(Date.now() + daysFromNow * MS_PER_DAY).
  toISOString().
  split('T')[0];
}

/** ISO datetime N calendar days from today at a fixed local clock time. */
function seedDateTime(daysFromNow: number, hour: number, minute = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + daysFromNow);
  d.setHours(hour, minute, 0, 0);
  return d.toISOString();
}

// Global breed catalog (mirrors the `breeds` table seed). Demo mode reads this;
// production reads the Supabase table.
const BREED_DATA: [BreedSpecies, string[]][] = [
['dog', [
'Mixed Breed', 'Unknown', 'Labrador Retriever', 'Labrador Mix',
'German Shepherd', 'German Shepherd Mix', 'Golden Retriever',
'Golden Retriever Mix', 'Pit Bull', 'Pit Bull Mix',
'American Staffordshire Terrier', 'Staffordshire Bull Terrier',
'Chihuahua', 'Chihuahua Mix', 'Husky', 'Husky Mix', 'Australian Shepherd',
'Border Collie', 'Boxer', 'Poodle', 'Standard Poodle', 'Miniature Poodle',
'Shih Tzu', 'Yorkshire Terrier', 'Dachshund', 'Beagle', 'Corgi',
'Great Pyrenees', 'Mastiff', 'Doberman Pinscher', 'Rottweiler',
'Pomeranian', 'French Bulldog', 'Bulldog', 'Cocker Spaniel',
'Jack Russell Terrier', 'Boston Terrier']],
['cat', [
'Domestic Shorthair', 'Domestic Medium Hair', 'Domestic Longhair',
'Mixed Breed', 'Unknown', 'Siamese', 'Maine Coon', 'Persian', 'Ragdoll',
'Bengal', 'Russian Blue', 'British Shorthair', 'Sphynx', 'Scottish Fold',
'Norwegian Forest Cat']],
['rabbit', [
'Mixed Breed', 'Unknown', 'Lionhead', 'Mini Rex', 'Holland Lop',
'Netherland Dwarf']],
['bird', [
'Parakeet', 'Cockatiel', 'Lovebird', 'Canary', 'Conure', 'Unknown']]];

export const seedBreeds: Breed[] = BREED_DATA.flatMap(([species, names]) =>
names.map((name, i) => ({
  id: `br_${species}_${i}`,
  species,
  name,
  active: true
}))
);

export const seedAnimals: Animal[] = [
{
  id: 'a1',
  name: 'Biscuit',
  species: 'Dog',
  sex: 'Male',
  estimated_birth_date: '2022-05-10',
  intake_date: '2023-10-01',
  intake_source: 'City Shelter Transfer',
  status: 'adoptable',
  priority: 'normal',
  is_on_hold: true,
  description:
  'A sweet, goofy Golden Retriever mix who loves everyone. Great with kids and other dogs. Needs a yard to run in.',
  microchip_number: '981020000000001',
  adoption_profile_url: 'https://www.petfinder.com/dog/biscuit-whiskerville-a1',
  primary_photo_url:
  'https://images.unsplash.com/photo-1552053831-71594a27632d?auto=format&fit=crop&q=80&w=800',
  created_at: '2025-10-01T10:00:00Z',
  updated_at: '2025-11-15T10:00:00Z'
},
{
  id: 'a2',
  name: 'Marmalade',
  species: 'Cat',
  sex: 'Female',
  estimated_birth_date: '2020-08-15',
  intake_date: '2023-11-05',
  intake_source: 'Owner Surrender',
  status: 'medical',
  priority: 'needs_attention',
  action_needed:
  'Soft food only + finish 10-day antibiotic course (3 days remaining). Recheck on Nov 25.',
  description:
  'Chonky orange tabby. Very affectionate but currently recovering from a minor dental surgery. Needs soft food.',
  microchip_number: '981020000000002',
  primary_photo_url:
  'https://images.unsplash.com/photo-1513360371669-4adf3dd7dff8?auto=format&fit=crop&q=80&w=800',
  current_foster_id: 'f3',
  created_at: '2025-11-05T14:30:00Z',
  updated_at: '2025-11-20T09:00:00Z'
},
{
  id: 'a3',
  name: 'Juniper',
  species: 'Dog',
  sex: 'Female',
  estimated_birth_date: '2023-09-01',
  intake_date: '2023-11-10',
  intake_source: 'Stray',
  status: 'adoptable',
  priority: 'normal',
  description:
  'Energetic terrier mix puppy. Learning basic commands and doing well with crate training.',
  primary_photo_url:
  'https://images.unsplash.com/photo-1537151608804-ea6f11cc98f9?auto=format&fit=crop&q=80&w=800',
  current_foster_id: 'f1',
  created_at: '2025-11-10T11:15:00Z',
  updated_at: '2025-11-12T16:00:00Z'
},
{
  id: 'a4',
  name: 'Milkshake',
  species: 'Cat',
  sex: 'Male',
  estimated_birth_date: '2023-10-20',
  intake_date: '2023-11-22',
  intake_source: 'Stray Litter',
  status: 'medical',
  priority: 'critical',
  action_needed:
  'Start URI antibiotics today and find an isolated foster — cannot be housed with other kittens.',
  description:
  'Tiny black kitten found alone. Currently battling an upper respiratory infection. Needs immediate foster placement.',
  primary_photo_url:
  'https://images.unsplash.com/photo-1514888286974-6c03e2ca1dba?auto=format&fit=crop&q=80&w=800',
  litter_id: 'litter_demo',
  created_at: '2025-11-22T08:00:00Z',
  updated_at: '2025-11-22T08:00:00Z'
},
{
  id: 'a5',
  name: 'Luna',
  species: 'Dog',
  sex: 'Female',
  estimated_birth_date: '2019-03-12',
  intake_date: '2023-09-15',
  intake_source: 'City Shelter Transfer',
  status: 'adopted',
  priority: 'normal',
  description:
  'Calm, older husky mix. Loves long walks and naps on the couch.',
  microchip_number: '981020000000005',
  primary_photo_url:
  'https://images.unsplash.com/photo-1605568420105-eb2a4caa5e3e?auto=format&fit=crop&q=80&w=800',
  created_at: '2025-09-15T09:00:00Z',
  updated_at: '2025-10-30T14:00:00Z'
},
{
  id: 'a6',
  name: 'Hazel',
  species: 'Dog',
  sex: 'Female',
  estimated_birth_date: '2021-02-10',
  intake_date: '2023-11-25',
  intake_source: 'Owner Surrender',
  status: 'intake',
  priority: 'normal',
  description:
  'Shy but sweet mixed breed. Needs patience and a quiet home to decompress.',
  microchip_number: '981020000000006',
  primary_photo_url:
  'https://images.unsplash.com/photo-1583511655857-d19b40a7a54e?auto=format&fit=crop&q=80&w=800',
  created_at: '2025-11-25T10:00:00Z',
  updated_at: '2025-11-25T10:00:00Z'
},
{
  id: 'a7',
  name: 'Pip',
  species: 'Cat',
  sex: 'Male',
  estimated_birth_date: '2025-07-01',
  intake_date: '2025-08-13',
  intake_source: 'Stray',
  status: 'adoptable',
  priority: 'normal',
  description:
  'Trapped in Columbia City, Seattle with four of his littermates and his mother.',
  microchip_number: '981020000000007',
  adoption_profile_url: 'https://www.petfinder.com/cat/pip-whiskerville-a7',
  primary_photo_url: '/images/animals/pip-1.jpg',
  created_at: '2025-10-20T10:00:00Z',
  updated_at: '2025-11-01T10:00:00Z'
},
{
  id: 'a8',
  name: 'Pepper',
  species: 'Cat',
  sex: 'Female',
  estimated_birth_date: '2023-05-15',
  intake_date: '2023-11-15',
  intake_source: 'Hoarding Case',
  status: 'not_ready',
  priority: 'normal',
  has_behavior_concern: true,
  description:
  'Timid young cat learning to trust humans. Making great progress in foster.',
  microchip_number: '981020000000008',
  primary_photo_url:
  'https://images.unsplash.com/photo-1573865526739-10659fec78a5?auto=format&fit=crop&q=80&w=800',
  current_foster_id: 'f5',
  created_at: '2025-11-15T10:00:00Z',
  updated_at: '2025-11-18T10:00:00Z'
},
{
  id: 'a9',
  name: 'Otis',
  species: 'Dog',
  sex: 'Male',
  estimated_birth_date: '2022-11-01',
  intake_date: '2023-11-28',
  intake_source: 'Stray',
  status: 'intake',
  priority: 'urgent',
  action_needed:
  'Schedule vet eval for right hind leg limp this week and identify a medical foster home.',
  description:
  'Found wandering with a slight limp. Needs vet evaluation and a medical foster ASAP.',
  primary_photo_url:
  'https://images.unsplash.com/photo-1543466835-00a7907e9de1?auto=format&fit=crop&q=80&w=800',
  created_at: '2025-11-28T10:00:00Z',
  updated_at: '2025-11-28T10:00:00Z'
},
{
  id: 'a10',
  name: 'Willow',
  species: 'Cat',
  sex: 'Female',
  estimated_birth_date: '2023-11-01',
  intake_date: '2023-11-20',
  intake_source: 'Born in Care',
  status: 'not_ready',
  priority: 'normal',
  description: 'Playful kitten, part of a litter of 4.',
  primary_photo_url:
  'https://images.unsplash.com/photo-1596854407944-bf87f6fdd49e?auto=format&fit=crop&q=80&w=800',
  current_foster_id: 'f7',
  litter_id: 'litter_demo',
  created_at: '2025-11-20T10:00:00Z',
  updated_at: '2025-11-20T10:00:00Z'
},
{
  id: 'a11',
  name: 'Duffy',
  species: 'Dog',
  sex: 'Male',
  estimated_birth_date: '2020-04-10',
  intake_date: '2023-11-01',
  intake_source: 'Owner Surrender',
  status: 'adoptable',
  priority: 'normal',
  description: 'Fluffy small breed mix. Very cuddly and house trained.',
  microchip_number: '981020000000011',
  primary_photo_url:
  'https://images.unsplash.com/photo-1583337130417-3346a1be7dee?auto=format&fit=crop&q=80&w=800',
  created_at: '2025-11-01T10:00:00Z',
  updated_at: '2025-11-15T10:00:00Z'
},
{
  id: 'a12',
  name: 'Clementine',
  species: 'Cat',
  sex: 'Female',
  estimated_birth_date: '2017-09-20',
  intake_date: '2023-10-10',
  intake_source: 'City Shelter Transfer',
  status: 'not_ready',
  priority: 'needs_attention',
  has_medical_concern: true,
  action_needed:
  'Review senior bloodwork results with vet and confirm renal diet plan.',
  description: 'Senior kitty who loves heated blankets and quiet afternoons.',
  microchip_number: '981020000000012',
  current_foster_id: 'f7',
  created_at: '2025-10-10T10:00:00Z',
  updated_at: '2025-10-15T10:00:00Z'
}];


// Fosters are people with the 'foster_parent' role. These literals carry the
// foster-specific fields; the .map below turns them into Person records.
const rawFosters: (Omit<FosterInput, 'roles'> & { id: string })[] = [
{
  id: 'f1',
  first_name: 'Sarah',
  last_name: 'Jenkins',
  email: 'sarah.j@example.com',
  phone: '(555) 123-4567',
  address: '123 Maple St, Portland, OR',
  max_capacity: 2,
  preferred_species: ['Dog'],
  notes: 'Has a fenced yard. Works from home. Prefers medium to large dogs.',
  active: true,
  photo_url:
  'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&q=80&w=200'
},
{
  id: 'f2',
  first_name: 'Marcus',
  last_name: 'Chen',
  email: 'mchen@example.com',
  phone: '(555) 987-6543',
  address: '456 Oak Ave, Apt 3B, Portland, OR',
  max_capacity: 3,
  preferred_species: ['Cat'],
  notes:
  'Experienced with neonatal kittens and bottle feeding. No other pets in home.',
  active: true
},
{
  id: 'f3',
  first_name: 'Dan',
  last_name: 'Thoreson',
  email: 'thoreson.dan@gmail.com',
  phone: '(555) 390-2847',
  address: '789 Pine Ln, Seattle, WA',
  max_capacity: 5,
  preferred_species: ['Dog', 'Cat'],
  notes: 'Great with medical recovery cases. Has a quiet home.',
  active: true,
  photo_url: '/images/contacts/Dan_Thoreson.jpeg'
},
{
  id: 'f4',
  first_name: 'David',
  last_name: 'Kim',
  email: 'dkim@example.com',
  phone: '(555) 222-3333',
  address: '101 Elm St, Portland, OR',
  max_capacity: 2,
  preferred_species: ['Dog'],
  notes: 'Active runner, loves high-energy dogs.',
  active: true
},
{
  id: 'f5',
  first_name: 'Anita',
  last_name: 'Patel',
  email: 'anita.p@example.com',
  phone: '(555) 444-5555',
  address: '202 Birch Rd, Portland, OR',
  max_capacity: 4,
  preferred_species: ['Cat'],
  notes: 'Has a dedicated kitten room. Very experienced.',
  active: true,
  photo_url:
  'https://images.unsplash.com/photo-1558377235-76f53857000b?auto=format&fit=crop&q=80&w=200'
},
{
  id: 'f6',
  first_name: 'James',
  last_name: 'Wilson',
  email: 'jwilson@example.com',
  phone: '(555) 666-7777',
  address: '303 Cedar Ct, Portland, OR',
  max_capacity: 1,
  preferred_species: ['Dog', 'Other'],
  notes: 'Good with large breeds and behavioral challenges.',
  active: true
},
{
  id: 'f7',
  first_name: 'Maria',
  last_name: 'Garcia',
  email: 'mgarcia@example.com',
  phone: '(555) 888-9999',
  address: '404 Spruce Way, Portland, OR',
  max_capacity: 2,
  preferred_species: ['Cat'],
  notes: 'Prefers adult or senior cats.',
  active: true
},
{
  id: 'f8',
  first_name: 'Tom',
  last_name: 'Baker',
  email: 'tbaker@example.com',
  phone: '(555) 111-2222',
  address: '505 Walnut Dr, Portland, OR',
  max_capacity: 1,
  preferred_species: ['Dog'],
  notes: 'Apartment living, small dogs only.',
  active: false
},
{
  id: 'f9',
  first_name: 'Linda',
  last_name: 'Martinez',
  email: 'linda.m@example.com',
  phone: '(555) 333-4444',
  address: '606 Ash St, Portland, OR',
  max_capacity: 3,
  preferred_species: ['Cat', 'Dog'],
  notes: 'Flexible, works part-time.',
  active: true
},
{
  id: 'f10',
  first_name: 'Robert',
  last_name: 'Taylor',
  email: 'rtaylor@example.com',
  phone: '(555) 555-6666',
  address: '707 Fir Ave, Portland, OR',
  max_capacity: 2,
  preferred_species: ['Dog'],
  notes: 'Has two resident dogs, good for socialization.',
  active: true,
  photo_url:
  'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&q=80&w=200'
}];

// Foster literals → Person records (role 'volunteer' + 'foster_parent' in roles).
const fosterPeople: Person[] = rawFosters.map((f) => ({
  ...f,
  role: 'volunteer' as PersonRole,
  roles: ['foster_parent'] as PersonRole[],
  created_at: '2024-01-01T10:00:00Z'
}));


export const seedPlacements: FosterPlacement[] = [
{
  id: 'p1',
  animal_id: 'a3',
  person_id:'f1',
  start_date: '2023-11-12T10:00:00Z',
  placement_status: 'active',
  placement_type: 'foster'
},
{
  id: 'p2',
  animal_id: 'a2',
  person_id:'f3',
  start_date: '2023-11-06T14:00:00Z',
  placement_status: 'active',
  placement_type: 'medical_foster',
  notes: 'Recovering from dental surgery.'
},
{
  id: 'p3',
  animal_id: 'a5',
  person_id:'f1',
  start_date: '2023-09-16T09:00:00Z',
  end_date: '2023-10-30T14:00:00Z',
  placement_status: 'completed',
  placement_type: 'foster',
  reason_ended: 'Adopted',
  notes: 'Adopted!'
},
{
  id: 'p4',
  animal_id: 'a8',
  person_id:'f5',
  start_date: '2023-11-18T10:00:00Z',
  placement_status: 'active',
  placement_type: 'foster'
},
// — Willow (a10) historical chain — demonstrates the Placement Timeline.
{
  id: 'p5a',
  animal_id: 'a10',
  person_id:'f2',
  start_date: '2024-01-08T10:00:00Z',
  end_date: '2024-06-15T10:00:00Z',
  placement_status: 'completed',
  placement_type: 'foster',
  reason_ended: 'Reassigned — foster took a break for travel.',
  notes: 'Bottle-fed through weaning.'
},
{
  id: 'p5b',
  animal_id: 'a10',
  person_id:'f9',
  start_date: '2024-06-15T10:00:00Z',
  end_date: '2025-09-30T10:00:00Z',
  placement_status: 'completed',
  placement_type: 'foster',
  reason_ended: 'Reassigned — moved to a quieter home for socialization.'
},
{
  id: 'p5c',
  animal_id: 'a10',
  person_id:'f7',
  start_date: '2025-09-30T10:00:00Z',
  placement_status: 'active',
  placement_type: 'foster'
},
{
  id: 'p6',
  animal_id: 'a12',
  person_id:'f7',
  start_date: '2023-10-15T10:00:00Z',
  placement_status: 'active',
  placement_type: 'foster'
},
{
  id: 'p7',
  animal_id: 'a11',
  person_id:'f10',
  start_date: '2023-11-05T10:00:00Z',
  end_date: '2023-11-15T10:00:00Z',
  placement_status: 'completed',
  placement_type: 'foster',
  reason_ended: 'Returned to shelter for adoption events.',
  notes: 'Returned to shelter for adoption events.'
}];


export const seedMedicalRecords: MedicalRecord[] = [
{
  id: 'm1',
  animal_id: 'a1',
  procedure_type: 'vaccine',
  procedure_name: 'Rabies',
  performed_date: '2023-10-05',
  status: 'completed',
  provider_name: 'Dr. Smith'
},
{
  id: 'm2',
  animal_id: 'a1',
  procedure_type: 'exam',
  procedure_name: 'Annual Checkup',
  due_date: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).
  toISOString().
  split('T')[0],
  status: 'due'
},
{
  id: 'm3',
  animal_id: 'a2',
  procedure_type: 'surgery',
  procedure_name: 'Dental Extraction',
  performed_date: '2023-11-18',
  status: 'completed',
  provider_name: 'Dr. Evans',
  notes: 'Extracted 2 premolars. Healing well.'
},
{
  id: 'm4',
  animal_id: 'a4',
  procedure_type: 'medication',
  procedure_name: 'Antibiotics (URI)',
  due_date: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).
  toISOString().
  split('T')[0],
  status: 'overdue',
  notes: 'Needs amoxicillin twice daily.'
},
{
  id: 'm5',
  animal_id: 'a3',
  procedure_type: 'vaccine',
  procedure_name: 'DHPP Booster',
  due_date: new Date(Date.now() + 12 * 24 * 60 * 60 * 1000).
  toISOString().
  split('T')[0],
  status: 'scheduled'
},
{
  id: 'm6',
  animal_id: 'a9',
  procedure_type: 'exam',
  procedure_name: 'Limp Evaluation',
  due_date: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).
  toISOString().
  split('T')[0],
  status: 'overdue',
  notes: 'Urgent evaluation needed for right hind leg.'
},
{
  id: 'm7',
  animal_id: 'a7',
  procedure_type: 'exam',
  procedure_name: 'Senior Bloodwork',
  performed_date: '2023-10-25',
  status: 'completed',
  provider_name: 'Bridge City Veterinary'
}];


export const seedNotes: AnimalNote[] = [
{
  id: 'n1',
  animal_id: 'a1',
  author_name: 'Volunteer Team',
  note_type: 'behavior',
  body: 'Biscuit passed his dog-to-dog assessment with flying colors today. Very playful but respects boundaries.',
  created_at: '2025-10-15T14:00:00Z'
},
{
  id: 'n2',
  animal_id: 'a2',
  author_name: 'Elena Rodriguez',
  note_type: 'foster_update',
  body: 'Marmalade is eating her soft food well. Still a bit groggy from the meds but purring constantly.',
  created_at: '2025-11-19T09:30:00Z'
},
{
  id: 'n3',
  animal_id: 'a8',
  author_name: 'Anita Patel',
  note_type: 'foster_update',
  body: 'Pepper came out from under the bed today and accepted some treats from my hand!',
  created_at: '2025-11-20T18:00:00Z'
}];


// Demo litter — members are linked via animals.litter_id (a4 Milkshake + a10
// Willow). Mother is Marmalade (a2), who gave birth in care.
export const seedLitters: Litter[] = [
{
  id: 'litter_demo',
  name: 'Columbia City - July 2025',
  species: 'Cat',
  estimated_birth_date: '2025-06-01',
  intake_date: '2025-07-13',
  intake_source: 'Trapped with mother',
  mother_animal_id: 'a2',
  notes: 'Litter trapped with mother near apartment complex in Columbia City.'
}];


// Adoptions start empty in the demo — use "Start Adoption" on an adoptable
// animal to exercise the workflow (resets on refresh, like all demo mutations).
export const seedAdoptions: Adoption[] = [];

export const seedRelationships: AnimalRelationship[] = [
// Marmalade gave birth in care — Willow is her kitten.
{
  id: 'r1',
  animal_id: 'a2',
  related_animal_id: 'a10',
  relationship_type: 'mother',
  notes: 'Litter born during intake stay.'
},
// (Willow & Milkshake littermate link is now expressed via a shared
//  litter_id on those seed animals — see seedAnimals — not a relationship row.)
// Biscuit and Duffy are a bonded pair — must be adopted together.
{
  id: 'r3',
  animal_id: 'a1',
  related_animal_id: 'a11',
  relationship_type: 'bonded_pair',
  notes: 'Adopt together — they get anxious when separated.'
}];


export const seedPhotos: AnimalPhoto[] = [
// Marmalade
{
  id: 'ph1',
  animal_id: 'a2',
  url: 'https://images.unsplash.com/photo-1513360371669-4adf3dd7dff8?auto=format&fit=crop&q=80&w=1200',
  category: 'profile',
  caption: 'Sun nap on the windowsill.',
  uploaded_at: '2023-11-06T10:00:00Z'
},
{
  id: 'ph2',
  animal_id: 'a2',
  url: 'https://images.unsplash.com/photo-1561948955-570b270e7c36?auto=format&fit=crop&q=80&w=1200',
  category: 'intake',
  caption: 'Day of intake — owner surrender.',
  uploaded_at: '2023-11-05T14:30:00Z'
},
{
  id: 'ph3',
  animal_id: 'a2',
  url: 'https://images.unsplash.com/photo-1574158622682-e40e69881006?auto=format&fit=crop&q=80&w=1200',
  category: 'medical',
  caption: 'Recovering after dental surgery — Dr. Evans.',
  uploaded_at: '2023-11-18T17:00:00Z'
},
// Biscuit
{
  id: 'ph4',
  animal_id: 'a1',
  url: 'https://images.unsplash.com/photo-1552053831-71594a27632d?auto=format&fit=crop&q=80&w=1200',
  category: 'profile',
  caption: 'Adoption-listing headshot.',
  uploaded_at: '2023-10-20T11:00:00Z'
},
{
  id: 'ph5',
  animal_id: 'a1',
  url: 'https://images.unsplash.com/photo-1587300003388-59208cc962cb?auto=format&fit=crop&q=80&w=1200',
  category: 'intake',
  caption: 'Arrival from City Shelter Transfer.',
  uploaded_at: '2023-10-01T10:00:00Z'
},
{
  id: 'ph6',
  animal_id: 'a1',
  url: 'https://images.unsplash.com/photo-1477884213360-7e9d7dcc1e48?auto=format&fit=crop&q=80&w=1200',
  category: 'foster',
  caption: 'First weekend at meet-and-greet.',
  uploaded_at: '2023-11-04T15:00:00Z'
},
// Milkshake
{
  id: 'ph7',
  animal_id: 'a4',
  url: 'https://images.unsplash.com/photo-1514888286974-6c03e2ca1dba?auto=format&fit=crop&q=80&w=1200',
  category: 'intake',
  caption: 'Pulled from a feral colony at 4 weeks.',
  uploaded_at: '2023-11-22T08:00:00Z'
},
{
  id: 'ph8',
  animal_id: 'a4',
  url: 'https://images.unsplash.com/photo-1573865526739-10659fec78a5?auto=format&fit=crop&q=80&w=1200',
  category: 'medical',
  caption: 'Started on URI antibiotics.',
  uploaded_at: '2023-11-23T09:00:00Z'
},
// Luna (already adopted — show full lifecycle)
{
  id: 'ph9',
  animal_id: 'a5',
  url: 'https://images.unsplash.com/photo-1605568420105-eb2a4caa5e3e?auto=format&fit=crop&q=80&w=1200',
  category: 'profile',
  caption: 'Adoption-ready profile shot.',
  uploaded_at: '2023-10-01T10:00:00Z'
},
{
  id: 'ph10',
  animal_id: 'a5',
  url: 'https://images.unsplash.com/photo-1568393691622-c7ba131d63b4?auto=format&fit=crop&q=80&w=1200',
  category: 'adoption',
  caption: 'Going-home day with her new family!',
  uploaded_at: '2023-10-30T14:00:00Z'
}];


// Directory contacts (vets, staff, volunteers, adopters). roles[] is injected
// below; fosters are merged in from fosterPeople.
const contactPeople: Omit<Person, 'roles'>[] = [
{
  id: 'pe1',
  first_name: 'Dr. Emily',
  last_name: 'Smith',
  email: 'esmith@bridgecityvet.com',
  phone: '(555) 101-2020',
  role: 'vet',
  organization_name: 'Bridge City Veterinary',
  active: true,
  created_at: '2025-01-10T10:00:00Z'
},
{
  id: 'pe2',
  first_name: 'Dr. Mark',
  last_name: 'Evans',
  email: 'mevans@pdxanimalhospital.com',
  phone: '(555) 202-3030',
  role: 'vet',
  organization_name: 'PDX Animal Hospital',
  active: true,
  created_at: '2025-02-15T10:00:00Z',
  photo_url:
  'https://images.unsplash.com/photo-1741455620227-3b1c51e01419?auto=format&fit=crop&q=80&w=200'
},
{
  id: 'pe3',
  first_name: 'Jessica',
  last_name: 'Wong',
  email: 'jwong@whiskervillerescue.org',
  phone: '(555) 303-4040',
  role: 'rescue_staff',
  notes: 'Executive Director',
  active: true,
  created_at: '2022-05-01T10:00:00Z',
  photo_url:
  'https://images.unsplash.com/photo-1589553009868-c7b2bb474531?auto=format&fit=crop&q=80&w=200'
},
{
  id: 'pe4',
  first_name: 'Brian',
  last_name: "O'Connor",
  email: 'boconnor@whiskervillerescue.org',
  phone: '(555) 404-5050',
  role: 'rescue_staff',
  notes: 'Intake Coordinator',
  active: true,
  created_at: '2022-08-12T10:00:00Z',
  photo_url:
  'https://images.unsplash.com/photo-1536548665027-b96d34a005ae?auto=format&fit=crop&q=80&w=200'
},
{
  id: 'pe5',
  first_name: 'Chloe',
  last_name: 'Davis',
  email: 'chloe.d@example.com',
  phone: '(555) 505-6060',
  role: 'volunteer',
  volunteer_type: 'administrative',
  active: true,
  created_at: '2025-03-20T10:00:00Z'
},
{
  id: 'pe6',
  first_name: 'Sam',
  last_name: 'Miller',
  email: 'smiller@example.com',
  phone: '(555) 606-7070',
  role: 'volunteer',
  volunteer_type: 'trapper',
  active: true,
  created_at: '2025-04-10T10:00:00Z'
},
{
  id: 'pe7',
  first_name: 'Rachel',
  last_name: 'Green',
  email: 'rgreen@example.com',
  phone: '(555) 707-8080',
  role: 'volunteer',
  volunteer_type: 'transport',
  active: true,
  created_at: '2025-05-15T10:00:00Z'
},
{
  id: 'pe8',
  first_name: 'Ian',
  last_name: 'Wright',
  email: 'iwright@example.com',
  phone: '(555) 808-9090',
  role: 'volunteer',
  volunteer_type: 'event_support',
  active: true,
  created_at: '2025-06-20T10:00:00Z'
},
{
  // The demo current-user. Matches CURRENT_USER.person_id used across forms.
  id: 'p_dan',
  first_name: 'Dan',
  last_name: 'Thoreson',
  email: 'thoreson.dan@gmail.com',
  phone: '(555) 390-2847',
  role: 'volunteer',
  volunteer_type: 'foster_parent',
  active: true,
  created_at: '2024-09-10T10:00:00Z',
  photo_url: '/images/contacts/Dan_Thoreson.jpeg'
},
{
  id: 'pe9',
  first_name: 'Zoe',
  last_name: 'Lee',
  email: 'zlee@example.com',
  phone: '(555) 909-0101',
  role: 'volunteer',
  volunteer_type: 'social_media',
  active: true,
  created_at: '2025-07-25T10:00:00Z'
},
{
  id: 'pe10',
  first_name: 'Alex',
  last_name: 'Johnson',
  email: 'ajohnson@example.com',
  phone: '(555) 010-1212',
  role: 'volunteer',
  volunteer_type: 'other',
  notes: 'Helps with laundry and cleaning.',
  active: true,
  created_at: '2025-08-30T10:00:00Z'
},
{
  id: 'pe11',
  first_name: 'Megan',
  last_name: 'Fox',
  email: 'mfox@example.com',
  phone: '(555) 121-2323',
  role: 'adopter',
  notes: 'Adopted Luna (a5)',
  active: true,
  created_at: '2025-09-15T10:00:00Z'
},
{
  id: 'pe12',
  first_name: 'Chris',
  last_name: 'Hemsworth',
  email: 'chemsworth@example.com',
  phone: '(555) 232-3434',
  role: 'adopter',
  notes: 'Looking to adopt a large dog.',
  active: true,
  created_at: '2025-10-05T10:00:00Z'
}];

// People = contacts + fosters. volunteer_type is retired — fold each legacy
// value into a specific role and drop the column. Bare 'volunteer' (no specialty)
// is kept only when there's no more-specific role.
const VOLUNTEER_TYPE_TO_ROLE: Record<string, PersonRole | undefined> = {
  administrative: 'admin',
  event_support: 'event_support',
  social_media: 'social_media',
  trapper: 'trapper',
  transport: 'transport',
  foster_parent: undefined, // fosters come from fosterPeople; avoid duplicates
  other: undefined
};
export const seedPeople: Person[] = [
...contactPeople.map((p) => {
  const roles: PersonRole[] = p.role === 'volunteer' ? [] : [p.role];
  const mapped = p.volunteer_type ?
  VOLUNTEER_TYPE_TO_ROLE[p.volunteer_type] :
  undefined;
  if (mapped && !roles.includes(mapped)) roles.push(mapped);
  if (roles.length === 0) roles.push('volunteer');
  return { ...p, roles, volunteer_type: undefined };
}),
...fosterPeople];


export const seedProducts: Product[] = [
{
  id: 'prod1',
  name: 'Kitten Formula',
  category: 'food',
  default_unit: 'can',
  active: true
},
{
  id: 'prod2',
  name: 'Wet Cat Food',
  category: 'food',
  default_unit: 'case',
  active: true
},
{
  id: 'prod3',
  name: 'Dry Cat Food',
  category: 'food',
  default_unit: 'lb',
  active: true
},
{
  id: 'prod4',
  name: 'Wet Dog Food',
  category: 'food',
  default_unit: 'case',
  active: true
},
{
  id: 'prod5',
  name: 'Dry Dog Food',
  category: 'food',
  default_unit: 'lb',
  active: true
},
{
  id: 'prod6',
  name: 'Cat Litter',
  category: 'litter',
  default_unit: 'bag',
  active: true
},
{
  id: 'prod7',
  name: 'Pee Pads',
  category: 'bedding',
  default_unit: 'pack',
  active: true
},
{
  id: 'prod8',
  name: 'Heating Pad',
  category: 'bedding',
  default_unit: 'each',
  active: true
},
{
  id: 'prod9',
  name: 'Pet Carrier',
  category: 'other',
  default_unit: 'each',
  active: true
},
{
  id: 'prod10',
  name: 'Antibiotic - Amoxicillin',
  category: 'medical',
  default_unit: 'bottle',
  active: true
}];


export const seedSupplyRequests: SupplyRequest[] = [
{
  id: 'sr1',
  requester_person_id: 'pe5', // Chloe (volunteer)
  requested_for_animal_id: 'a4', // Milkshake (critical kitten)
  status: 'submitted',
  priority: 'urgent',
  requested_date: '2023-11-23T08:00:00Z',
  needed_by_date: '2023-11-24T08:00:00Z',
  notes: 'Milkshake is out of formula and needs pee pads ASAP.',
  created_at: '2025-11-23T08:00:00Z',
  updated_at: '2025-11-23T08:00:00Z'
},
{
  id: 'sr2',
  requester_person_id: 'pe6', // Sam
  requested_for_animal_id: 'a10', // Willow
  status: 'reviewing',
  priority: 'normal',
  requested_date: '2023-11-22T10:00:00Z',
  created_at: '2025-11-22T10:00:00Z',
  updated_at: '2025-11-22T14:00:00Z'
},
{
  id: 'sr3',
  requester_person_id: 'pe7', // Rachel
  requested_for_animal_id: 'a2', // Marmalade
  status: 'approved',
  priority: 'normal',
  requested_date: '2023-11-20T09:00:00Z',
  approved_by_person_id: 'pe3', // Jessica (staff)
  notes: 'Approved soft food for post-dental recovery.',
  created_at: '2025-11-20T09:00:00Z',
  updated_at: '2025-11-21T10:00:00Z'
},
{
  id: 'sr4',
  requester_person_id: 'pe8', // Ian
  status: 'ordered',
  priority: 'normal',
  requested_date: '2023-11-18T11:00:00Z',
  approved_by_person_id: 'pe4', // Brian (staff)
  created_at: '2025-11-18T11:00:00Z',
  updated_at: '2025-11-19T09:00:00Z'
},
{
  id: 'sr5',
  requester_person_id: 'pe9', // Zoe
  requested_for_animal_id: 'a3', // Juniper
  status: 'ready_for_pickup',
  priority: 'normal',
  requested_date: '2023-11-15T14:00:00Z',
  approved_by_person_id: 'pe3',
  delivery_method: 'pickup',
  created_at: '2025-11-15T14:00:00Z',
  updated_at: '2025-11-17T10:00:00Z'
},
{
  id: 'sr6',
  requester_person_id: 'pe10', // Alex
  requested_for_animal_id: 'a12', // Clementine
  status: 'delivered',
  priority: 'normal',
  requested_date: '2023-11-10T09:00:00Z',
  approved_by_person_id: 'pe2', // Dr. Evans
  fulfilled_by_person_id: 'pe4',
  fulfilled_date: '2023-11-12T15:00:00Z',
  delivery_method: 'drop_off',
  created_at: '2025-11-10T09:00:00Z',
  updated_at: '2025-11-12T15:00:00Z'
},
{
  id: 'sr7',
  requester_person_id: 'pe5', // Chloe
  status: 'completed',
  priority: 'normal',
  requested_date: '2023-10-01T10:00:00Z',
  approved_by_person_id: 'pe3',
  fulfilled_by_person_id: 'pe3',
  fulfilled_date: '2023-10-05T10:00:00Z',
  delivery_method: 'pickup',
  created_at: '2025-10-01T10:00:00Z',
  updated_at: '2025-10-05T10:00:00Z'
}];


export const seedSupplyRequestItems: SupplyRequestItem[] = [
// sr1 (Milkshake - urgent)
{
  id: 'sri1',
  supply_request_id: 'sr1',
  product_id: 'prod1',
  quantity: 10,
  unit: 'can'
},
{
  id: 'sri2',
  supply_request_id: 'sr1',
  product_id: 'prod7',
  quantity: 2,
  unit: 'pack'
},
{
  id: 'sri3',
  supply_request_id: 'sr1',
  custom_item_name: 'Goat milk replacer',
  quantity: 1,
  unit: 'tub',
  notes: 'Specific brand if possible'
},
// sr2 (Willow)
{
  id: 'sri4',
  supply_request_id: 'sr2',
  product_id: 'prod2',
  quantity: 1,
  unit: 'case'
},
// sr3 (Marmalade)
{
  id: 'sri5',
  supply_request_id: 'sr3',
  product_id: 'prod2',
  quantity: 2,
  unit: 'case',
  notes: 'Pate style only for dental recovery'
},
// sr4 (Ian - general)
{
  id: 'sri6',
  supply_request_id: 'sr4',
  product_id: 'prod6',
  quantity: 4,
  unit: 'bag'
},
{
  id: 'sri7',
  supply_request_id: 'sr4',
  product_id: 'prod9',
  quantity: 1,
  unit: 'each'
},
// sr5 (Juniper)
{
  id: 'sri8',
  supply_request_id: 'sr5',
  product_id: 'prod5',
  quantity: 1,
  unit: 'bag'
},
// sr6 (Clementine)
{
  id: 'sri9',
  supply_request_id: 'sr6',
  product_id: 'prod2',
  quantity: 2,
  unit: 'case',
  notes: 'Renal diet specific'
},
// sr7 (Chloe - general)
{
  id: 'sri10',
  supply_request_id: 'sr7',
  product_id: 'prod7',
  quantity: 5,
  unit: 'pack'
}];

export const seedTransportRequests: TransportRequest[] = [
{
  id: 'tr1',
  type: 'animal',
  status: 'open',
  requested_by_person_id: 'pe3',
  animal_id: 'a8', // Pepper
  pickup_location: '202 Birch Rd, Portland, OR (Anita Patel)',
  dropoff_location: 'Greenwood Vet Clinic',
  requested_pickup_time: seedDateTime(1, 9, 0),
  notes: 'Needs carrier transport.',
  urgency: 'normal',
  created_at: '2026-05-17T14:00:00Z',
  updated_at: '2026-05-17T14:00:00Z'
},
{
  id: 'tr2',
  type: 'supplies',
  status: 'claimed',
  requested_by_person_id: 'pe3',
  assigned_volunteer_person_id: 'pe7', // Rachel Green
  supply_request_id: 'sr4',
  pickup_location: 'Whiskerville office storage',
  dropoff_location: '505 Walnut Dr, Portland, OR (Tom Baker)',
  requested_pickup_time: seedDateTime(2, 16, 0),
  notes: 'Drop on porch; foster will text back when they have it.',
  urgency: 'normal',
  created_at: '2026-05-16T11:00:00Z',
  updated_at: '2026-05-16T18:30:00Z'
},
{
  id: 'tr3',
  type: 'animal',
  status: 'open',
  requested_by_person_id: 'pe4',
  animal_id: 'a9', // Otis
  pickup_location: "Whiskerville intake (Brian O'Connor)",
  dropoff_location: 'Bridge City Veterinary',
  requested_pickup_time: seedDateTime(1, 11, 30),
  notes: 'Right hind leg eval; please use the larger carrier.',
  urgency: 'urgent',
  created_at: '2026-05-17T09:15:00Z',
  updated_at: '2026-05-17T09:15:00Z'
},
{
  id: 'tr4',
  type: 'animal',
  status: 'open',
  requested_by_person_id: 'pe3',
  clinic_event_id: 'ce1',
  animal_id: 'a4', // Milkshake
  pickup_location: 'Foster home (TBD)',
  dropoff_location: 'Stanton Spay/Neuter Clinic',
  requested_pickup_time: seedDateTime(4, 7, 30),
  notes: 'Clinic intake at 8am — please be early.',
  urgency: 'normal',
  created_at: '2026-05-15T13:00:00Z',
  updated_at: '2026-05-15T13:00:00Z'
},
{
  id: 'tr5',
  type: 'animal',
  status: 'completed',
  requested_by_person_id: 'pe6',
  assigned_volunteer_person_id: 'pe7',
  animal_id: 'a7', // Pip
  pickup_location: 'Columbia City trap site',
  dropoff_location: 'Anita Patel (foster)',
  requested_pickup_time: '2025-08-13T19:00:00Z',
  completed_at: '2025-08-13T20:45:00Z',
  notes: 'Trap-to-foster handoff after intake.',
  urgency: 'normal',
  created_at: '2025-08-13T17:00:00Z',
  updated_at: '2025-08-13T20:45:00Z'
}];

export const seedSittingRequests: SittingRequest[] = [
{
  id: 'sit1',
  requested_by_person_id: 'pe3',
  coverage_scope: 'all_current_placements',
  start_date: seedDateOnly(6),
  end_date: seedDateOnly(9),
  notes: 'Heading to a family wedding. Juniper is house-trained and crate-friendly.',
  medication_required: false,
  foster_provides_supplies: true,
  transport_needed: true,
  status: 'open',
  created_at: '2026-05-15T10:00:00Z',
  updated_at: '2026-05-15T10:00:00Z'
},
{
  id: 'sit2',
  requested_by_person_id: 'pe3',
  sitter_person_id: 'pe5', // Chloe
  coverage_scope: 'selected_placements',
  start_date: seedDateOnly(1),
  end_date: seedDateOnly(3),
  notes: 'Still on antibiotics — 1 pill twice daily wrapped in pill pockets.',
  medication_required: true,
  foster_provides_supplies: true,
  transport_needed: false,
  status: 'claimed',
  created_at: '2026-05-12T14:00:00Z',
  updated_at: '2026-05-13T09:30:00Z'
},
{
  id: 'sit3',
  requested_by_person_id: 'pe3',
  coverage_scope: 'selected_placements',
  start_date: seedDateOnly(22),
  end_date: seedDateOnly(26),
  notes: 'Senior cat on renal diet. Quiet home preferred. Foster will pre-portion meals.',
  medication_required: false,
  foster_provides_supplies: true,
  transport_needed: false,
  status: 'open',
  created_at: '2026-05-17T08:00:00Z',
  updated_at: '2026-05-17T08:00:00Z'
}];

// Snapshot rows: which placements each request covers. Even for
// `all_current_placements` requests, we resolve and store the IDs at
// submit time so the request reflects the original intent.
export const seedSittingRequestPlacements: SittingRequestPlacement[] = [
// sit1 — Juniper (p1)
{ id: 'srp1', sitting_request_id: 'sit1', foster_placement_id: 'p1' },
// sit2 — Marmalade (p2)
{ id: 'srp2', sitting_request_id: 'sit2', foster_placement_id: 'p2' },
// sit3 — Clementine (p6)
{ id: 'srp3', sitting_request_id: 'sit3', foster_placement_id: 'p6' }];


export const seedClinicEvents: ClinicEvent[] = [
{
  id: 'ce1',
  date_time: seedDateTime(4, 8, 0),
  location: 'Stanton Spay/Neuter Clinic — 4205 NE Stanton, Portland OR',
  veterinarian_person_id: 'pe1', // Dr. Emily Smith
  contact_person_id: 'pe4', // Brian O'Connor, intake coordinator
  slot_capacity: 8,
  transport_coordinator_person_id: 'pe7', // Rachel Green
  intake_coordinator_person_id: 'pe4',
  notes: 'Weekly TNR clinic. Drop-off 7:30–8:00am; pickup 4:00–5:00pm.',
  status: 'scheduled',
  created_at: '2026-05-09T10:00:00Z',
  updated_at: '2026-05-15T10:00:00Z'
},
{
  id: 'ce2',
  date_time: seedDateTime(18, 8, 0),
  location: 'PDX Animal Hospital — 1422 SE Powell, Portland OR',
  veterinarian_person_id: 'pe2', // Dr. Mark Evans
  contact_person_id: 'pe2',
  slot_capacity: 6,
  transport_coordinator_person_id: 'pe7',
  intake_coordinator_person_id: 'pe4',
  notes: 'Smaller batch — Dr. Evans is solo this date.',
  status: 'planning',
  created_at: '2026-05-12T10:00:00Z',
  updated_at: '2026-05-12T10:00:00Z'
},
{
  id: 'ce3',
  date_time: '2026-04-25T08:00:00Z',
  location: 'Stanton Spay/Neuter Clinic — 4205 NE Stanton, Portland OR',
  veterinarian_person_id: 'pe1',
  contact_person_id: 'pe4',
  slot_capacity: 8,
  transport_coordinator_person_id: 'pe7',
  intake_coordinator_person_id: 'pe4',
  notes: 'Standard weekly clinic.',
  status: 'completed',
  created_at: '2026-04-11T10:00:00Z',
  updated_at: '2026-04-25T17:00:00Z'
}];

export const seedClinicSlots: ClinicSlot[] = [
// ce1 — upcoming clinic
{
  id: 'cs1',
  clinic_event_id: 'ce1',
  animal_id: 'a4', // Milkshake
  reserved_by_person_id: 'pe3',
  status: 'reserved',
  notes: 'Pending URI clearance; recheck day-before.'
},
{
  id: 'cs2',
  clinic_event_id: 'ce1',
  animal_id: 'a7', // Pip
  reserved_by_person_id: 'pe3',
  status: 'confirmed'
},
{
  id: 'cs3',
  clinic_event_id: 'ce1',
  animal_id: 'a10', // Willow
  reserved_by_person_id: 'pe3',
  status: 'confirmed'
},
{
  id: 'cs4',
  clinic_event_id: 'ce1',
  animal_id: 'a9', // Otis
  reserved_by_person_id: 'pe4',
  status: 'reserved',
  notes: 'Right hind leg limp eval.'
},
// ce2 — next clinic
{
  id: 'cs5',
  clinic_event_id: 'ce2',
  animal_id: 'a6', // Hazel
  reserved_by_person_id: 'pe3',
  status: 'reserved'
},
// ce3 — past clinic
{
  id: 'cs6',
  clinic_event_id: 'ce3',
  animal_id: 'a5', // Luna
  reserved_by_person_id: 'pe3',
  status: 'completed'
}];

// Each slot's procedures (cats commonly get several per visit).
export const seedClinicSlotProcedures: ClinicSlotProcedure[] = [
// cs1 — Milkshake: full intake combo
{ id: 'csp1', clinic_slot_id: 'cs1', procedure_type: 'spay_neuter', completed: false },
{ id: 'csp2', clinic_slot_id: 'cs1', procedure_type: 'vaccines', completed: false },
{ id: 'csp3', clinic_slot_id: 'cs1', procedure_type: 'flea_treatment', completed: false },
// cs2 — Pip
{ id: 'csp4', clinic_slot_id: 'cs2', procedure_type: 'spay_neuter', completed: false },
{ id: 'csp5', clinic_slot_id: 'cs2', procedure_type: 'vaccines', completed: false },
// cs3 — Willow
{ id: 'csp6', clinic_slot_id: 'cs3', procedure_type: 'spay_neuter', completed: false },
{ id: 'csp7', clinic_slot_id: 'cs3', procedure_type: 'microchip', completed: false },
// cs4 — Otis: exam only
{ id: 'csp8', clinic_slot_id: 'cs4', procedure_type: 'exam', completed: false },
// cs5 — Hazel
{ id: 'csp9', clinic_slot_id: 'cs5', procedure_type: 'spay_neuter', completed: false },
// cs6 — Luna: past clinic, all done
{ id: 'csp10', clinic_slot_id: 'cs6', procedure_type: 'spay_neuter', completed: true },
{ id: 'csp11', clinic_slot_id: 'cs6', procedure_type: 'vaccines', completed: true },
{ id: 'csp12', clinic_slot_id: 'cs6', procedure_type: 'deworming', completed: true }];

// Open action items for the elevated-priority animals (the "next step" shown in
// the Action Needed banner), plus one completed item to show history/timeline.
export const seedActionItems: AnimalActionItem[] = [
{
  id: 'ai1',
  animal_id: 'a2', // Marmalade — needs_attention
  description:
  'Soft food only + finish 10-day antibiotic course (3 days remaining). Recheck on Nov 25.',
  priority: 'needs_attention',
  status: 'open',
  created_at: '2025-11-15T09:00:00Z'
},
{
  id: 'ai2',
  animal_id: 'a4', // critical
  description:
  'Start URI antibiotics today and find an isolated foster — cannot be housed with other kittens.',
  priority: 'critical',
  status: 'open',
  created_at: '2025-11-22T08:00:00Z'
},
{
  id: 'ai3',
  animal_id: 'a9', // urgent
  description:
  'Schedule vet eval for right hind leg limp this week and identify a medical foster home.',
  priority: 'urgent',
  status: 'open',
  created_at: '2025-11-28T10:30:00Z'
},
{
  id: 'ai4',
  animal_id: 'a12', // needs_attention
  description:
  'Review senior bloodwork results with vet and confirm renal diet plan.',
  priority: 'needs_attention',
  status: 'open',
  created_at: '2025-11-10T11:00:00Z'
},
// A completed earlier step on a2 — shows in the activity timeline as history.
{
  id: 'ai5',
  animal_id: 'a2',
  description: 'Complete intake exam and dental assessment.',
  priority: 'needs_attention',
  status: 'completed',
  created_at: '2025-11-06T09:00:00Z',
  completed_at: '2025-11-12T14:00:00Z',
  completed_by: 'demo',
  completion_note: 'Dental surgery completed; switched to soft-food recovery.'
}];