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

/**
 * True when the signed-in user may see supply FINANCIAL data — Total Cost on a
 * supply request and the Supply spend reports. Same as managing supply requests,
 * PLUS the org-wide "Show All Reports to Everyone" setting (full transparency).
 * This is the single source of truth for financial visibility in the UI; the
 * data layer (loadCoordination) mirrors the same logic to keep Total Cost off
 * the wire for everyone else.
 */
export function useCanViewSupplyFinancials(): boolean {
  const canManage = useCanManageSupplyRequests();
  const { currentOrg } = useAuth();
  return canManage || !!currentOrg?.show_all_reports;
}
