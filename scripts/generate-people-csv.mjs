#!/usr/bin/env node
//
// generate-people-csv.mjs
//
// Generate synthetic `people` rows for stress-testing the UI.
// The CSV is handy for tools that support Postgres arrays. Supabase Studio's
// CSV importer currently drops array columns like `roles`, so this script also
// writes a .sql file that can be run in the Supabase SQL editor.
// `role` (legacy NOT NULL column) is derived from `roles[]` the same way
// `legacyRoleFor()` in src/lib/peopleApi.ts does it.
//
// Usage:
//   node scripts/generate-people-csv.mjs --org <organization-uuid> \
//     [--count 1000] [--out people.csv] [--sql-out people.sql] [--seed 42]
//
// Loading into Supabase:
//   1) Recommended: run the generated .sql file in the Supabase SQL editor.
//      This avoids Studio's CSV importer dropping array columns.
//   2) psql:
//        \copy people (id, organization_id, first_name, last_name, email, phone,
//          role, volunteer_type, organization_name, notes, photo_url, active,
//          created_at, updated_at, user_id, roles, address, max_capacity,
//          preferred_species)
//          from 'people.csv' with (format csv, header true)
//
// RLS note: importing via psql with the service-role connection bypasses
// RLS. Importing via Studio uses the signed-in session, so the org must
// be one you're a member of.

import { writeFileSync } from 'node:fs';

// — CLI ——————————————————————————————————————

