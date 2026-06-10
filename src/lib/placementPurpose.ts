import { PlacementPurpose } from '../types';

// Why an animal is staying with a foster. 'general_foster' is the open-ended
// default; the others are inherently time-boxed (the modal shows an Expected End
// Date for them). Distinct from the legacy `placement_type` column.
export const PLACEMENT_PURPOSE_OPTIONS: {
  value: PlacementPurpose;
  label: string;
}[] = [
{ value: 'general_foster', label: 'General Foster' },
{ value: 'temporary_holding', label: 'Temporary Holding' },
{ value: 'medical_recovery', label: 'Medical Recovery' },
{ value: 'behavioral_observation', label: 'Behavioral Observation' },
{ value: 'transport_staging', label: 'Transport Staging' }];


export const PLACEMENT_PURPOSE_LABELS: Record<PlacementPurpose, string> =
Object.fromEntries(
  PLACEMENT_PURPOSE_OPTIONS.map((o) => [o.value, o.label])
) as Record<PlacementPurpose, string>;
