// Adoption-profile template assembly.
//
// A posting is built by substituting two kinds of placeholders in the org's
// `template_body`:
//   * AI sections      {{ai_intro}} {{ai_body}} {{ai_home_requirements}}
//   * animal variables {{animal.name}} {{animal.age}} {{animal.species}}
//                      {{animal.gender}} {{animal.breed}}
// Everything else in the body is reproduced verbatim (fixed disclaimers, fees,
// closing language are never AI-generated). Unknown placeholders are left as-is
// so a typo is visible rather than silently dropped.

import { Animal, Breed } from '../types';
import { animalDisplayName, calculateAge } from './utils';
import { animalBreedLabel } from './breedsApi';

export interface AdoptionAiSections {
  ai_intro: string;
  ai_body: string;
  ai_home_requirements: string;
}

/**
 * Starter body for a brand-new template (used when an org adds a template and
 * there's no existing one to copy). Mirrors the SQL-seeded default in
 * migration 0056; the bracketed lines prompt the org to fill in fixed text.
 */
export const DEFAULT_ADOPTION_TEMPLATE_BODY = `[Add a short fixed intro for your organization here.]

{{ai_intro}}

{{ai_body}}

What {{animal.name}} is looking for in a home:

{{ai_home_requirements}}

[Add your fixed adoption / medical statement here.]

[Add your fixed fee information here.]

[Add your fixed closing instructions here.]`;

/** The AI section placeholders a template may contain. */
export const AI_PLACEHOLDERS = [
{ token: '{{ai_intro}}', label: 'AI intro', description: 'Short opening hook' },
{ token: '{{ai_body}}', label: 'AI body', description: 'Main personality & temperament narrative' },
{
  token: '{{ai_home_requirements}}',
  label: 'AI home requirements',
  description: 'Bulleted "what they need in a home" list'
}] as
const;

/** The animal variable placeholders Whiskerville fills in automatically. */
export const ANIMAL_PLACEHOLDERS = [
{ token: '{{animal.name}}', description: 'Name (or Rescue ID)' },
{ token: '{{animal.age}}', description: 'Computed age' },
{ token: '{{animal.species}}', description: 'Species' },
{ token: '{{animal.gender}}', description: 'Sex' },
{ token: '{{animal.breed}}', description: 'Breed / type' }] as
const;

/** Build the {{animal.*}} substitution map for one animal. */
export function animalTemplateVars(
  animal: Animal,
  breeds: Breed[])
: Record<string, string> {
  return {
    name: animalDisplayName(animal),
    age: calculateAge(animal.estimated_birth_date),
    species: animal.species,
    gender: animal.sex,
    breed: animalBreedLabel(animal, breeds) || ''
  };
}

/**
 * Assemble the final posting text. `vars` is keyed by the bare variable name
 * (e.g. `name`), matching `{{animal.name}}`.
 */
export function assembleAdoptionProfile(
  templateBody: string,
  vars: Record<string, string>,
  sections: AdoptionAiSections)
: string {
  let out = templateBody;
  out = out.replace(/\{\{\s*ai_intro\s*\}\}/g, sections.ai_intro);
  out = out.replace(/\{\{\s*ai_body\s*\}\}/g, sections.ai_body);
  out = out.replace(
    /\{\{\s*ai_home_requirements\s*\}\}/g,
    sections.ai_home_requirements
  );
  out = out.replace(/\{\{\s*animal\.(\w+)\s*\}\}/g, (match, key: string) =>
  key in vars ? vars[key] : match
  );
  // Collapse the runs of blank lines that appear when a placeholder resolves to
  // empty, so the posting doesn't have large gaps.
  return out.replace(/\n{3,}/g, '\n\n').trim();
}
