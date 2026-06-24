// DB row ↔ TS type mappers for the in-app guidance system.
// guidance_messages is read-only from the client (curated via SQL); the per-user
// "seen" markers are written through WhiskerContext, so only readers live here.
import { GuidanceMessage, GuidanceSeen } from '../types';

export function rowToGuidanceMessage(r: any): GuidanceMessage {
  return {
    id: r.id,
    key: r.key,
    placement: r.placement,
    page: r.page ?? undefined,
    title: r.title,
    body: r.body,
    link_label: r.link_label ?? undefined,
    icon: r.icon ?? undefined,
    variant: r.variant ?? 'info',
    enabled: !!r.enabled,
    version: r.version ?? 1,
    sort_order: r.sort_order ?? 0,
    created_at: r.created_at,
    updated_at: r.updated_at
  };
}

export function rowToGuidanceSeen(r: any): GuidanceSeen {
  return {
    id: r.id,
    user_id: r.user_id,
    guidance_key: r.guidance_key,
    version: r.version ?? 1,
    dismissed_at: r.dismissed_at
  };
}
