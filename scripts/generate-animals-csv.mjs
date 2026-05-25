#!/usr/bin/env node
//
// generate-animals-csv.mjs
//
// Generate synthetic `animals` rows for stress-testing the UI. Mirrors
// generate-people-csv.mjs: writes both a CSV and a .sql file. Use the
// SQL file for the actual import — Supabase Studio's CSV importer drops
// columns that aren't part of the headered visible set.
//
// Usage:
//   node scripts/generate-animals-csv.mjs --org <organization-uuid> \
//     [--count 1000] [--out animals.csv] [--sql-out animals.sql] [--seed 42]
//
// Honors these schema invariants:
//   - species is Dog or Cat only (matches ENABLED_SPECIES).
//   - status / priority / sex satisfy their CHECK constraints.
//   - birthdate_source drives age-field consistency: when source !=
//     'estimated_age' the three estimated_age_* columns are NULL (matches
//     animalsApi.clearAgeFieldsIfNeeded and the DB CHECK).
//   - breed_id is only set to an ID from the breeds catalog whose species
//     matches the animal's species; otherwise we use free-text breed_text
//     or leave both null.
//   - litter_id / current_foster_id are NULL (FKs to tables we don't
//     populate here).
//   - action_needed is NULL (retired — action items live in their own
//     table now).

import { writeFileSync } from 'node:fs';

// — CLI ——————————————————————————————————————

function parseArgs(argv) {
  const out = {
    count: 1000,
    out: 'animals.csv',
    sqlOut: undefined,
    orgId: undefined,
    seed: 42
  };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    const next = argv[i + 1];
    if (a === '--org' || a === '--organization-id') { out.orgId = next; i++; }
    else if (a === '--count' || a === '-n') { out.count = Number(next); i++; }
    else if (a === '--out' || a === '-o') { out.out = next; i++; }
    else if (a === '--sql-out') { out.sqlOut = next; i++; }
    else if (a === '--seed') { out.seed = Number(next); i++; }
    else if (a === '--help' || a === '-h') { printHelp(); process.exit(0); }
    else { console.error(`Unknown arg: ${a}`); printHelp(); process.exit(1); }
  }
  if (!out.orgId) {
    console.error('Missing required --org <organization-uuid>');
    printHelp();
    process.exit(1);
  }
  if (!/^[0-9a-f-]{36}$/i.test(out.orgId)) {
    console.error(`--org doesn't look like a UUID: ${out.orgId}`);
    process.exit(1);
  }
  if (!Number.isFinite(out.count) || out.count <= 0) {
    console.error(`Invalid --count: ${out.count}`);
    process.exit(1);
  }
  return out;
}

function printHelp() {
  console.error(
    'Usage: node scripts/generate-animals-csv.mjs --org <uuid> ' +
    '[--count 1000] [--out animals.csv] [--sql-out animals.sql] [--seed 42]'
  );
}

// — Seeded RNG (mulberry32) so reruns are reproducible ——————————

function makeRng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

let rand = makeRng(42);
const pick = (arr) => arr[Math.floor(rand() * arr.length)];
const chance = (p) => rand() < p;
const intBetween = (lo, hi) => Math.floor(rand() * (hi - lo + 1)) + lo;

function randomUuid() {
  const bytes = Array.from({ length: 16 }, () => intBetween(0, 255));
  bytes[6] = (bytes[6] & 0x0f) | 0x40; // Version 4.
  bytes[8] = (bytes[8] & 0x3f) | 0x80; // RFC 4122 variant.
  const hex = bytes.map((b) => b.toString(16).padStart(2, '0'));
  return [
    hex.slice(0, 4).join(''),
    hex.slice(4, 6).join(''),
    hex.slice(6, 8).join(''),
    hex.slice(8, 10).join(''),
    hex.slice(10, 16).join('')
  ].join('-');
}

function weightedPick(weighted) {
  const total = weighted.reduce((s, [w]) => s + w, 0);
  let r = rand() * total;
  for (const [w, v] of weighted) {
    r -= w;
    if (r <= 0) return v;
  }
  return weighted[weighted.length - 1][1];
}

// — Date helpers ———————————————————————————————————————

const DAY_MS = 24 * 60 * 60 * 1000;

