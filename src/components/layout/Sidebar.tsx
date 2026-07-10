import { useState } from 'react';
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
  LogOutIcon,
  PanelLeftCloseIcon,
  PanelLeftOpenIcon } from
'lucide-react';
import { cn } from '../../lib/utils';
import { LogoMark } from '../ui/Logo';
import { useAuth } from '../../context/AuthContext';
import { useWhisker } from '../../context/WhiskerContext';
import { isDemoMode } from '../../lib/appMode';
import { useFostersEnabled } from '../../lib/useFostersEnabled';
import { useMediaQuery } from '../../lib/useMediaQuery';
import { track } from '../../lib/analytics';

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
  label: 'Foster Network',
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
  const fostersEnabled = useFostersEnabled();
  return navItems.filter(
    (item) =>
    // "Enable Foster Management" (Settings → General) force-hides the
    // Fosters tab regardless of per-tab navigation settings.
    (item.key !== 'fosters' || fostersEnabled) && (
    item.locked || isTabVisible(item.key))
  );
}

// ── Responsive width states ─────────────────────────────────────────────────
// >= xl (1280px): full sidebar (icons + labels). md–xl: collapsed icon rail —
// keeps nav visible on iPad without eating table width. < md: the sidebar is
// hidden entirely (AppShell's hamburger menu takes over). A user can override
// the breakpoint default with the collapse/expand button; picking the default
// back clears the override so other screen sizes return to auto behavior.
const SIDEBAR_PREF_KEY = 'whiskerville.sidebarExpanded';

function readSidebarPref(): boolean | null {
  try {
    const raw = localStorage.getItem(SIDEBAR_PREF_KEY);
    return raw === null ? null : raw === 'true';
  } catch {
    return null;
  }
}

function writeSidebarPref(pref: boolean | null) {
  try {
    if (pref === null) localStorage.removeItem(SIDEBAR_PREF_KEY);else
    localStorage.setItem(SIDEBAR_PREF_KEY, String(pref));
  } catch {
    // Ignore — worst case the override doesn't persist across reloads.
  }
}

function itemClasses(expanded: boolean, isActive = false) {
  return cn(
    'group relative flex items-center rounded-lg text-sm font-semibold transition-colors w-full',
    expanded ? 'gap-3 px-3 py-2.5' : 'justify-center px-0 py-2.5',
    isActive ?
    'bg-primary/10 text-primary' :
    'text-text-primary/80 hover:bg-background hover:text-text-primary'
  );
}

// Hover/focus tooltip for rail mode. Rendered inside the item (a `group`),
// floated past the sidebar's right edge; pointer-events-none so it never
// intercepts the click it's describing.
function RailTooltip({ label }: { label: string }) {
  return (
    <span
      role="tooltip"
      className="pointer-events-none absolute left-full top-1/2 z-50 ml-3 -translate-y-1/2 whitespace-nowrap rounded-md bg-text-primary px-2.5 py-1.5 text-xs font-semibold text-card opacity-0 shadow-soft transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">

      {label}
    </span>);

}

export function Sidebar() {
  const { currentOrg, signOut } = useAuth();
  const visibleNavItems = useVisibleNavItems();

  // Breakpoint default: full at xl and up, rail between md and xl.
  const isWide = useMediaQuery('(min-width: 1280px)');
  const [pref, setPref] = useState<boolean | null>(readSidebarPref);
  const expanded = pref ?? isWide;

  const toggleExpanded = () => {
    const next = !expanded;
    // Choosing the breakpoint default = back to auto (no stored override).
    const nextPref = next === isWide ? null : next;
    setPref(nextPref);
    writeSidebarPref(nextPref);
    track('setting_changed', { setting: 'sidebar_expanded', value: next });
  };

  return (
    <aside
      className={cn(
        'bg-card h-full flex-col hidden md:flex shrink-0 transition-[width] duration-200',
        expanded ? 'w-64' : 'w-20'
      )}>

      {/* Logo header has no right border so it reads as one band with the top
          bar; the vertical divider resumes on the nav/footer below it. */}
      <div
        className={cn(
          'h-16 flex items-center border-b border-border',
          expanded ? 'px-6' : 'justify-center'
        )}>

        <Link
          to="/"
          aria-label="Go to dashboard"
          className="flex items-center gap-1 text-primary rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-primary">

          <LogoMark className="w-16 h-14" />
          {expanded &&
          <span className="font-heading font-bold text-xl tracking-tight">
              Whiskerville
            </span>
          }
        </Link>
      </div>

      <nav
        className={cn(
          'flex-1 py-6 space-y-1 border-r border-border',
          expanded ? 'px-4' : 'px-3'
        )}>

        {visibleNavItems.map((item) =>
        <NavLink
          key={item.to}
          to={item.to}
          end={item.end}
          aria-label={item.label}
          className={({ isActive }) => itemClasses(expanded, isActive)}>

            <item.icon className="w-5 h-5 shrink-0" />
            {expanded ? item.label : <RailTooltip label={item.label} />}
          </NavLink>
        )}
      </nav>

      <div
        className={cn(
          'border-t border-r border-border space-y-1',
          expanded ? 'p-4' : 'px-3 py-4'
        )}>

        {currentOrg && expanded &&
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
          aria-label="Settings"
          className={({ isActive }) => itemClasses(expanded, isActive)}>

          <SettingsIcon className="w-5 h-5 shrink-0" />
          {expanded ? 'Settings' : <RailTooltip label="Settings" />}
        </NavLink>
        <NavLink
          to="/organization"
          aria-label="Members"
          className={({ isActive }) => itemClasses(expanded, isActive)}>

          <BuildingIcon className="w-5 h-5 shrink-0" />
          {expanded ? 'Members' : <RailTooltip label="Members" />}
        </NavLink>
        {!isDemoMode &&
        <button
          onClick={signOut}
          aria-label="Sign out"
          className={itemClasses(expanded)}>

            <LogOutIcon className="w-5 h-5 shrink-0" />
            {expanded ? 'Sign out' : <RailTooltip label="Sign out" />}
          </button>
        }
        <button
          onClick={toggleExpanded}
          aria-label={expanded ? 'Collapse sidebar' : 'Expand sidebar'}
          className={itemClasses(expanded)}>

          {expanded ?
          <>
              <PanelLeftCloseIcon className="w-5 h-5 shrink-0" />
              Collapse
            </> :

          <>
              <PanelLeftOpenIcon className="w-5 h-5 shrink-0" />
              <RailTooltip label="Expand sidebar" />
            </>
          }
        </button>
      </div>
    </aside>);

}
