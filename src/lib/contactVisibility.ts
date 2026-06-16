import { Person } from '../types';

export type ContactField = 'phone' | 'email' | 'address';

/**
 * Whether the current viewer may see (and therefore edit) a person's contact
 * field. Admins/owners always can; a signed-in user always can on their own
 * record; otherwise it depends on the record's opt-in share flag. This mirrors
 * the server-side `people_masked` view — the view is the source of truth (it
 * nulls hidden fields), this helper just gates UI affordances (e.g. so an Edit
 * form doesn't blank a hidden value it never received).
 */
export function canViewContactField(
person: Pick<Person, 'user_id' | 'share_phone' | 'share_email' | 'share_address'>,
field: ContactField,
isAdmin: boolean,
currentUserId: string | null | undefined)
: boolean {
  if (isAdmin) return true;
  if (currentUserId && person.user_id === currentUserId) return true;
  if (field === 'phone') return person.share_phone !== false;
  if (field === 'email') return person.share_email !== false;
  return person.share_address === true;
}
