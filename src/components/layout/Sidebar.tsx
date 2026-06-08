import { NavLink, Link } from 'react-router-dom';
import {
  LayoutDashboardIcon,
  PawPrintIcon,
  HomeIcon,
  UsersIcon,
  StethoscopeIcon,
  InboxIcon,
  BuildingIcon,
  BarChart3Icon,
  Trash2Icon,
  SettingsIcon,
  UserCircleIcon,
  LogOutIcon } from
'lucide-react';
import { cn } from '../../lib/utils';
import { LogoMark } from '../ui/Logo';
import { useAuth } from '../../context/AuthContext';
import { isDemoMode } from '../../lib/appMode';

export const navItems = [
{
  to: '/',
  icon: LayoutDashboardIcon,
  label: 'Dashboard',
  end: true
},
{
  to: '/animals',
  icon: PawPrintIcon,
  label: 'Animals'
},
{
  to: '/fosters',
  icon: HomeIcon,
  label: 'Foster Parents'
},
{
  to: '/medical',
  icon: StethoscopeIcon,
  label: 'Medical'
},
{
  to: '/requests',
  icon: InboxIcon,
  label: 'Requests'
},
{
  to: '/contacts',
  icon: UsersIcon,
  label: 'Contacts'
},
{
  to: '/reports',
  icon: BarChart3Icon,
  label: 'Reports'
},
{
  to: '/organization',
  icon: BuildingIcon,
  label: 'Members'
},
{
  to: '/recycle-bin',
  icon: Trash2Icon,
  label: 'Recycle Bin'
}];

export function Sidebar() {
  const { user, currentOrg, currentPersonId, signOut } = useAuth();

  return (
    <aside className="w-64 bg-card border-r border-border h-full flex flex-col hidden md:flex">
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

      <nav className="flex-1 px-4 py-6 space-y-1">
        {navItems.map((item) =>
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

      <div className="p-4 border-t border-border space-y-1">
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
        {user && currentPersonId ?
        <Link
          to={`/contacts/${currentPersonId}`}
          className="flex items-center gap-3 px-3 py-2.5 w-full rounded-lg text-sm font-semibold text-text-primary/80 hover:bg-background hover:text-text-primary transition-colors"
          title={user.email}>

            <UserCircleIcon className="w-5 h-5" />
            <span className="truncate">My profile</span>
          </Link> :
        user ?
        <p className="px-3 text-xs text-text-secondary truncate" title={user.email}>
            {user.email}
          </p> :
        null
        }
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