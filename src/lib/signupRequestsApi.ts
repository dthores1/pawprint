import { supabase } from './supabase';

// Public "Request Beta Access" submissions → public.organization_signup_requests.
// Anonymous inserts are allowed by RLS as long as status = 'New' and the review
// columns are null (see migration 0022). We never .select() the row back: there
// is intentionally no read policy for anon, so a select would error.

export const ORGANIZATION_TYPES = [
  'Animal Rescue',
  'Shelter',
  'Foster-Based Rescue',
  'TNR Organization',
  'Other'
] as const;

// Display label → stored value. The DB check constraint stores ASCII-hyphen
// values ('1-25'), while the UI shows en-dashes ('1–25').
export const ANIMAL_COUNT_RANGES: { label: string; value: string }[] = [
  { label: '1–25', value: '1-25' },
  { label: '26–50', value: '26-50' },
  { label: '51–100', value: '51-100' },
  { label: '100+', value: '100+' }
];

export interface SignupRequestInput {
  organization_name: string;
  organization_type: string;
  city: string;
  state: string;
  website?: string;
  contact_first_name: string;
  contact_last_name: string;
  contact_email: string;
  contact_phone?: string;
  animal_count_range?: string;
  notes?: string;
}

// Trim + null-out empty optionals so we don't store empty strings.
function clean(v?: string): string | null {
  const t = v?.trim();
  return t ? t : null;
}

export async function submitSignupRequest(
  input: SignupRequestInput
): Promise<{ error: string | null }> {
  const row = {
    organization_name: input.organization_name.trim(),
    organization_type: input.organization_type,
    city: input.city.trim(),
    state: input.state.trim(),
    website: clean(input.website),
    contact_first_name: input.contact_first_name.trim(),
    contact_last_name: input.contact_last_name.trim(),
    contact_email: input.contact_email.trim(),
    contact_phone: clean(input.contact_phone),
    animal_count_range: clean(input.animal_count_range),
    notes: clean(input.notes),
    status: 'New' as const
  };

  // Primary path: persist the request. This is the source of truth.
  const { error } = await supabase
    .from('organization_signup_requests')
    .insert(row);
  if (error) return { error: error.message };

  // Best-effort: notify support@ via the edge function. If it isn't deployed or
  // fails, the row still exists in the table for staff to review — so we don't
  // surface email failures to the visitor.
  try {
    await supabase.functions.invoke('send-signup-request-email', { body: row });
  } catch (err) {
    console.warn('[signup-request] notification email failed:', err);
  }

  return { error: null };
}