function isoDate(d) {
  return d.toISOString().slice(0, 10);
}

function addDays(date, days) {
  return new Date(date.getTime() + days * DAY_MS);
}

// — Reference data ———————————————————————————————————

// Breeds catalog (from production). Only used to assign a real FK id; matched
// to an animal by species so the CHECK on breeds doesn't matter — what matters
// is that the UI shows the right breed for the species.
const BREEDS = {
  Cat: [
    ['fa9f0a12-5eae-4925-91d9-a9581a53081b', 'Bengal'],
    ['b595ff92-a9a4-40d7-bdef-66848b4d156f', 'British Shorthair'],
    ['d0e140ca-0809-47f2-811b-071f6315f1cd', 'Domestic Longhair'],
    ['cc2503c9-4628-4f9e-a24e-cc61dc164e86', 'Domestic Medium Hair'],
    ['12f385f0-f160-4262-86ea-e7287e18cf5c', 'Domestic Shorthair'],
    ['85c832c2-86c3-4414-8f3e-d9fac115b6a8', 'Maine Coon'],
    ['1ffdbfbd-432f-4597-9883-7339337b1e8c', 'Mixed Breed'],
    ['8c137ad9-abed-4b8a-8c57-87434cc9dcf9', 'Norwegian Forest Cat'],
    ['677c1b27-f593-4a96-b3b9-90cdad659f6c', 'Persian'],
    ['3e51b819-8acd-4187-a451-a92529406ed3', 'Ragdoll'],
    ['3b26ab84-0278-4d2d-b794-14d923918f58', 'Russian Blue'],
    ['fb89cfd0-a8dc-47fd-917a-c3832fbec123', 'Scottish Fold'],
    ['fbd65595-09f4-41fc-a6bf-1b9e14ee51da', 'Siamese'],
    ['17399b44-8cad-4370-8ad0-497ffdeea46d', 'Sphynx'],
    ['26de76c1-1d54-4aa2-abff-c7b5f4d81c48', 'Unknown']
  ],
  Dog: [
    ['b81c8483-9a5a-4c66-9d5f-30e2859c6d0f', 'American Staffordshire Terrier'],
    ['bd04ec12-166b-4c67-8f25-d03939f28536', 'Australian Shepherd'],
    ['0cbbd57c-cdd9-4a05-9c33-663c89b9ed6b', 'Beagle'],
    ['15b9503b-76db-4f80-99ee-1f55d5e7360e', 'Border Collie'],
    ['f199f3ac-4b2d-4240-9f96-3b147a99c8fb', 'Boston Terrier'],
    ['a52e8d30-b090-4dfa-be76-ac369e09c235', 'Boxer'],
    ['bf55e6ef-a6e6-4c1c-8407-4efe43276ef9', 'Bulldog'],
    ['8e08a356-5074-439a-bc2a-2047a8eea93c', 'Chihuahua'],
    ['a6daae22-1b55-4821-b192-9937831cf031', 'Chihuahua Mix'],
    ['0a6c67f6-58b4-4e61-9c35-ffd62860b990', 'Cocker Spaniel'],
    ['2961f43f-228a-4ef6-bc34-41a1df6cf11a', 'Corgi'],
    ['609b77a2-9076-45c3-9f8d-7c583e8f0513', 'Dachshund'],
    ['c075056d-654c-4e30-9cd3-bc399968d98a', 'Doberman Pinscher'],
    ['1da934a3-9d57-4e7e-8ac0-15b1ea3e1ead', 'French Bulldog'],
    ['bf4cd657-45c3-4266-93c9-2f9c294fce60', 'German Shepherd'],
    ['4fc402b9-3069-4cb4-81db-61ea13053837', 'German Shepherd Mix'],
    ['4c6f8b58-5a6f-4942-8b22-27a561950d75', 'Golden Retriever'],
    ['d01b4b32-7f88-44e1-8403-49d4bc5869b5', 'Golden Retriever Mix'],
    ['f6647518-aefa-4f3e-b6e8-1fe3e3020f47', 'Great Pyrenees'],
    ['22cc9792-2cfa-4766-be30-1c09ade6cf8a', 'Husky'],
    ['cd1afe21-dc9f-425b-a9c6-aa1c3e30b97d', 'Husky Mix'],
    ['0c1b99bf-76d9-4b36-8a35-8b25ccc86c14', 'Jack Russell Terrier'],
    ['237eea3c-c3bc-41b3-b0a5-83427b75fdfb', 'Labrador Mix'],
    ['79ad0cef-f114-4b98-b242-fe5373db4d1a', 'Labrador Retriever'],
    ['b8915f62-5752-4054-9fc2-260c4955157c', 'Mastiff'],
    ['433cb5e7-90d9-4c47-972c-57f15e8b0b95', 'Miniature Poodle'],
    ['c5f104ae-13e8-4864-8a9a-791f7eddcddd', 'Mixed Breed'],
    ['f9156c43-5d1f-4a4b-9a4e-aa1c76bd5ec9', 'Pit Bull'],
    ['b444bf73-5259-40e2-adf4-dd0a587845e1', 'Pit Bull Mix'],
    ['10562a10-19e7-45be-a63d-a2027118cbfd', 'Pomeranian'],
    ['001ba4b4-af20-4d4b-88b4-cc09adb0d54f', 'Poodle'],
    ['400b7bb6-1f7b-4234-8d8c-1ce1ec9b78d1', 'Rottweiler'],
    ['1d715535-f9cd-45e3-96e4-68cf76c62039', 'Shih Tzu'],
    ['ffaa2d98-44a5-45ed-97e2-5022a998603a', 'Staffordshire Bull Terrier'],
    ['db86331e-3e85-408b-acda-1bf8ab3cb31f', 'Standard Poodle'],
    ['c824de25-254a-4f30-851a-0cd80c5308c3', 'Unknown'],
    ['3d80f4c9-8bb5-4de3-a4bf-671236105f38', 'Yorkshire Terrier']
  ]
};

