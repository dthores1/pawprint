import React from 'react';
import { NavLink, Link } from 'react-router-dom';
import {
  LayoutDashboardIcon,
  PawPrintIcon,
  HomeIcon,
  UsersIcon,
  PackageOpenIcon,
  TruckIcon,
  HeartHandshakeIcon,
  StethoscopeIcon,
  BuildingIcon,
  UserCircleIcon,
  LogOutIcon } from
'lucide-react';
import { cn } from '../../lib/utils';
import { useAuth } from '../../context/AuthContext';
import { isDemoMode } from '../../lib/appMode';
export function Sidebar() {
  const { user, currentOrg, currentPersonId, signOut } = useAuth();
  const navItems = [
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
    to: '/clinics',
    icon: StethoscopeIcon,
    label: 'Clinics'
  },
  {
    to: '/transports',
    icon: TruckIcon,
    label: 'Transport Requests'
  },
  {
    to: '/sitting',
    icon: HeartHandshakeIcon,
    label: 'Sitting Requests'
  },
  {
    to: '/supplies',
    icon: PackageOpenIcon,
    label: 'Supply Requests'
  },
  {
    to: '/contacts',
    icon: UsersIcon,
    label: 'Contacts'
  },
  {
    to: '/organization',
    icon: BuildingIcon,
    label: 'Organization'
  }];

  return (
    <aside className="w-64 bg-card border-r border-border h-full flex flex-col hidden md:flex">
      <div className="h-16 flex items-center px-6 border-b border-border">
        <div className="flex items-center gap-2 text-primary">
          <PawPrintIcon className="w-7 h-7" />
          <span className="font-heading font-bold text-xl tracking-tight">
            Whiskerville
          </span>
        </div>
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