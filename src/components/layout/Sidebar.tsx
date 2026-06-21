import { NavLink, Link } from 'react-router-dom';
import {
  LayoutDashboardIcon,
  PawPrintIcon,
  HeartIcon,
  HomeIcon,
  UsersIcon,
  StethoscopeIcon,
  MapPinnedIcon,
  InboxIcon,
  BuildingIcon,
  BarChart3Icon,
  Trash2Icon,
  SettingsIcon,
  LogOutIcon } from
'lucide-react';
import { cn } from '../../lib/utils';
import { LogoMark } from '../ui/Logo';
import { useAuth } from '../../context/AuthContext';
import { useWhisker } from '../../context/WhiskerContext';
import { isDemoMode } from '../../lib/appMode';

export interface NavItem {
  to: string;
  icon: typeof PawPrintIcon;
  label: string;
  /** Stable identifier matching organization_navigation_settings.tab_key. */
  key: string;
  /** Locked tabs are always shown and can't be hidden in Settings → Navigation. */
  locked?: boolean;
  end?: boolean;
}

// Single source of truth for the sidebar — consumed by both Sidebar (desktop)
// and AppShell (mobile menu). `key` ties an item to its org visibility setting;
// `locked` items are never hideable (Dashboard, Animals, Recycle Bin).
export const navItems: NavItem[] = [
{
  to: '/',
  icon: LayoutDashboardIcon,
  label: 'Dashboard',
  key: 'dashboard',
  locked: true,
  end: true
},
{
  to: '/animals',
  icon: PawPrintIcon,
  label: 'Animals',
  key: 'animals',
  locked: true
},
{
  to: '/adoptions',
  icon: HeartIcon,
  label: 'Adoptions',
  key: 'adoptions'
},
{
  to: '/fosters',
  icon: HomeIcon,
  label: 'Foster Parents',
  key: 'fosters'
},
{
  to: '/medical',
  icon: StethoscopeIcon,
  label: 'Medical',
  key: 'medical'
},
{
  to: '/sites',
  icon: MapPinnedIcon,
  label: 'Rescue Sites',
  key: 'sites'
},
{
  to: '/requests',
  icon: InboxIcon,
  label: 'Requests',
  key: 'requests'
},
{
  to: '/contacts',
  icon: UsersIcon,
  label: 'Contacts',
  key: 'contacts'
},
{
  to: '/reports',
  icon: BarChart3Icon,
  label: 'Reports',
  key: 'reports'
},
{
  to: '/recycle-bin',
  icon: Trash2Icon,
  label: 'Recycle Bin',
  key: 'recycle-bin',
  locked: true
}];

/** The nav items an org has chosen to show (locked items always included). */
export function useVisibleNavItems(): NavItem[] {
  const { isTabVisible } = useWhisker();
  return navItems.filter((item) => item.locked || isTabVisible(item.key));
}

export function Sidebar() {
  const { currentOrg, signOut } = useAuth();
  const visibleNavItems = useVisibleNavItems();

  return (
    <aside className="w-64 bg-card h-full flex flex-col hidden md:flex">
      {/* Logo header has no right border so it reads as one band with the top
          bar; the vertical divider resumes on the nav/footer below it. */}
      <div className="h-16 flex items-center px-6 border-b border-border">
        <Link
          to="/"
          aria-label="Go to dashboard"
          className="flex items-center gap-1 text-primary rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-primary">

          <LogoMark className="w-16 h-14" />
          <span className="font-heading font-bold text-xl tracking-tight">
            Whiskerville
          </span>
        </Link>
      </div>

      <nav className="flex-1 px-4 py-6 space-y-1 border-r border-border">
        {visibleNavItems.map((item) =>
        <NavLink
          key={item.to}
          to={item.to}
          end={item.end}
          className={({ isActive }) =>
          cn(
            'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-semibold transition-colors',
            isActive ?
            'bg-primary/10 text-primary' :
            'text-text-primary/80 hover:bg-background hover:text-text-primary'
          )
          }>
          
            <item.icon className="w-5 h-5" />
            {item.label}
          </NavLink>
        )}
      </nav>

      <div className="p-4 border-t border-r border-border space-y-1">
        {currentOrg &&
        <div className="px-3 pb-1">
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
          className={({ isActive }) =>
          cn(
            'flex items-center gap-3 px-3 py-2.5 w-full rounded-lg text-sm font-semibold transition-colors',
            isActive ?
            'bg-primary/10 text-primary' :
            'text-text-primary/80 hover:bg-background hover:text-text-primary'
          )
          }>

          <SettingsIcon className="w-5 h-5" />
          Settings
        </NavLink>
        <NavLink
          to="/organization"
          className={({ isActive }) =>
          cn(
            'flex items-center gap-3 px-3 py-2.5 w-full rounded-lg text-sm font-semibold transition-colors',
            isActive ?
            'bg-primary/10 text-primary' :
            'text-text-primary/80 hover:bg-background hover:text-text-primary'
          )
          }>

          <BuildingIcon className="w-5 h-5" />
          Members
        </NavLink>
        {!isDemoMode &&
        <button
          onClick={signOut}
          className="flex items-center gap-3 px-3 py-2.5 w-full rounded-lg text-sm font-semibold text-text-primary/80 hover:bg-background hover:text-text-primary transition-colors">

            <LogOutIcon className="w-5 h-5" />
            Sign out
          </button>
        }
      </div>
    </aside>);

}