// Animal names — a single pool works fine; many names cross species.
const NAMES = [
  'Luna', 'Bella', 'Lucy', 'Daisy', 'Charlie', 'Cooper', 'Buddy', 'Max',
  'Milo', 'Rocky', 'Buster', 'Bear', 'Duke', 'Tucker', 'Jack', 'Toby',
  'Sadie', 'Molly', 'Maggie', 'Stella', 'Sophie', 'Chloe', 'Lola', 'Zoe',
  'Penny', 'Ruby', 'Rosie', 'Pepper', 'Ginger', 'Honey', 'Hazel', 'Olive',
  'Willow', 'Mia', 'Nala', 'Coco', 'Cleo', 'Lily', 'Layla', 'Roxy',
  'Simba', 'Tigger', 'Felix', 'Oscar', 'Whiskers', 'Mittens', 'Smokey',
  'Shadow', 'Salem', 'Boots', 'Tom', 'Jerry', 'Pumpkin', 'Patches',
  'Oreo', 'Cookie', 'Sprinkles', 'Marshmallow', 'Biscuit', 'Cupcake',
  'Beans', 'Tater', 'Peanut', 'Cashew', 'Pickle', 'Olive', 'Mango',
  'Peach', 'Plum', 'Cherry', 'Berry', 'Apple', 'Pip', 'Pippa', 'Pipper',
  'Bubba', 'Boomer', 'Bandit', 'Boots', 'Sir Reginald', 'Lady Marmalade',
  'Captain', 'Major', 'Sergeant', 'Scout', 'Ranger', 'Hunter', 'Tracker',
  'Echo', 'Juno', 'Atlas', 'Apollo', 'Athena', 'Hera', 'Hermes', 'Loki',
  'Thor', 'Odin', 'Freya', 'Zeus', 'Ares', 'Mars', 'Venus', 'Saturn',
  'Pluto', 'Neptune', 'Comet', 'Star', 'Sky', 'Storm', 'Cloud', 'Rain',
  'Snow', 'Frost', 'Misty', 'Foggy', 'Sunny', 'Stormy', 'Breezy', 'Windy',
  'Marabel', 'Simon', 'Agnes', 'Dumpling', 'Pances', 'Bluto', 'Pogo',
  'Duffy', 'Bubbles', 'Squish', 'Squirt', 'Squiggle', 'Wiggles', 'Noodle',
  'Doodle', 'Poppy', 'Daffodil', 'Iris', 'Violet', 'Lavender', 'Sage',
  'Basil', 'Parsley', 'Pepper', 'Mustard', 'Ketchup', 'Mayo', 'Pickle',
  'Relish', 'Dijon', 'Sriracha', 'Wasabi', 'Truffle', 'Caviar', 'Brie',
  'Cheddar', 'Gouda', 'Feta', 'Mozzarella', 'Parmesan', 'Ricotta',
  'Espresso', 'Mocha', 'Latte', 'Cappuccino', 'Americano', 'Whiskey',
  'Brandy', 'Sherry', 'Bourbon', 'Tequila', 'Margarita', 'Martini'
];

