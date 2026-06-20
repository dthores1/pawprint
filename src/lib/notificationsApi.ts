import { NotificationItem } from '../types';

// PostgREST select that joins each of the signed-in user's user_notification
// rows to its shared notification. `!inner` so a filter on
// notification.organization_id can scope the result to the current org. Filter
// by recipient_user_id + organization_id and order by created_at at the call site.
export const NOTIFICATION_SELECT =
  'id, read_at, created_at, notification:notifications!inner(*)';

// Map a user_notification row (with embedded `notification`) to the flat shape
// the UI consumes. `notification` may be an object or a single-element array
// depending on the PostgREST embed shape — handle both.
export function rowToNotificationItem(r: any): NotificationItem {
  const n = Array.isArray(r.notification) ? r.notification[0] : r.notification;
  return {
    user_notification_id: r.id,
    notification_id: n?.id ?? r.notification_id,
    type: n?.type ?? '',
    title: n?.title ?? '',
    body: n?.body ?? '',
    entity_type: n?.entity_type ?? '',
    entity_id: n?.entity_id ?? '',
    actor_user_id: n?.actor_user_id ?? undefined,
    metadata: n?.metadata ?? {},
    read_at: r.read_at ?? undefined,
    // Order/group by the recipient row's created_at (matches when the user got it).
    created_at: r.created_at ?? n?.created_at
  };
}

// Notifications are created only by DB triggers, so the only client write is
// marking a user_notification read.
export function markReadToRow() {
  return { read_at: new Date().toISOString() };
}
