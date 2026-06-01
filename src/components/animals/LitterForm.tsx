import React, { useState } from 'react';
import { PlusIcon, XIcon } from 'lucide-react';
import { FieldError, Input, Select, Textarea, Label } from '../ui/Forms';
import { DatePicker } from '../ui/DatePicker';
import { Button } from '../ui/Button';
import { FormSection } from '../ui/FormSection';
import { AgeInformationFields, AgeInputMode } from './AgeInformationFields';
import { BreedCombobox } from './BreedCombobox';
import { useWhisker } from '../../context/WhiskerContext';
import { Species, Sex, AgeUnit } from '../../types';
import { deriveAgeInfo } from '../../lib/age';

interface LitterFormProps {
  onClose: () => void;
}

interface MemberRow {
  name: string;
  sex: Sex;
  description: string;
}

const today = () => new Date().toISOString().split('T')[0];

// Species → the friendly noun used for the per-member add button and the
// auto-generated placeholder names ("Puppy 1", "Kitten 2", …).
function memberNoun(species: Species): string {
  if (species === 'Dog') return 'Puppy';
  if (species === 'Cat') return 'Kitten';
  return 'Animal';
}

const newMember = (): MemberRow => ({
  name: '',
  sex: 'Unknown',
  description: ''
});

export function LitterForm({ onClose }: LitterFormProps) {
  const { addLitter } = useWhisker();
  // Shared, litter-wide fields.
  const [litterName, setLitterName] = useState('');
  const [species, setSpecies] = useState<Species>('Dog');
  const [breedId, setBreedId] = useState<string | undefined>(undefined);
  const [breedText, setBreedText] = useState<string | undefined>(undefined);
  const [birthdate, setBirthdate] = useState('');
  const [ageValue, setAgeValue] = useState('');
  const [ageUnit, setAgeUnit] = useState<AgeUnit>('weeks');
  const [ageMode, setAgeMode] = useState<AgeInputMode>('birthdate');
  const [intakeDate, setIntakeDate] = useState(today());
  const [intakeSource, setIntakeSource] = useState('');
  const [notes, setNotes] = useState('');
  // Litters start with two members; a litter of one would just be Add Animal.
  const [members, setMembers] = useState<MemberRow[]>([
  newMember(),
  newMember()]
  );
  const [errors, setErrors] = useState<{
    birthdate?: string;
    intake_date?: string;
    intake_source?: string;
  }>({});
  const [submitting, setSubmitting] = useState(false);

  const asOf = intakeDate || today();
  const noun = memberNoun(species);

  const updateMember = (index: number, patch: Partial<MemberRow>) => {
    setMembers((prev) =>
    prev.map((m, i) => i === index ? { ...m, ...patch } : m)
    );
  };
  const addMember = () => setMembers((prev) => [...prev, newMember()]);
  const removeMember = (index: number) =>
  setMembers((prev) => prev.filter((_, i) => i !== index));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const ageInfo = deriveAgeInfo({
      birthdate: ageMode === 'birthdate' ? birthdate : '',
      ageValue: ageMode === 'age' ? ageValue : '',
      ageUnit,
      asOf
    });
    const nextErrors: typeof errors = {};
    if (!ageInfo.valid) {
      nextErrors.birthdate = 'Enter a birthdate or an estimated age.';
    }
    if (!intakeDate) nextErrors.intake_date = 'Intake date is required.';
    if (!intakeSource.trim()) {
      nextErrors.intake_source = 'Intake source is required.';
    }
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    setSubmitting(true);
    await addLitter(
      {
        name: litterName.trim() || undefined,
        species,
        breed_id: breedId,
        breed_text: breedText,
        estimated_birth_date: ageInfo.estimated_birth_date,
        intake_date: intakeDate,
        intake_source: intakeSource.trim() || undefined,
        notes: notes.trim() || undefined,
        birthdate_source: ageInfo.birthdate_source,
        estimated_age_value: ageInfo.estimated_age_value,
        estimated_age_unit: ageInfo.estimated_age_unit,
        estimated_age_as_of: ageInfo.estimated_age_as_of
      },
      // Blank names get an auto temporary name based on position + species.
      members.map((m, i) => ({
        name: m.name.trim() || `${noun} ${i + 1}`,
        sex: m.sex,
        description: m.description.trim() || undefined
      }))
    );
    onClose();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4" noValidate>
      {/* — Shared Information — */}
      <FormSection title="Shared Information">
        <p className="text-xs text-text-secondary">
          These apply to every member of the litter.
        </p>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="litter_species" required>Species</Label>
            <Select
              id="litter_species"
              value={species}
              onChange={(e) => {
                setSpecies(e.target.value as Species);
                // Breeds are species-specific; reset so they can't mismatch.
                setBreedId(undefined);
                setBreedText(undefined);
              }}>

              <option value="Dog">Dog</option>
              <option value="Cat">Cat</option>
              <option value="Other">Other</option>
            </Select>
          </div>
          <div>
            <Label htmlFor="litter_breed">Breed</Label>
            <BreedCombobox
              id="litter_breed"
              species={species}
              breedId={breedId}
              breedText={breedText}
              onChange={(next) => {
                setBreedId(next.breed_id);
                setBreedText(next.breed_text);
              }} />

          </div>
        </div>

        <AgeInformationFields
          birthdate={birthdate}
          ageValue={ageValue}
          ageUnit={ageUnit}
          asOfDate={asOf}
          mode={ageMode}
          onModeChange={setAgeMode}
          onBirthdate={(v) => {
            setBirthdate(v);
            setErrors((p) => ({ ...p, birthdate: undefined }));
          }}
          onAgeValue={(v) => {
            setAgeValue(v);
            setErrors((p) => ({ ...p, birthdate: undefined }));
          }}
          onAgeUnit={setAgeUnit}
          error={errors.birthdate} />

        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="litter_intake_date" required>Intake Date</Label>
            <DatePicker
              id="litter_intake_date"
              required
              error={Boolean(errors.intake_date)}
              value={intakeDate}
              onChange={(v) => {
                setIntakeDate(v);
                setErrors((p) => ({ ...p, intake_date: undefined }));
              }} />
            <FieldError>{errors.intake_date}</FieldError>
          </div>
          <div>
            <Label htmlFor="litter_intake_source" required>Intake Source</Label>
            <Input
              id="litter_intake_source"
              aria-invalid={Boolean(errors.intake_source)}
              className={
              errors.intake_source && 'border-red-500 focus:ring-red-500'
              }
              value={intakeSource}
              onChange={(e) => {
                setIntakeSource(e.target.value);
                setErrors((p) => ({ ...p, intake_source: undefined }));
              }}
              placeholder="e.g. Surrendered with mother" />
            <FieldError>{errors.intake_source}</FieldError>
          </div>
        </div>

        <div>
          <Label htmlFor="litter_name">Litter Name (optional)</Label>
          <Input
            id="litter_name"
            value={litterName}
            onChange={(e) => setLitterName(e.target.value)}
            placeholder="e.g. The Cookie Litter" />
        </div>

        <div>
          <Label htmlFor="litter_notes">Litter Notes (optional)</Label>
          <Textarea
            id="litter_notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Anything that applies to the whole litter…" />
        </div>
      </FormSection>

      {/* — Litter Members — */}
      <FormSection title={`Litter Members (${members.length})`}>
        <p className="text-xs text-text-secondary">
          Enter what differs per animal. Blank names get a temporary name like{' '}
          <span className="font-medium">{noun} 1</span>.
        </p>
        <div className="space-y-3">
          {members.map((m, i) =>
          <div
            key={i}
            className="rounded-lg border border-border bg-card p-3 space-y-2">

              <div className="flex items-center gap-2">
                <span className="shrink-0 w-6 h-6 rounded-full bg-background text-xs font-semibold text-text-secondary flex items-center justify-center">
                  {i + 1}
                </span>
                <Input
                aria-label={`${noun} ${i + 1} name`}
                placeholder={`${noun} name (optional)`}
                value={m.name}
                onChange={(e) => updateMember(i, { name: e.target.value })}
                className="flex-1" />

                {members.length > 1 &&
              <button
                type="button"
                onClick={() => removeMember(i)}
                aria-label={`Remove ${noun} ${i + 1}`}
                className="shrink-0 p-1.5 rounded-md text-text-secondary hover:text-[#9B3A3A] hover:bg-[#F5D7D7]/60 transition-colors">

                    <XIcon className="w-4 h-4" />
                  </button>
              }
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Select
                aria-label={`${noun} ${i + 1} sex`}
                value={m.sex}
                onChange={(e) =>
                updateMember(i, { sex: e.target.value as Sex })
                }>

                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                  <option value="Unknown">Unknown</option>
                </Select>
                <Input
                aria-label={`${noun} ${i + 1} markings or notes`}
                placeholder="Markings / notes"
                value={m.description}
                onChange={(e) =>
                updateMember(i, { description: e.target.value })
                } />

              </div>
            </div>
          )}
        </div>
        <button
          type="button"
          onClick={addMember}
          className="flex items-center gap-1.5 text-sm font-medium text-primary hover:underline">

          <PlusIcon className="w-4 h-4" />
          Add another {noun.toLowerCase()}
        </button>
      </FormSection>

      <p className="text-xs text-text-secondary">
        Litter members start as <span className="font-medium">Intake</span> /{' '}
        <span className="font-medium">Normal</span> priority and are linked as
        littermates. Use <span className="font-medium">Edit</span> on each
        profile to refine later.
      </p>

      <div className="pt-4 flex justify-end gap-3 border-t border-border">
        <Button type="button" variant="ghost" onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit" disabled={submitting}>
          {submitting ? 'Adding…' : `Add Litter (${members.length})`}
        </Button>
      </div>
    </form>);

}
