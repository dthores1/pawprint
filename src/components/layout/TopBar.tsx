import { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  UserCircleIcon,
  ChevronDownIcon,
  SlidersHorizontalIcon,
  LogOutIcon } from
'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useWhisker } from '../../context/WhiskerContext';
import { isDemoMode } from '../../lib/appMode';
import { NotificationBell } from './NotificationBell';

// Global desktop top bar. Right-aligned: the notification bell + the signed-in
// user's menu (My Profile / Preferences / Sign Out). Hidden on mobile, where the
// bell + menu live in the mobile header (AppShell).
export function TopBar({
  onOpenPreferences
}: {
  onOpenPreferences: () => void;
}) {
  const { user, currentPersonId, signOut } = useAuth();
  const { peopleIndex } = useWhisker();
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const me = currentPersonId ?
  peopleIndex.find((p) => p.id === currentPersonId) :
  undefined;
  const displayName = me ?
  `${me.first_name} ${me.last_name}`.trim() :
  user?.email ?? '';

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [open]);

  const itemClass =
  'flex items-center gap-2.5 w-full px-3 py-2 text-sm text-left text-text-primary/80 hover:bg-background hover:text-text-primary transition-colors';

  return (
    <header className="hidden md:flex h-16 bg-card border-b border-border items-center justify-end gap-2 px-6 shrink-0">
      <NotificationBell />
      {displayName ?
      <div className="relative" ref={menuRef}>
          <button
          onClick={() => setOpen((v) => !v)}
          title={user?.email}
          aria-haspopup="menu"
          aria-expanded={open}
          className="flex items-center gap-2 px-2 py-1.5 rounded-lg text-sm font-semibold text-text-primary/80 hover:bg-background hover:text-text-primary transition-colors">

            <UserCircleIcon className="w-5 h-5" />
            <span className="max-w-[12rem] truncate">{displayName}</span>
            <ChevronDownIcon
            className={`w-4 h-4 transition-transform ${open ? 'rotate-180' : ''}`} />

          </button>

          {open &&
        <div
          role="menu"
          className="absolute right-0 mt-1 w-52 bg-card border border-border rounded-xl shadow-soft-lg py-1 z-50">

              {currentPersonId &&
          <Link
            to={`/contacts/${currentPersonId}`}
            onClick={() => setOpen(false)}
            role="menuitem"
            className={itemClass}>

                  <UserCircleIcon className="w-4 h-4" />
                  My Profile
                </Link>
          }
              <button
            type="button"
            onClick={() => {
              setOpen(false);
              onOpenPreferences();
            }}
            role="menuitem"
            className={itemClass}>

                <SlidersHorizontalIcon className="w-4 h-4" />
                Preferences
              </button>
              {!isDemoMode &&
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              signOut();
            }}
            role="menuitem"
            className={itemClass}>

                  <LogOutIcon className="w-4 h-4" />
                  Sign Out
                </button>
          }
            </div>
        }
        </div> :
      null}
    </header>);

}
