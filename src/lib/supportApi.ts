import {
  AuditEvent,
  SupportAccessStatus,
  SupportTicket,
  SupportTicketAttachment,
  SupportTicketCategory } from
'../types';

// — Support tickets —————————————————————————————————————
export function rowToSupportTicket(r: any): SupportTicket {
  return {
    id: r.id,
    // bigint arrives as a number for small values; coerce defensively.
    ticket_number: Number(r.ticket_number),
    created_by_person_id: r.created_by_person_id ?? undefined,
    category: r.category,
    subject: r.subject,
    description: r.description,
    steps_to_reproduce: r.steps_to_reproduce ?? undefined,
    status: r.status,
    support_access_requested: r.support_access_requested ?? false,
    page_path: r.page_path ?? undefined,
    user_agent: r.user_agent ?? undefined,
    app_version: r.app_version ?? undefined,
    resolved_at: r.resolved_at ?? undefined,
    created_at: r.created_at,
    updated_at: r.updated_at
  };
}

function normalize(v: any): any {
  return typeof v === 'string' && v.trim() === '' ? null : v;
}

export function supportTicketToInsert(
ticket: {
  category: SupportTicketCategory;
  subject: string;
  description: string;
  steps_to_reproduce?: string;
  page_path?: string;
  user_agent?: string;
  app_version?: string;
},
organizationId: string,
createdByPersonId: string | null,
createdByUserId: string | null)
{
  return {
    organization_id: organizationId,
    created_by_person_id: createdByPersonId,
    created_by_user_id: createdByUserId,
    category: ticket.category,
    subject: ticket.subject.trim(),
    description: ticket.description.trim(),
    steps_to_reproduce: normalize(ticket.steps_to_reproduce),
    page_path: normalize(ticket.page_path),
    user_agent: normalize(ticket.user_agent),
    app_version: normalize(ticket.app_version)
  };
}

// — Attachments ————————————————————————————————————————
export function rowToSupportAttachment(r: any): SupportTicketAttachment {
  return {
    id: r.id,
    ticket_id: r.ticket_id,
    file_name: r.file_name,
    file_type: r.file_type ?? undefined,
    file_size: r.file_size != null ? Number(r.file_size) : undefined,
    storage_path: r.storage_path,
    uploaded_at: r.created_at
  };
}

// — Support access + audit ——————————————————————————————
export function rowToAuditEvent(r: any): AuditEvent {
  return {
    id: r.id,
    actor_label: r.actor_label ?? undefined,
    action: r.action,
    ticket_id: r.ticket_id ?? undefined,
    metadata: r.metadata ?? {},
    created_at: r.created_at
  };
}

// Reduce the org's is_support membership rows to a single active-grant status.
// (`now` is passed in so callers don't each re-read the clock.)
export function rowsToSupportAccessStatus(
rows: any[],
now: number): SupportAccessStatus
{
  const active = rows.find(
    (r) =>
    r.is_support &&
    (r.expires_at == null || new Date(r.expires_at).getTime() > now)
  );
  if (!active) return { active: false, expires_at: null };
  return {
    active: true,
    expires_at: active.expires_at ?? null,
    ticket_id: active.support_ticket_id ?? undefined
  };
}

export function supportAttachmentToInsert(
att: {
  ticket_id: string;
  file_name: string;
  file_type: string | null;
  file_size: number | null;
  storage_path: string;
},
organizationId: string,
uploadedByUserId: string | null)
{
  return {
    organization_id: organizationId,
    ticket_id: att.ticket_id,
    uploaded_by_user_id: uploadedByUserId,
    file_name: att.file_name,
    file_type: att.file_type,
    file_size: att.file_size,
    storage_path: att.storage_path
  };
}
