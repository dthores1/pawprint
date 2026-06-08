import { useAuth } from '../context/AuthContext';

// True when the signed-in user is an owner or admin of the current org. Same
// role check used by useCanArchive — the source of truth is the server (RLS /
// archive_record); this hook only gates UI affordances (e.g. the Export CSV
// button), not access to data the client already holds.
export function useIsAdmin(): boolean {
  const { currentOrg } = useAuth();
  const role = currentOrg?.role;
  return role === 'owner' || role === 'admin';
}
