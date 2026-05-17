import React, { useState } from 'react';
import { Outlet, NavLink } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { PawPrintIcon, MenuIcon } from 'lucide-react';
export function AppShell() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  return (
    <div className="flex h-screen w-full bg-background overflow-hidden">
      <Sidebar />

      <div className="flex-1 flex flex-col h-full overflow-hidden">
        {/* Mobile Header */}
        <header className="md:hidden h-16 bg-card border-b border-border flex items-center justify-between px-4 shrink-0">
          <div className="flex items-center gap-2 text-primary">
            <PawPrintIcon className="w-7 h-7" />
            <span className="font-heading font-bold text-xl tracking-tight">
              Pawprint
            </span>
          </div>
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-2 text-text-secondary hover:bg-background rounded-lg">
            
            <MenuIcon className="w-7 h-7" />
          </button>
        </header>

        {/* Mobile Nav Dropdown */}
        {mobileMenuOpen &&
        <div className="md:hidden bg-card border-b border-border px-4 py-2 space-y-1 absolute top-16 left-0 right-0 z-40 shadow-soft">
            {[
          {
            to: '/',
            label: 'Dashboard'
          },
          {
            to: '/animals',
            label: 'Animals'
          },
          {
            to: '/fosters',
            label: 'Fosters'
          },
          {
            to: '/contacts',
            label: 'Contacts'
          }].
          map((item) =>
          <NavLink
            key={item.to}
            to={item.to}
            onClick={() => setMobileMenuOpen(false)}
            className={({ isActive }) =>
            `block px-3 py-2 rounded-lg text-sm font-medium ${isActive ? 'bg-primary/10 text-primary' : 'text-text-secondary'}`
            }>
            
                {item.label}
              </NavLink>
          )}
          </div>
        }

        {/* Main Content Area */}
        <main className="flex-1 overflow-y-auto p-4 md:p-8">
          <div className="max-w-6xl mx-auto h-full">
            <Outlet />
          </div>
        </main>
      </div>
    </div>);

}