// Free-text intake sources. Mix of generic + named partner orgs (matches
// the user's existing data: "Surrender", "Trapped", "Saving Grace", …).
const INTAKE_SOURCES = [
  'Trapped', 'Trapped', 'Trapped', 'Owner surrender', 'Owner surrender',
  'Stray', 'Stray', 'Stray', 'Transfer', 'Saving Grace', 'Surrender',
  'Animal Control', 'Found - good Samaritan', 'Returned adoption',
  'Bottle baby (orphan)', 'TNR clinic intake', null
];

const DOG_DESCRIPTIONS = [
  'Sweet and goofy, loves belly rubs.',
  'High-energy, would do best with an active family.',
  'Shy at first, warms up quickly with patience.',
  'Bonded pair — needs to be adopted with a sibling.',
  'House-trained, crate-trained, knows basic commands.',
  'Senior — looking for a calm retirement home.',
  'Heartworm positive — undergoing treatment.',
  'Great with kids and other dogs.',
  'Anxious in new environments; thrives on routine.',
  'Loves car rides and morning walks.',
  'Recovering from leg injury, will need follow-up vet care.',
  'Selective with other dogs; would do best as the only pet.',
  'Very food-motivated, easy to train.',
  'Loud chewer of toys. Otherwise impeccable manners.',
  ''
];

const CAT_DESCRIPTIONS = [
  'Tabby, very affectionate once trust is earned.',
  'Black, friendly and playful.',
  'Tortie with classic tortitude.',
  'Calico, talkative and curious.',
  'Orange tabby, loves laps and naps.',
  'Solid black with green eyes.',
  'Tuxedo, dignified and reserved.',
  'Bonded pair — needs to be adopted together.',
  'FIV+ — indoor-only home required.',
  'Recovering from URI, almost ready for foster.',
  'Feral when trapped, slowly socializing in foster.',
  'Loves other cats; would do best in a multi-cat home.',
  'Senior cat looking for a quiet home.',
  'Bottle baby — needs an experienced foster.',
  ''
];

// Notes: half-formed shelter notes, mostly empty in real data.
const INTERNAL_NOTES = [
  'Watch food intake — tends to overeat.',
  'Skittish around tall men; pair with a calm female adopter.',
  'Microchip pending — schedule at next clinic.',
  'History of skin allergies; document any flare-ups.',
  'Litter buddy ID: see related animals.',
  'Vaccines on file from previous shelter.',
  '',
  '',
  '',
  '',
  ''
];

// — Distributions ———————————————————————————————————

// Org-wide species mix. Tilted toward cats to match the README's TNR
// emphasis; tune via SPECIES_WEIGHTS.
const SPECIES_WEIGHTS = [
  [55, 'Cat'],
  [45, 'Dog']
];

const STATUS_WEIGHTS = [
  [22, 'intake'],
  [12, 'medical'],
  [8, 'hold'],
  [28, 'fostered'],
  [15, 'adoptable'],
  [12, 'adopted'],
  [2, 'hospice'],
  [1, 'deceased']
];

const PRIORITY_WEIGHTS = [
  [70, 'normal'],
  [15, 'needs_attention'],
  [10, 'urgent'],
  [5, 'critical']
];

// Birthdate-source mix. 'estimated_age' is the most common path because
// the Add Animal form defaults to age-in-units for most intakes.
const BIRTHDATE_SOURCE_WEIGHTS = [
  [70, 'estimated_age'],
  [25, 'estimated_birthdate'],
  [5, 'exact_birthdate']
];

const AGE_UNIT_WEIGHTS = [
  [10, 'days'],
  [20, 'weeks'],
  [30, 'months'],
  [40, 'years']
];