function parseArgs(argv) {
  const out = {
    count: 1000,
    out: 'people.csv',
    orgId: undefined,
    seed: 42,
    sqlOut: undefined
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
    'Usage: node scripts/generate-people-csv.mjs --org <uuid> ' +
    '[--count 1000] [--out people.csv] [--sql-out people.sql] [--seed 42]'
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
const pickN = (arr, n) => {
  const copy = [...arr];
  const out = [];
  for (let i = 0; i < n && copy.length; i++) {
    const idx = Math.floor(rand() * copy.length);
    out.push(copy.splice(idx, 1)[0]);
  }
  return out;
};
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

// — Data pools ——————————————————————————————————————

const FIRST_NAMES = [
  'Alex', 'Avery', 'Bailey', 'Cameron', 'Casey', 'Charlie', 'Dakota', 'Drew',
  'Elliot', 'Emerson', 'Finley', 'Frankie', 'Hayden', 'Jamie', 'Jordan', 'Kai',
  'Kendall', 'Logan', 'Morgan', 'Parker', 'Quinn', 'Reese', 'Riley', 'River',
  'Rowan', 'Sage', 'Sawyer', 'Skyler', 'Taylor', 'Aiden', 'Liam', 'Noah',
  'Oliver', 'Elijah', 'James', 'William', 'Benjamin', 'Lucas', 'Henry',
  'Theodore', 'Jack', 'Levi', 'Mateo', 'Daniel', 'Sebastian', 'Jackson',
  'Owen', 'Samuel', 'Matthew', 'Joseph', 'David', 'Wyatt', 'John', 'Carter',
  'Luke', 'Asher', 'Grayson', 'Leo', 'Anthony', 'Isaiah', 'Andrew', 'Lincoln',
  'Olivia', 'Emma', 'Charlotte', 'Amelia', 'Sophia', 'Mia', 'Isabella', 'Ava',
  'Evelyn', 'Luna', 'Harper', 'Sofia', 'Ella', 'Mila', 'Aria', 'Scarlett',
  'Penelope', 'Layla', 'Chloe', 'Victoria', 'Madison', 'Eleanor', 'Grace',
  'Nora', 'Hazel', 'Zoey', 'Hannah', 'Lily', 'Ellie', 'Violet', 'Lucy',
  'Stella', 'Aurora', 'Natalie', 'Emilia', 'Maya', 'Aaliyah', 'Camila',
  'Priya', 'Yuki', 'Mei', 'Hiroshi', 'Diego', 'Carmen', 'Rosa', 'Khalil',
  'Aisha', 'Omar', 'Fatima', 'Jin', 'Min', 'Tariq', 'Imani', 'Kofi', 'Adaeze'
];

const LAST_NAMES = [
  'Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller',
  'Davis', 'Rodriguez', 'Martinez', 'Hernandez', 'Lopez', 'Gonzalez',
  'Wilson', 'Anderson', 'Thomas', 'Taylor', 'Moore', 'Jackson', 'Martin',
  'Lee', 'Perez', 'Thompson', 'White', 'Harris', 'Sanchez', 'Clark',
  'Ramirez', 'Lewis', 'Robinson', 'Walker', 'Young', 'Allen', 'King',
  'Wright', 'Scott', 'Torres', 'Nguyen', 'Hill', 'Flores', 'Green', 'Adams',
  'Nelson', 'Baker', 'Hall', 'Rivera', 'Campbell', 'Mitchell', 'Carter',
  'Roberts', 'Gomez', 'Phillips', 'Evans', 'Turner', 'Diaz', 'Parker',
  'Cruz', 'Edwards', 'Collins', 'Reyes', 'Stewart', 'Morris', 'Morales',
  'Murphy', 'Cook', 'Rogers', 'Gutierrez', 'Ortiz', 'Morgan', 'Cooper',
  'Peterson', 'Bailey', 'Reed', 'Kelly', 'Howard', 'Ramos', 'Kim', 'Cox',
  'Ward', 'Richardson', 'Watson', 'Brooks', 'Chavez', 'Wood', 'James',
  'Bennett', 'Gray', 'Mendoza', 'Ruiz', 'Hughes', 'Price', 'Alvarez',
  'Castillo', 'Sanders', 'Patel', 'Myers', 'Long', 'Ross', 'Foster',
  'Jimenez', 'Powell', 'Jenkins', 'Perry', 'Russell', 'Sullivan', 'Bell',
  'Coleman', 'Butler', 'Henderson', 'Barnes', 'Gonzales', 'Fisher',
  'Vasquez', 'Simmons', 'Romero', 'Jordan', 'Patterson', 'Alexander',
  'Hamilton', 'Graham', 'Reynolds', 'Griffin', 'Wallace', 'Moreno', 'West',
  'Cole', 'Hayes', 'Bryant', 'Herrera', 'Gibson', 'Ellis', 'Tran', 'Medina',
  'Aguilar', 'Stevens', 'Murray', 'Ford', 'Castro', 'Marshall', 'Owens',
  'Harrison', 'Fernandez', 'McDonald', 'Woods', 'Washington', 'Kennedy',
  'Wells', 'Vargas', 'Henry', 'Chen'
];

const STREETS = [
  'Maple St', 'Oak Ave', 'Pine St', 'Cedar Ln', 'Elm St', 'Birch Rd',
  'Spruce Way', 'Walnut Ave', 'Cherry Ln', 'Magnolia Dr', 'Sycamore St',
  'Aspen Ct', 'Willow Way', 'Hawthorne Pl', 'Madison Ave', 'Jefferson St',
  'Lincoln Blvd', 'Washington St', 'Main St', 'Park Ave', 'Lake Dr',
  'Hill St', 'Forest Rd', 'Sunset Blvd', 'Sunrise Ave', '1st Ave', '2nd Ave',
  '3rd Ave', '4th Ave', '5th Ave', '6th Ave', '7th Ave', '8th Ave',
  '10th Ave', '12th Ave', '15th Ave S', '23rd Ave S', 'Rainier Ave',
  'Beacon Ave', 'California Ave', 'Greenwood Ave', 'Aurora Ave',
  'Holman Rd', 'Roxbury St'
];

const CITIES = [
  ['Seattle', 'WA', '98101'], ['Seattle', 'WA', '98103'],
  ['Seattle', 'WA', '98115'], ['Seattle', 'WA', '98118'],
  ['Seattle', 'WA', '98122'], ['Seattle', 'WA', '98144'],
  ['Bellevue', 'WA', '98004'], ['Renton', 'WA', '98055'],
  ['Kent', 'WA', '98030'], ['Tacoma', 'WA', '98402'],
  ['Olympia', 'WA', '98501'], ['Everett', 'WA', '98201'],
  ['Bothell', 'WA', '98011'], ['Edmonds', 'WA', '98020'],
  ['Kirkland', 'WA', '98033'], ['Federal Way', 'WA', '98003'],
  ['Burien', 'WA', '98146'], ['Shoreline', 'WA', '98155']
];

const VET_CLINIC_NAMES = [
  'Cascade Veterinary Hospital', 'Northwest Animal Clinic',
  'Greenwood Veterinary', 'Rainier Animal Hospital', 'Evergreen Pet Clinic',
  'Puget Sound Veterinary', 'Madison Park Animal Hospital',
  'Ballard Animal Hospital', 'Queen Anne Vet Clinic',
  'Capitol Hill Veterinary', 'SoDo Animal Care', 'West Seattle Vet Hospital'
];

const RESCUE_ORG_NAMES = [
  'Second Chance Animal Rescue', 'Seattle Humane', 'PAWS',
  'Regional Animal Services', 'Furry Friends Foundation',
  'Second Chance Rescue', 'Hope Animal Shelter'
];

const FOSTER_NOTES = [
  'Two-story house with a fully fenced yard. Comfortable with medium-large dogs.',
  'Small apartment, prefers cats or small dogs. Quiet building.',
  'Has experience with neonatal kittens, willing to bottle-feed.',
  'Three dogs of their own; can foster compatible new dogs only.',
  'Can do medical foster — comfortable administering injections.',
  'Available weekdays, prefers short-term placements.',
  'No other pets, focused on socializing fearful animals.',
  'Family with kids 8+, great with friendly animals.',
  'Has a separate quarantine room — great for ringworm or URI cases.',
  'Available for hospice fostering when needed.',
  'New foster, completed orientation last month.',
  'Long-time volunteer, has fostered 30+ animals over 5 years.',
  'Cat-only household, multiple rooms for separation.',
  'Has a senior dog at home; cannot take high-energy puppies.'
];

const CONTACT_NOTES = [
  'Primary contact for low-cost spay/neuter clinic referrals.',
  'Volunteer drives the south route on Saturdays.',
  'Manages the org Instagram + Facebook.',
  'Helps with intake paperwork on clinic days.',
  'TNR specialist — knows the colonies in South Park.',
  'Adoption event lead.',
  'Donor relations — handles in-kind donations.',
  null, null, null // most contacts have no notes
];

const SELECTABLE_SPECIES = ['Dog', 'Cat', 'Other'];

// — Persona mix ————————————————————————————————————————

// Weighted choice of role archetype. Tuned to roughly mirror an active
// rescue org: a plurality of fosters, a long tail of support volunteers,
// a handful of vets / staff / adopters.
const PERSONA_WEIGHTS = [
  [40, 'foster'],
  [25, 'volunteer'], // trapper / transport / event_support / social_media
  [10, 'vet'],
  [10, 'rescue_staff'],
  [10, 'admin'],
  [5, 'adopter']
];

function pickPersona() {
  const total = PERSONA_WEIGHTS.reduce((s, [w]) => s + w, 0);
  let r = rand() * total;
  for (const [w, label] of PERSONA_WEIGHTS) {
    r -= w;
    if (r <= 0) return label;
  }
  return PERSONA_WEIGHTS[PERSONA_WEIGHTS.length - 1][1];
}

// Mirrors legacyRoleFor() in src/lib/peopleApi.ts: pick the first member of
// `roles` that's a valid legacy value, otherwise default to 'volunteer'.
const LEGACY_ROLES = new Set(['vet', 'rescue_staff', 'volunteer', 'adopter']);
function legacyRoleFor(roles) {
  for (const r of roles) if (LEGACY_ROLES.has(r)) return r;
  return 'volunteer';
}

function rolesForPersona(persona) {
  switch (persona) {
    case 'foster': {
      const roles = ['foster_parent'];
      if (chance(0.15)) roles.push(pick(['transport', 'trapper', 'event_support']));
      if (chance(0.05)) roles.push('vet');
      return roles;
    }
    case 'vet': {
      const roles = ['vet'];
      if (chance(0.10)) roles.push('foster_parent');
      return roles;
    }
    case 'rescue_staff': {
      const roles = ['rescue_staff'];
      if (chance(0.30)) roles.push('admin');
      return roles;
    }
    case 'volunteer': {
      const opts = ['trapper', 'transport', 'event_support', 'social_media'];
      return pickN(opts, chance(0.25) ? 2 : 1);
    }
    case 'admin':
      return ['admin'];
    case 'adopter':
      return ['adopter'];
    default:
      return ['volunteer'];
  }
}

// — Field generators ———————————————————————————————————

function makeEmail(first, last, seenEmails) {
  const local = `${first}.${last}`.toLowerCase().replace(/[^a-z.]/g, '');
  const provider = pick([
    'gmail.com', 'gmail.com', 'yahoo.com', 'outlook.com',
    'protonmail.com', 'hotmail.com', 'icloud.com'
  ]);
  let candidate = `${local}@${provider}`;
  let n = 1;
  while (seenEmails.has(candidate)) {
    candidate = `${local}${n}@${provider}`;
    n++;
  }
  seenEmails.add(candidate);
  return candidate;
}

function makePhone() {
  const area = intBetween(200, 989);
  const exch = intBetween(200, 989);
  const subs = intBetween(0, 9999).toString().padStart(4, '0');
  return `${area}-${exch}-${subs}`;
}

function makeAddress() {
  const num = intBetween(100, 9999);
  const street = pick(STREETS);
  const [city, state, zip] = pick(CITIES);
  return `${num} ${street}, ${city}, ${state} ${zip}`;
}

function makePerson(orgId, seenEmails, timestamp) {
  const persona = pickPersona();
  const roles = rolesForPersona(persona);
  const legacy = legacyRoleFor(roles);

  const first = pick(FIRST_NAMES);
  const last = pick(LAST_NAMES);
  const email = makeEmail(first, last, seenEmails);

  const isFoster = roles.includes('foster_parent');
  const isVet = roles.includes('vet');
  const isStaff = roles.includes('rescue_staff');

  return {
    id: randomUuid(),
    organization_id: orgId,
    first_name: first,
    last_name: last,
    email,
    phone: chance(0.9) ? makePhone() : null,
    role: legacy,
    volunteer_type: null,
    organization_name:
      isVet ? pick(VET_CLINIC_NAMES) :
      isStaff && chance(0.5) ? pick(RESCUE_ORG_NAMES) :
      null,
    notes: isFoster ? pick(FOSTER_NOTES) : pick(CONTACT_NOTES),
    photo_url: null,
    active: chance(0.92),
    created_at: timestamp,
    updated_at: timestamp,
    user_id: null,
    roles,
    address: isFoster ? makeAddress() : (chance(0.25) ? makeAddress() : null),
    max_capacity: isFoster ? intBetween(1, 10) : null,
    preferred_species:
      isFoster ? pickN(SELECTABLE_SPECIES, intBetween(1, 3)) : null
  };
}

// — CSV serialization ——————————————————————————————————

const COLUMNS = [
  'id', 'organization_id',
  'first_name', 'last_name', 'email', 'phone',
  'role', 'volunteer_type', 'organization_name', 'notes', 'photo_url',
  'active', 'created_at', 'updated_at', 'user_id',
  'roles', 'address', 'max_capacity', 'preferred_species'
];

function csvEscape(s) {
  // RFC 4180-ish: wrap in quotes if the value contains a quote, comma,
  // or newline; double up embedded quotes.
  if (/[",\r\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function pgArrayLiteral(arr) {
  // Postgres text[] literal: {val1,val2}. Quote elements with commas,
  // braces, whitespace, quotes, or backslashes; escape \ and " inside.
  const inner = arr.map((v) => {
    const s = String(v);
    if (s === '' || /[,{}"\\\s]/.test(s)) {
      return `"${s.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
    }
    return s;
  }).join(',');
  return `{${inner}}`;
}

function serializeValue(v) {
  if (v === null || v === undefined) return ''; // empty cell = NULL in CSV import
  if (typeof v === 'boolean') return v ? 'true' : 'false';
  if (typeof v === 'number') return String(v);
  if (Array.isArray(v)) return csvEscape(pgArrayLiteral(v));
  return csvEscape(String(v));
}

function rowToCsv(row) {
  return COLUMNS.map((c) => serializeValue(row[c])).join(',');
}

// — SQL serialization ——————————————————————————————————

function sqlString(v) {
  return `'${String(v).replace(/'/g, "''")}'`;
}

function sqlArray(arr) {
  if (!arr) return 'NULL';
  return `ARRAY[${arr.map(sqlString).join(', ')}]::text[]`;
}

function sqlValue(row, col) {
  const v = row[col];
  if (v === null || v === undefined) return 'NULL';
  if (Array.isArray(v)) return sqlArray(v);
  if (typeof v === 'boolean') return v ? 'true' : 'false';
  if (typeof v === 'number') return String(v);
  return sqlString(v);
}

function rowsToSql(rows) {
  const values = rows.map((row) => (
    `  (${COLUMNS.map((col) => sqlValue(row, col)).join(', ')})`
  ));
  return [
    '-- Generated by scripts/generate-people-csv.mjs',
    '-- Run this in the Supabase SQL editor. It uses ARRAY[...] values so',
    "-- the NOT NULL `people.roles` column is populated correctly.",
    '',
    'BEGIN;',
    '',
    `INSERT INTO public.people (${COLUMNS.join(', ')})`,
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
  const { orgId, count, out, seed, sqlOut } = parseArgs(process.argv);
  rand = makeRng(seed);

  const lines = [COLUMNS.join(',')];
  const rows = [];
  const seenEmails = new Set();
  const timestamp = new Date().toISOString();
  for (let i = 0; i < count; i++) {
    const row = makePerson(orgId, seenEmails, timestamp);
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
