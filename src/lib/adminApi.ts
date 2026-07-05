// Owner Console data access. Every read is a SECURITY DEFINER RPC (migration
// 0090) that asserts platform-admin membership server-side — the console never
// selects from tables directly, so nothing here depends on widened RLS. All of
// it is read-only by design: this module deliberately exposes no writes.
import { supabase } from './supabase';

export interface PlatformStats {
  organization_count: number;
  total_users: number;
  active_users_30d: number;
  total_animals: number;
  pending_invitations: number;
  pending_signup_requests: number;
  open_support_tickets: number;
}

export interface AdminOrgRow {
  id: string;
  name: string;
  created_at: string;
  member_count: number;
  animal_count: number;
  open_support_count: number;
  last_activity: string | null;
}

export interface AdminOrgMember {
  role: string;
  created_at: string;
  is_support: boolean;
  expires_at: string | null;
  email: string;
  name: string;
}

export interface AdminOrgAnimal {
  id: string;
  name: string | null;
  rescue_id: string | null;
  status: string;
  species: string | null;
  created_at: string;
}

export interface AdminOrgTicket {
  ticket_number: number;
  subject: string;
  category: string;
  status: string;
  created_at: string;
}

export interface AdminOrgInvitation {
  email: string;
  role: string;
  created_at: string;
  accepted_at: string | null;
  revoked_at: string | null;
  expires_at: string;
}

export interface AdminOrgAuditEvent {
  action: string;
  actor_label: string | null;
  created_at: string;
}

export interface AdminOrgDetail {
  organization: { id: string; name: string; created_at: string } | null;
  members: AdminOrgMember[];
  recent_animals: AdminOrgAnimal[];
  recent_support_tickets: AdminOrgTicket[];
  recent_invitations: AdminOrgInvitation[];
  recent_activity: AdminOrgAuditEvent[];
}

export interface AdminUserMembership {
  org_id: string;
  org_name: string;
  role: string;
  is_support: boolean;
  expires_at: string | null;
}

export interface AdminUserRow {
  id: string;
  email: string;
  name: string | null;
  created_at: string;
  last_sign_in_at: string | null;
  email_confirmed_at: string | null;
  providers: string[];
  banned_until: string | null;
  memberships: AdminUserMembership[];
}

export async function fetchIsPlatformAdmin(): Promise<boolean> {
  const { data, error } = await supabase.rpc('is_platform_admin');
  if (error) throw new Error(error.message);
  return Boolean(data);
}

export async function fetchPlatformStats(): Promise<PlatformStats> {
  const { data, error } = await supabase.rpc('admin_platform_stats');
  if (error) throw new Error(error.message);
  return data as PlatformStats;
}

export async function fetchAdminOrganizations(): Promise<AdminOrgRow[]> {
  const { data, error } = await supabase.rpc('admin_list_organizations');
  if (error) throw new Error(error.message);
  return (data ?? []) as AdminOrgRow[];
}

export async function fetchAdminUsers(): Promise<AdminUserRow[]> {
  const { data, error } = await supabase.rpc('admin_list_users');
  if (error) throw new Error(error.message);
  return (data ?? []) as AdminUserRow[];
}

export async function fetchAdminOrgDetail(
orgId: string)
: Promise<AdminOrgDetail> {
  const { data, error } = await supabase.rpc('admin_org_detail', {
    p_org_id: orgId
  });
  if (error) throw new Error(error.message);
  return data as AdminOrgDetail;
}