function randomAgeForUnit(unit) {
  switch (unit) {
    case 'days': return intBetween(1, 27);
    case 'weeks': return intBetween(1, 12);
    case 'months': return intBetween(2, 24);
    case 'years': return intBetween(1, 16);
    default: return intBetween(1, 5);
  }
}

function unitToDays(unit, value) {
  switch (unit) {
    case 'days': return value;
    case 'weeks': return value * 7;
    case 'months': return value * 30;
    case 'years': return value * 365;
    default: return value * 30;
  }
}

function pickSex(species) {
  // Trapped/feral cats often come in with unknown sex; dogs usually known.
  if (species === 'Cat') return weightedPick([[40, 'Male'], [40, 'Female'], [20, 'Unknown']]);
  return weightedPick([[48, 'Male'], [48, 'Female'], [4, 'Unknown']]);
}

function pickBreedForSpecies(species) {
  // ~70% real breed_id, ~12% free-text breed, ~18% no breed info.
  const r = rand();
  if (r < 0.70) {
    const [id, name] = pick(BREEDS[species]);
    return { breed_id: id, breed_text: null, is_mixed_breed: name.includes('Mix') };
  }
  if (r < 0.82) {
    const text = species === 'Cat'
      ? pick(['Domestic Shorthair mix', 'Tabby mix', 'Tortie', 'DSH', 'DLH'])
      : pick(['Pit mix', 'Lab mix', 'Hound mix', 'Shepherd mix', 'Terrier mix', 'Heeler mix']);
    return { breed_id: null, breed_text: text, is_mixed_breed: true };
  }
  return { breed_id: null, breed_text: null, is_mixed_breed: false };
}

function pickMicrochip() {
  if (chance(0.30)) {
    // 15-digit ISO-style microchips: "9851 23456789012" without spaces.
    const head = String(intBetween(900, 999));
    const tail = String(intBetween(0, 999999999999)).padStart(12, '0');
    return head + tail;
  }
  return null;
}

// — Animal generator ——————————————————————————————————

function makeAnimal(orgId, now) {
  const species = weightedPick(SPECIES_WEIGHTS);
  const sex = pickSex(species);
  const name = pick(NAMES);
  const status = weightedPick(STATUS_WEIGHTS);
  const priority = weightedPick(PRIORITY_WEIGHTS);
  const source = weightedPick(BIRTHDATE_SOURCE_WEIGHTS);
  const breed = pickBreedForSpecies(species);

  // Intake: anywhere from 18 months ago to today.
  const intakeOffsetDays = intBetween(0, 540);
  const intakeDate = addDays(now, -intakeOffsetDays);

  // Birthdate consistency.
  let estimatedBirthDate;
  let ageValue = null;
  let ageUnit = null;
  let ageAsOf = null;
  if (source === 'estimated_age') {
    ageUnit = weightedPick(AGE_UNIT_WEIGHTS);
    ageValue = randomAgeForUnit(ageUnit);
    // Age is anchored to intake date (matches the sample data).
    ageAsOf = isoDate(intakeDate);
    estimatedBirthDate = isoDate(addDays(intakeDate, -unitToDays(ageUnit, ageValue)));
  } else {
    // estimated_birthdate or exact_birthdate: birth date is direct.
    // Pick a birthday between 16 years ago and ~3 weeks before intake so
    // we don't end up with negative ages for "born after intake".
    const maxDaysBeforeIntake = Math.min(16 * 365, intakeOffsetDays + 365 * 16);
    const minDaysBeforeIntake = 21;
    const daysBeforeIntake = intBetween(minDaysBeforeIntake, maxDaysBeforeIntake);
    estimatedBirthDate = isoDate(addDays(intakeDate, -daysBeforeIntake));
  }

  // created_at = intake date + small jitter; updated_at = created_at or
  // later (within a few weeks). Both as timestamptz ISO strings.
  const createdAt = new Date(intakeDate.getTime() + intBetween(0, 8) * 60 * 60 * 1000);
  const updatedAt = new Date(
    createdAt.getTime() + intBetween(0, 21) * DAY_MS + intBetween(0, 86400) * 1000
  );

  const description = species === 'Dog' ? pick(DOG_DESCRIPTIONS) : pick(CAT_DESCRIPTIONS);
  const internalNotes = chance(0.25) ? pick(INTERNAL_NOTES) : null;

  return {
    id: randomUuid(),
    organization_id: orgId,
    name,
    species,
    sex,
    estimated_birth_date: estimatedBirthDate,
    intake_date: isoDate(intakeDate),
    intake_source: pick(INTAKE_SOURCES),
    status,
    priority,
    action_needed: null,
    description: description || '',
    microchip_number: pickMicrochip(),
    primary_photo_url: null,
    adoption_profile_url: status === 'adoptable' && chance(0.4)
      ? `https://www.petfinder.com/cat/${name.toLowerCase()}-${intBetween(10000, 99999)}/`
      : null,
    internal_notes: internalNotes,
    current_foster_id: null,
    birthdate_source: source,
    estimated_age_value: ageValue,
    estimated_age_unit: ageUnit,
    estimated_age_as_of: ageAsOf,
    breed_id: breed.breed_id,
    breed_text: breed.breed_text,
    is_mixed_breed: breed.is_mixed_breed,
    litter_id: null,
    created_at: createdAt.toISOString(),
    updated_at: updatedAt.toISOString()
  };
}

