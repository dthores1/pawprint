import { AnimalNote } from '../types';

export interface CurrentUserLite {
  id: string;
  email?: string;
}

// The DB stores `created_by` (auth user id), not a display name. Until a
// profiles table exists we can only resolve the *current* user's name; other
// authors get a generic label. author_name isn't shown in the UI today, so
// this is best-effort.
export function rowToNote(r: any, currentUser?: CurrentUserLite): AnimalNote {
  const authorName = r.created_by ?
  r.created_by === currentUser?.id ?
  currentUser?.email ?? 'You' :
  'Team member' :
  'Unknown';
  return {
    id: r.id,
    animal_id: r.animal_id,
    author_name: authorName,
    note_type: r.note_type,
    body: r.body,
    created_at: r.created_at
  };
}

export function noteToInsert(
note: Omit<AnimalNote, 'id' | 'created_at'>,
organizationId: string,
createdBy: string | null)
{
  return {
    organization_id: organizationId,
    animal_id: note.animal_id,
    note_type: note.note_type,
    body: note.body,
    created_by: createdBy
  };
}
