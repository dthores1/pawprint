import { useAuth } from '../context/AuthContext';
import { useWhisker } from '../context/WhiskerContext';
import { useIsAdmin } from './useIsAdmin';
import { isPermissionActive } from './memberPermissionsApi';
import type { MemberPermissionType } from '../types';

/**
 * True when the signed-in user holds an active grant of `type` (or is an org
 * admin/owner). Shared by the animal-management permission hooks. These gate UI
 * affordances only — the server (RLS + grant/revoke RPCs) is the source of truth
 * for actual writes.
 */
function useHasPermission(type: MemberPermissionType): boolean {
  const isAdmin = useIsAdmin();
  const { currentMemberId } = useAuth();
  const { memberPermissions } = useWhisker();
  if (isAdmin) return true;
  if (!currentMemberId) return false;
  return memberPermissions.some(
    (p) =>
    p.member_id === currentMemberId &&
    p.permission_type === type &&
    isPermissionActive(p)
  );
}

/**
 * May create/edit/delete animals & litters and manage relationships: org
 * admin/owner OR an active MANAGE_ANIMALS grant. Everyone else can still READ.
 */
export function useCanManageAnimals(): boolean {
  return useHasPermission('MANAGE_ANIMALS');
}

/** May add/edit/complete medical records (and Clinics): admin OR MANAGE_MEDICAL. */
export function useCanManageMedical(): boolean {
  return useHasPermission('MANAGE_MEDICAL');
}

/** May manage external adoption listings: admin OR MANAGE_EXTERNAL_LISTINGS. */
export function useCanManageExternalListings(): boolean {
  return useHasPermission('MANAGE_EXTERNAL_LISTINGS');
}

/**
 * True when the signed-in user is the CURRENT (active) foster of this animal —
 * i.e. there's an active foster placement whose person is the user's self
 * record. Mirrors the server's is_active_foster(); used to surface the limited
 * "care collaboration" affordances. Former fosters (no active placement) return
 * false. Returns false when animalId is missing.
 */
export function useIsActiveFosterOf(animalId: string | undefined): boolean {
  const { currentPersonId } = useAuth();
  const { placements } = useWhisker();
  if (!animalId || !currentPersonId) return false;
  return placements.some(
    (p) =>
    p.animal_id === animalId &&
    p.placement_status === 'active' &&
    p.person_id === currentPersonId
  );
}
