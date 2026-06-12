import { MemberPermission } from '../types';

export function rowToMemberPermission(r: any): MemberPermission {
  return {
    id: r.id,
    organization_id: r.organization_id,
    member_id: r.member_id,
    permission_type: r.permission_type,
    is_active: r.is_active,
    starts_at: r.starts_at ?? undefined,
    ends_at: r.ends_at ?? undefined,
    granted_by_member_id: r.granted_by_member_id ?? undefined
  };
}

/** Whether a grant is currently in effect (active + within its time window). */
export function isPermissionActive(p: MemberPermission, now = Date.now()): boolean {
  if (!p.is_active) return false;
  if (p.starts_at && new Date(p.starts_at).getTime() > now) return false;
  if (p.ends_at && new Date(p.ends_at).getTime() < now) return false;
  return true;
}
