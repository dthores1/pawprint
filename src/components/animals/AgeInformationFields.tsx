import { useEffect, useState } from 'react';
import { Input, Select, Label } from '../ui/Forms';
import { DatePicker } from '../ui/DatePicker';
import { AgeUnit } from '../../types';
import { deriveAgeInfo } from '../../lib/age';
import { calculateAge } from '../../lib/utils';

// Estimated Birthdate OR Estimated Age, chosen via a radio so only one set of
// inputs shows at a time (progressive disclosure — no competing fields).
export type AgeInputMode = 'birthdate' | 'age';
interface AgeInformationFieldsProps {
  birthdate: string;
  ageValue: string;
  ageUnit: AgeUnit;
  asOfDate: string;
  onBirthdate: (v: string) => void;
  onAgeValue: (v: string) => void;
  onAgeUnit: (v: AgeUnit) => void;
  mode?: AgeInputMode;
  initialMode?: AgeInputMode;
  onModeChange?: (v: AgeInputMode) => void;
  error?: string;
}
const UNIT_OPTIONS: AgeUnit[] = ['days', 'weeks', 'months', 'years'];

export function AgeInformationFields({
  birthdate,
  ageValue,
  ageUnit,
  asOfDate,
  onBirthdate,
  onAgeValue,
  onAgeUnit,
  mode: controlledMode,
  initialMode,
  onModeChange,
  error
}: AgeInformationFieldsProps) {
  // Start on whichever the data already reflects, or let a parent control the
  // mode when it needs submit-time awareness of the visible path.
  const [internalMode, setInternalMode] = useState<AgeInputMode>(() =>
  initialMode ?? (ageValue && !birthdate ? 'age' : 'birthdate')
  );
  const mode = controlledMode ?? internalMode;

  useEffect(() => {
    if (controlledMode || !initialMode) return;
    setInternalMode(initialMode);
  }, [controlledMode, initialMode]);

  const selectMode = (next: AgeInputMode) => {
    if (!controlledMode) setInternalMode(next);
    onModeChange?.(next);
  };
  const handleBirthdate = (v: string) => {
    onBirthdate(v);
    if (v) onAgeValue('');
  };
  const handleAgeValue = (v: string) => {
    onAgeValue(v);
    if (v) onBirthdate('');
  };
  const handleAgeUnit = (v: AgeUnit) => {
    onAgeUnit(v);
    if (ageValue) onBirthdate('');
  };

  const derived = deriveAgeInfo({ birthdate, ageValue, ageUnit, asOf: asOfDate });
  const agePreview =
  mode === 'age' && derived.valid ?
  `≈ born ${new Date(
    derived.estimated_birth_date + 'T00:00:00'
  ).toLocaleDateString('en-US', {
    month: 'short',
    year: 'numeric'
  })} · current age ${calculateAge(derived.estimated_birth_date)}` :
  null;

  return (
    <div className="space-y-3">
      <p className="text-xs text-text-secondary">
        Provide a birthdate if known. Otherwise enter an estimated age.
      </p>

      {/* Radio toggle between the two input modes */}
      <div className="flex flex-wrap gap-x-5 gap-y-2">
        <label className="flex items-center gap-2 text-sm text-text-primary cursor-pointer">
          <input
            type="radio"
            name="age_mode"
            checked={mode === 'birthdate'}
            onChange={() => selectMode('birthdate')}
            className="w-4 h-4 text-primary focus:ring-primary" />

          Birthdate
        </label>
        <label className="flex items-center gap-2 text-sm text-text-primary cursor-pointer">
          <input
            type="radio"
            name="age_mode"
            checked={mode === 'age'}
            onChange={() => selectMode('age')}
            className="w-4 h-4 text-primary focus:ring-primary" />

          Estimated Age
        </label>
      </div>

      {mode === 'birthdate' ?
      <div>
          <Label htmlFor="estimated_birthdate" className="text-xs">
            Birthdate
          </Label>
          <DatePicker
          id="estimated_birthdate"
          value={birthdate}
          max={asOfDate}
          onChange={handleBirthdate} />

        </div> :

      <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="estimated_age_value" className="text-xs">
              Age
            </Label>
            <Input
            id="estimated_age_value"
            type="number"
            min="1"
            inputMode="numeric"
            placeholder="e.g. 3"
            value={ageValue}
            onChange={(e) => handleAgeValue(e.target.value)} />

          </div>
          <div>
            <Label htmlFor="estimated_age_unit" className="text-xs">
              Unit
            </Label>
            <Select
            id="estimated_age_unit"
            value={ageUnit}
            onChange={(e) => handleAgeUnit(e.target.value as AgeUnit)}>

              {UNIT_OPTIONS.map((u) =>
            <option key={u} value={u}>
                  {u}
                </option>
            )}
            </Select>
          </div>
        </div>
      }

      {agePreview &&
      <p className="text-xs text-text-secondary">{agePreview}</p>
      }
      {error && <p className="text-sm text-[#9B3A3A]">{error}</p>}
    </div>);

}
