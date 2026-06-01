import { useAuth } from '../../context/AuthContext';
import { ArchiveTable } from '../../types';

// Tables a non-admin (Member) can archive if they created the row. Mirrors
// the server-side policy in archive_record() — the DB is authoritative; this
// hook just keeps the button from showing when we already know it'll fail.
const LOW_RISK_CREATOR_OWNED: ArchiveTable[] = [
'animal_notes',
'animal_photos',
'animal_action_items'];

interface Row {
  id?: string;
  /** auth.users.id of the row creator. Optional — many tables don't track one. */
  created_by?: string | null;
  /** True if this row is already archived (banner cases). */
  is_deleted?: boolean | null;
}

/**
 * Predicate for "should the Archive button render?" — admin always wins; for
 * low-risk tables a non-admin can archive their own rows. The server enforces
 * the same rule, so a `false` here just hides a button that would have failed.
 */
export function useCanArchive(table: ArchiveTable, row: Row | null | undefined): boolean {
  const { currentOrg, user } = useAuth();
  if (!row || row.is_deleted) return false;
  const role = currentOrg?.role;
  const isAdmin = role === 'owner' || role === 'admin';
  if (isAdmin) return true;
  if (!LOW_RISK_CREATOR_OWNED.includes(table)) return false;
  return !!user && !!row.created_by && row.created_by === user.id;
}

/**
 * Predicate for "should the Restore button render?" — original archiver or
 * admin. Used by the Recycle Bin and the archived-record banner.
 */
export function useCanRestore(deletedBy: string | null | undefined): boolean {
  const { currentOrg, user } = useAuth();
  const role = currentOrg?.role;
  const isAdmin = role === 'owner' || role === 'admin';
  if (isAdmin) return true;
  return !!user && !!deletedBy && deletedBy === user.id;
}
