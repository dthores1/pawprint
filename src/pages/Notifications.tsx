import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCheckIcon, BellOffIcon } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { useWhisker } from '../context/WhiskerContext';
import { notificationLink } from '../lib/notificationLink';
import { NotificationIcon } from '../components/notifications/NotificationIcon';
import { NotificationItem } from '../types';
import { cn } from '../lib/utils';

// Twitter/Facebook-style full notification history. Unread items are grouped on
// top and marked read as they scroll into view (per the agreed read behavior);
// clicking a row also marks it read and navigates to the linked record. The
// list is capped at the most recent 100 in context, so no virtualization yet.
export function Notifications() {
  const {
    notifications,
    unreadNotificationCount,
    refreshNotifications,
    markNotificationRead,
    markAllNotificationsRead
  } = useWhisker();
  const navigate = useNavigate();

  // Freshen on mount (complements the navigation refetch in AppShell).
  useEffect(() => {
    refreshNotifications();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Mark unread rows read once they've actually been on screen.
  const observerRef = useRef<IntersectionObserver | null>(null);
  useEffect(() => {
    const obs = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            const id = (e.target as HTMLElement).dataset.unotif;
            if (id) markNotificationRead(id);
          }
        }
      },
      { threshold: 1.0 }
    );
    observerRef.current = obs;
    return () => obs.disconnect();
    // markNotificationRead is a no-op for already-read rows, so a stable ref isn't required.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Attach the observer to each rendered unread row.
  const observeUnread = (el: HTMLElement | null) => {
    if (el && observerRef.current) observerRef.current.observe(el);
  };

  const unread = notifications.filter((n) => !n.read_at);
  const read = notifications.filter((n) => n.read_at);

  const onClick = (n: NotificationItem) => {
    markNotificationRead(n.user_notification_id);
    navigate(notificationLink(n));
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <h1 className="font-heading font-bold text-2xl text-text-primary">
          Notifications
        </h1>
        {unreadNotificationCount > 0 &&
        <button
          onClick={markAllNotificationsRead}
          className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-semibold text-primary hover:bg-primary/10 transition-colors">

            <CheckCheckIcon className="w-4 h-4" />
            Mark all as read
          </button>
        }
      </div>

      {notifications.length === 0 ?
      <div className="flex flex-col items-center justify-center py-20 text-center text-text-secondary">
          <BellOffIcon className="w-10 h-10 mb-3 opacity-60" />
          <p className="text-sm">You don't have any notifications yet.</p>
        </div> :

      <div className="space-y-8">
          {unread.length > 0 &&
        <section className="space-y-2">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-text-secondary">
                Unread ({unread.length})
              </h2>
              <ul className="bg-card border border-border rounded-xl divide-y divide-border overflow-hidden">
                {unread.map((n) =>
            <li key={n.user_notification_id} ref={observeUnread} data-unotif={n.user_notification_id}>
                    <Row n={n} onClick={onClick} />
                  </li>
            )}
              </ul>
            </section>
        }

          {read.length > 0 &&
        <section className="space-y-2">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-text-secondary">
                Earlier
              </h2>
              <ul className="bg-card border border-border rounded-xl divide-y divide-border overflow-hidden">
                {read.map((n) =>
            <li key={n.user_notification_id}>
                    <Row n={n} onClick={onClick} />
                  </li>
            )}
              </ul>
            </section>
        }
        </div>
      }
    </div>);

}

function Row({
  n,
  onClick



}: {n: NotificationItem;onClick: (n: NotificationItem) => void;}) {
  return (
    <button
      onClick={() => onClick(n)}
      className={cn(
        'flex items-start gap-3 w-full text-left px-4 py-3.5 hover:bg-background transition-colors',
        !n.read_at && 'bg-primary/5'
      )}>

      <NotificationIcon type={n.type} />
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold text-text-primary">{n.title}</span>
        <span className="block text-sm text-text-secondary">{n.body}</span>
        <span className="block text-xs text-text-secondary mt-0.5">
          {formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}
        </span>
      </span>
      {!n.read_at &&
      <span className="mt-1.5 w-2 h-2 rounded-full bg-primary shrink-0" aria-hidden="true" />
      }
    </button>);

}
