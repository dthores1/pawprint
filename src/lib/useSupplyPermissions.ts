import { useAuth } from '../context/AuthContext';
import { useWhisker } from '../context/WhiskerContext';
import { useIsAdmin } from './useIsAdmin';
import { isPermissionActive } from './memberPermissionsApi';

/**
 * True when the signed-in user may process supply requests + manage supply
 * options: org admin/owner OR an active MANAGE_SUPPLY_REQUESTS grant. This gates
 * UI affordances only — the server (RLS + grant/revoke RPCs) is the source of
 * truth for actual writes.
 */
export function useCanManageSupplyRequests(): boolean {
  const isAdmin = useIsAdmin();
  const { currentMemberId } = useAuth();
  const { memberPermissions } = useWhisker();
  if (isAdmin) return true;
  if (!currentMemberId) return false;
  return memberPermissions.some(
    (p) =>
    p.member_id === currentMemberId &&
    p.permission_type === 'MANAGE_SUPPLY_REQUESTS' &&
    isPermissionActive(p)
  );
}
