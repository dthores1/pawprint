import { Link } from 'react-router-dom';
import { UserCircleIcon } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useWhisker } from '../../context/WhiskerContext';
import { NotificationBell } from './NotificationBell';

// Global desktop top bar. Right-aligned: the notification bell + the signed-in
// user's name (linking to their profile). Intentionally thin — it's the home
// for the bell now and the place search / quick actions will move to as the
// app grows. Hidden on mobile, where the bell sits in the existing header.
export function TopBar() {
  const { user, currentPersonId } = useAuth();
  const { peopleIndex } = useWhisker();

  const me = currentPersonId ?
  peopleIndex.find((p) => p.id === currentPersonId) :
  undefined;
  const displayName = me ?
  `${me.first_name} ${me.last_name}`.trim() :
  user?.email ?? '';

  return (
    <header className="hidden md:flex h-16 bg-card border-b border-border items-center justify-end gap-2 px-6 shrink-0">
      <NotificationBell />
      {currentPersonId ?
      <Link
        to={`/contacts/${currentPersonId}`}
        title={user?.email}
        className="flex items-center gap-2 px-2 py-1.5 rounded-lg text-sm font-semibold text-text-primary/80 hover:bg-background hover:text-text-primary transition-colors">

          <UserCircleIcon className="w-5 h-5" />
          <span className="max-w-[12rem] truncate">{displayName}</span>
        </Link> :
      displayName ?
      <span className="flex items-center gap-2 px-2 py-1.5 text-sm font-semibold text-text-primary/80">
          <UserCircleIcon className="w-5 h-5" />
          <span className="max-w-[12rem] truncate">{displayName}</span>
        </span> :
      null}
    </header>);

}
