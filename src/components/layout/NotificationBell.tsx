import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BellIcon } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { useWhisker } from '../../context/WhiskerContext';
import { notificationLink } from '../../lib/notificationLink';
import { NotificationIcon } from '../notifications/NotificationIcon';
import { NotificationItem } from '../../types';
import { cn } from '../../lib/utils';

// Bell + unread badge that opens a dropdown of the most recent notifications.
// Opening the dropdown refreshes the list but does NOT mark anything read —
// reading is per-item (on click) or via the full page / "mark all as read".
export function NotificationBell() {
  const {
    notifications,
    unreadNotificationCount,
    refreshNotifications,
    markNotificationRead
  } = useWhisker();
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const wrapRef = useRef<HTMLDivElement>(null);

  // Close on outside click / Escape.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const toggle = () => {
    const next = !open;
    setOpen(next);
    if (next) refreshNotifications(); // freshen on open
  };

  const onItemClick = (n: NotificationItem) => {
    markNotificationRead(n.user_notification_id);
    setOpen(false);
    navigate(notificationLink(n));
  };

  const recent = notifications.slice(0, 10);
  const badge = unreadNotificationCount > 9 ? '9+' : String(unreadNotificationCount);

  return (
    <div ref={wrapRef} className="relative">
      <button
        type="button"
        onClick={toggle}
        aria-label={
          unreadNotificationCount > 0 ?
          `Notifications (${unreadNotificationCount} unread)` :
          'Notifications'
        }
        className="relative p-2 text-text-secondary hover:bg-background hover:text-text-primary rounded-lg transition-colors">

        <BellIcon className="w-6 h-6" />
        {unreadNotificationCount > 0 &&
        <span className="absolute -top-0.5 -right-0.5 min-w-[1.1rem] h-[1.1rem] px-1 flex items-center justify-center rounded-full bg-red-500 text-white text-[0.65rem] font-bold leading-none">
            {badge}
          </span>
        }
      </button>

      {open &&
      <div className="absolute right-0 mt-2 w-80 max-w-[calc(100vw-2rem)] bg-card border border-border rounded-xl shadow-soft-lg z-50 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <span className="font-heading font-bold text-text-primary">
              Notifications
            </span>
            {unreadNotificationCount > 0 &&
          <span className="text-xs text-text-secondary">
                {unreadNotificationCount} unread
              </span>
          }
          </div>

          <div className="max-h-96 overflow-y-auto">
            {recent.length === 0 ?
          <p className="px-4 py-8 text-center text-sm text-text-secondary">
                You're all caught up.
              </p> :

          recent.map((n) =>
          <button
            key={n.user_notification_id}
            onClick={() => onItemClick(n)}
            className={cn(
              'flex items-start gap-3 w-full text-left px-4 py-3 border-b border-border last:border-b-0 hover:bg-background transition-colors',
              !n.read_at && 'bg-primary/5'
            )}>

                  <NotificationIcon type={n.type} />
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold text-text-primary truncate">
                      {n.title}
                    </span>
                    <span className="block text-sm text-text-secondary line-clamp-2">
                      {n.body}
                    </span>
                    <span className="block text-xs text-text-secondary mt-0.5">
                      {formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}
                    </span>
                  </span>
                  {!n.read_at &&
            <span className="mt-1 w-2 h-2 rounded-full bg-primary shrink-0" aria-hidden="true" />
            }
                </button>
          )}
          </div>

          <button
          onClick={() => {
            setOpen(false);
            navigate('/notifications');
          }}
          className="block w-full text-center px-4 py-3 text-sm font-semibold text-primary hover:bg-background transition-colors border-t border-border">

            View all notifications →
          </button>
        </div>
      }
    </div>);

}
