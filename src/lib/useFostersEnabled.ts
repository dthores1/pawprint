import { useAuth } from '../context/AuthContext';

/**
 * Org-level "Enable Foster Management" switch (Settings → General; default
 * on). When false, foster workflows are hidden across the app — the Foster
 * Network tab, placement actions, foster stats/filters/exports, and the
 * placement-based Sitting workflow. UI-level only: no data, permission, or
 * RLS changes, so flipping it back on restores everything.
 */
export function useFostersEnabled(): boolean {
  const { currentOrg } = useAuth();
  return currentOrg?.foster_management_enabled !== false;
}
