import React from 'react';
import { Link, NavLink, Outlet } from 'react-router-dom';
import { ShieldCheck } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { LogoMark } from '../components/ui/Logo';
import { Button } from '../components/ui/Button';
import { cn } from '../lib/utils';

// Chrome for the Owner Console: a single top bar instead of the customer app's
// sidebar — the console is two screens deep at most, and visually distinct
// chrome makes it obvious you're in the staff surface, not a rescue workspace.
export function AdminShell() {
  const { user, signOut } = useAuth();
  return (
    <div className="min-h-screen bg-background">
      <header className="bg-card border-b border-border">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-3">
            <LogoMark className="h-8 w-8" />
            <span className="font-heading font-bold text-lg text-text-primary">
              Whiskerville
            </span>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-accent text-secondary">
              <ShieldCheck className="w-3.5 h-3.5" />
              Owner Console
            </span>
          </Link>
          <nav className="flex items-center gap-1">
            {[
            { to: '/', label: 'Overview', end: true },
            { to: '/users', label: 'Users', end: false }].
            map((item) =>
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
              cn(
                'px-3 py-1.5 rounded-lg text-sm font-medium transition-colors',
                isActive ?
                'bg-primary/10 text-primary' :
                'text-text-secondary hover:text-text-primary hover:bg-background'
              )
              }>

                {item.label}
              </NavLink>
            )}
          </nav>
          <div className="flex items-center gap-3">
            <span className="text-sm text-text-secondary hidden sm:block">
              {user?.email}
            </span>
            <Button variant="ghost" size="sm" onClick={() => void signOut()}>
              Sign out
            </Button>
          </div>
        </div>
      </header>
      <main className="max-w-6xl mx-auto px-6 py-8">
        <Outlet />
      </main>
    </div>);

}
