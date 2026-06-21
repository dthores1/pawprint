import { useEffect, useState } from 'react';
import { Outlet, NavLink, Link, useLocation } from 'react-router-dom';
import { Sidebar, useVisibleNavItems } from './Sidebar';
import { DemoBanner } from './DemoBanner';
import { TopBar } from './TopBar';
import { NotificationBell } from './NotificationBell';
import { isDemoMode } from '../../lib/appMode';
import { LogOutIcon, MenuIcon, SettingsIcon, UserCircleIcon } from 'lucide-react';
import { LogoMark } from '../ui/Logo';
import { useAuth } from '../../context/AuthContext';
import { useWhisker } from '../../context/WhiskerContext';
import { cn } from '../../lib/utils';
export function AppShell() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { user, currentOrg, currentPersonId, signOut } = useAuth();
  const { refreshNotifications } = useWhisker();
  const visibleNavItems = useVisibleNavItems();
  const location = useLocation();

  // Refetch notifications on navigation (MVP freshness; complements the
  // background poll in WhiskerContext). Context can't see routing, so it lives here.
  useEffect(() => {
    refreshNotifications();
    // refreshNotifications is stable per render but not memoized; key on pathname.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname]);

  return (
    <div className="flex flex-col h-screen w-full bg-background overflow-hidden">
      {isDemoMode && <DemoBanner />}
      <div className="flex flex-1 min-h-0 w-full">
        <Sidebar />

      <div className="flex-1 flex flex-col h-full overflow-hidden">
        {/* Desktop top bar (bell + user menu) */}
        <TopBar />

        {/* Mobile Header */}
        <header className="md:hidden h-16 bg-card border-b border-border flex items-center justify-between px-4 shrink-0">
          <div className="flex items-center gap-1 text-primary">
            <LogoMark className="w-16 h-14" />
            <span className="font-heading font-bold text-xl tracking-tight">
              Whiskerville
            </span>
          </div>
          <div className="flex items-center gap-1">
            <NotificationBell />
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-label="Open menu"
              className="p-2 text-text-secondary hover:bg-background rounded-lg">

              <MenuIcon className="w-7 h-7" />
            </button>
          </div>
        </header>

        {/* Mobile Nav Dropdown */}
        {mobileMenuOpen &&
        <>
          {/* Backdrop — tapping outside the menu closes it. */}
          <div
            className="md:hidden fixed inset-0 top-16 z-30"
            aria-hidden="true"
            onClick={() => setMobileMenuOpen(false)} />

          <div className="md:hidden bg-card border-b border-border px-4 py-2 absolute top-16 left-0 right-0 z-40 shadow-soft max-h-[calc(100dvh-4rem)] overflow-y-auto overscroll-contain">
          <nav className="space-y-1 pb-2">
            {visibleNavItems.map((item) =>
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            onClick={() => setMobileMenuOpen(false)}
            className={({ isActive }) =>
            `block px-3 py-2 rounded-lg text-sm font-medium ${isActive ? 'bg-primary/10 text-primary' : 'text-text-secondary'}`
            }>
            
                {item.label}
              </NavLink>
          )}
          </nav>
          <div className="border-t border-border pt-2 pb-3 space-y-1">
            {currentOrg &&
            <div className="px-3 py-1">
                <p className="text-xs uppercase tracking-wider text-text-secondary">
                  Organization
                </p>
                <p className="text-sm font-semibold text-text-primary truncate">
                  {currentOrg.name}
                </p>
              </div>
            }
            <NavLink
              to="/settings"
              onClick={() => setMobileMenuOpen(false)}
              className={({ isActive }) =>
              cn(
                'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                isActive ?
                'bg-primary/10 text-primary' :
                'text-text-secondary hover:bg-background hover:text-text-primary'
              )
              }>
              
              <SettingsIcon className="w-4 h-4" />
              Settings
            </NavLink>
            {user && currentPersonId ?
            <Link
              to={`/contacts/${currentPersonId}`}
              onClick={() => setMobileMenuOpen(false)}
              className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-text-secondary hover:bg-background hover:text-text-primary transition-colors"
              title={user.email}>
              
                <UserCircleIcon className="w-4 h-4" />
                <span className="truncate">My profile</span>
              </Link> :
            user ?
            <p className="px-3 py-2 text-xs text-text-secondary truncate" title={user.email}>
                {user.email}
              </p> :
            null
            }
            {!isDemoMode &&
            <button
              onClick={() => {
                setMobileMenuOpen(false);
                signOut();
              }}
              className="flex items-center gap-3 px-3 py-2 w-full rounded-lg text-sm font-medium text-text-secondary hover:bg-background hover:text-text-primary transition-colors">
              
                <LogOutIcon className="w-4 h-4" />
                Sign out
              </button>
            }
          </div>
          </div>
        </>
        }

        {/* Main Content Area */}
        <main className="flex-1 overflow-y-auto p-4 md:p-8">
          <div className="max-w-6xl mx-auto h-full">
            <Outlet />
          </div>
        </main>
        </div>
      </div>
    </div>);

}