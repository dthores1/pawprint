import { NotificationItem } from '../types';

// Where clicking a notification navigates. entity_type/entity_id is the
// navigation TARGET (e.g. the animal for foster/medical/adoption events), so
// this maps cleanly onto existing routes. Coordination requests live on the
// consolidated /requests page, selected by a `tab` query param (see Requests).
export function notificationLink(n: Pick<NotificationItem, 'entity_type' | 'entity_id'>): string {
  switch (n.entity_type) {
    case 'animal':
      return `/animals/${n.entity_id}`;
    case 'transport_request':
      return '/requests?tab=transport';
    case 'sitting_request':
      return '/requests?tab=sitting';
    case 'supply_request':
      return '/requests'; // supply is the default tab
    case 'clinic_event':
      return `/clinics/${n.entity_id}`;
    default:
      return '/notifications';
  }
}
