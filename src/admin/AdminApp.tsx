import React, { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from '../context/AuthContext';
import { Login } from '../pages/Login';
import { LogoHero } from '../components/ui/Logo';
import { Button } from '../components/ui/Button';
import { fetchIsPlatformAdmin } from '../lib/adminApi';
import { AdminShell } from './AdminShell';
import { AdminDashboard } from './AdminDashboard';
import { AdminOrgDetail } from './AdminOrgDetail';
import { AdminUsers } from './AdminUsers';

// The Owner Console (admin.whiskerville.app): a read-only, platform-wide view
// for Whiskerville staff. It reuses the production AuthProvider (same Supabase
// project, same sign-in methods) but gates on `platform_admins` membership via
// the is_platform_admin() RPC instead of org membership — a platform admin
// typically belongs to no customer org at all. WhiskerProvider is deliberately
// absent: the console holds no org data and performs no writes.

function Splash() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background gap-4">
      <LogoHero className="w-96 animate-pulse" />
      <span className="text-2xl text-text-secondary">Loading…</span>
    </div>);

}

// Signed in but not in platform_admins. An honest dead-end — the console has
// no fallback surface, and we never bounce to the customer app from here.
function AccessDenied() {
  const { user, signOut } = useAuth();
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background gap-4 px-6 text-center">
      <LogoHero className="w-72" />
      <h1 className="font-heading text-2xl font-bold text-text-primary">
        This console is for Whiskerville staff
      </h1>
      <p className="text-text-secondary max-w-md">
        {user?.email ? `${user.email} isn't` : "Your account isn't"} authorized
        to view the Owner Console. If you're looking for your rescue's
        workspace, head to the main Whiskerville app.
      </p>
      <Button variant="outline" onClick={() => void signOut()}>
        Sign out
      </Button>
    </div>);

}

function AdminGate() {
  const { loading, session } = useAuth();
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [checkError, setCheckError] = useState<string | null>(null);

  useEffect(() => {
    if (!session) {
      setAllowed(null);
      setCheckError(null);
      return;
    }
    let cancelled = false;
    fetchIsPlatformAdmin().
    then((ok) => {
      if (!cancelled) setAllowed(ok);
    }).
    catch((err: Error) => {
      if (!cancelled) setCheckError(err.message);
    });
    return () => {
      cancelled = true;
    };
  }, [session]);

  if (loading) return <Splash />;
  if (!session) return <Login />;
  if (checkError) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background gap-3 px-6 text-center">
        <p className="text-text-primary font-medium">
          Couldn't verify console access.
        </p>
        <p className="text-text-secondary text-sm max-w-md">{checkError}</p>
      </div>);

  }
  if (allowed === null) return <Splash />;
  if (!allowed) return <AccessDenied />;

  return (
    <Routes>
      <Route path="/" element={<AdminShell />}>
        <Route index element={<AdminDashboard />} />
        <Route path="users" element={<AdminUsers />} />
        <Route path="orgs/:id" element={<AdminOrgDetail />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>);

}

function ConsoleTitle() {
  useEffect(() => {
    document.title = 'Whiskerville | Owner Console';
  }, []);
  return null;
}

export function AdminApp() {
  return (
    <AuthProvider>
      <ConsoleTitle />
      <BrowserRouter>
        <AdminGate />
      </BrowserRouter>
    </AuthProvider>);

}
