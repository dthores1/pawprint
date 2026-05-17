import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboardIcon,
  PawPrintIcon,
  HomeIcon,
  SettingsIcon,
  UsersIcon,
  PackageOpenIcon } from
'lucide-react';
import { cn } from '../../lib/utils';
export function Sidebar() {
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
    label: 'Fosters'
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
  }];

  return (
    <aside className="w-64 bg-card border-r border-border h-full flex flex-col hidden md:flex">
      <div className="h-16 flex items-center px-6 border-b border-border">
        <div className="flex items-center gap-2 text-primary">
          <PawPrintIcon className="w-6 h-6" />
          <span className="font-heading font-bold text-xl tracking-tight">
            Pawprint
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

      <div className="p-4 border-t border-border">
        <button className="flex items-center gap-3 px-3 py-2.5 w-full rounded-lg text-sm font-semibold text-text-primary/80 hover:bg-background hover:text-text-primary transition-colors">
          <SettingsIcon className="w-5 h-5" />
          Settings
        </button>
      </div>
    </aside>);

}