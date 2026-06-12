import { useAuth } from '../context/AuthContext';
import { useWhisker } from '../context/WhiskerContext';
import { useIsAdmin } from './useIsAdmin';
import { isPermissionActive } from './memberPermissionsApi';

/**
 * True when the signed-in user may create / edit / delete Rescue Sites: org
 * admin/owner OR an active MANAGE_SITES grant. Everyone else can still READ
 * sites. This gates UI affordances only — the server (RLS + grant/revoke RPCs)
 * is the source of truth for actual writes.
 */
export function useCanManageSites(): boolean {
  const isAdmin = useIsAdmin();
  const { currentMemberId } = useAuth();
  const { memberPermissions } = useWhisker();
  if (isAdmin) return true;
  if (!currentMemberId) return false;
  return memberPermissions.some(
    (p) =>
    p.member_id === currentMemberId &&
    p.permission_type === 'MANAGE_SITES' &&
    isPermissionActive(p)
  );
}