// — Serialization ————————————————————————————————————

// Physical column order of the `animals` table (matches the user's sample
// output). Keeping CSV columns in this order helps Studio's CSV importer
// even though we recommend the SQL path.
const COLUMNS = [
  'id', 'organization_id',
  'name', 'species', 'sex',
  'estimated_birth_date', 'intake_date', 'intake_source',
  'status', 'priority',
  'action_needed', 'description',
  'microchip_number', 'primary_photo_url', 'adoption_profile_url',
  'internal_notes', 'current_foster_id',
  'created_at', 'updated_at',
  'birthdate_source', 'estimated_age_value', 'estimated_age_unit',
  'estimated_age_as_of',
  'breed_id', 'breed_text', 'is_mixed_breed', 'litter_id'
];

function csvEscape(s) {
  if (/[",\r\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function serializeCsvValue(v) {
  if (v === null || v === undefined) return '';
  if (typeof v === 'boolean') return v ? 'true' : 'false';
  if (typeof v === 'number') return String(v);
  return csvEscape(String(v));
}

function rowToCsv(row) {
  return COLUMNS.map((c) => serializeCsvValue(row[c])).join(',');
}

function sqlString(v) {
  return `'${String(v).replace(/'/g, "''")}'`;
}

function sqlValue(row, col) {
  const v = row[col];
  if (v === null || v === undefined) return 'NULL';
  if (typeof v === 'boolean') return v ? 'true' : 'false';
  if (typeof v === 'number') return String(v);
  return sqlString(v);
}

function rowsToSql(rows) {
  const values = rows.map(
    (row) => `  (${COLUMNS.map((col) => sqlValue(row, col)).join(', ')})`
  );
  return [
    '-- Generated by scripts/generate-animals-csv.mjs',
    '-- Run this in the Supabase SQL editor. Uses explicit values so the',
    '-- importer does not silently drop columns or trip the birthdate_source',
    '-- CHECK constraint.',
    '',
    'BEGIN;',
    '',
    `INSERT INTO public.animals (${COLUMNS.join(', ')})`,
    'VALUES',
    values.join(',\n'),
    'ON CONFLICT (id) DO NOTHING;',
    '',
    'COMMIT;',
    ''
  ].join('\n');
}

// — Main ——————————————————————————————————————————————

function main() {
  const { orgId, count, out, sqlOut, seed } = parseArgs(process.argv);
  rand = makeRng(seed);

  const lines = [COLUMNS.join(',')];
  const rows = [];
  const now = new Date();
  for (let i = 0; i < count; i++) {
    const row = makeAnimal(orgId, now);
    rows.push(row);
    lines.push(rowToCsv(row));
  }

  writeFileSync(out, lines.join('\n') + '\n');
  console.log(`Wrote ${count} rows to ${out}`);

  const resolvedSqlOut = sqlOut ?? out.replace(/\.csv$/i, '') + '.sql';
  writeFileSync(resolvedSqlOut, rowsToSql(rows));
  console.log(`Wrote ${count} SQL insert rows to ${resolvedSqlOut}`);
}

main();
