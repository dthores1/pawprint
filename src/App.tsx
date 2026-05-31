import React, { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { WhiskerProvider } from './context/WhiskerContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import { DemoAuthProvider, DemoWhiskerProvider } from './context/DemoProviders';
import { isDemoMode } from './lib/appMode';
import { AppShell } from './components/layout/AppShell';
import { Dashboard } from './pages/Dashboard';
import { AnimalsList } from './pages/AnimalsList';
import { AnimalProfile } from './pages/AnimalProfile';
import { LitterProfile } from './pages/LitterProfile';
import { FostersList } from './pages/FostersList';
import { FosterProfile } from './pages/FosterProfile';
import { Contacts } from './pages/Contacts';
import { ContactProfile } from './pages/ContactProfile';
import { SupplyRequests } from './pages/SupplyRequests';
import { ProductCatalog } from './pages/ProductCatalog';
import { Transports } from './pages/Transports';
import { Sitting } from './pages/Sitting';
import { Clinics } from './pages/Clinics';
import { Login } from './pages/Login';
import { Onboarding } from './pages/Onboarding';
import { AcceptInvitePage } from './pages/AcceptInvitePage';
import { OrganizationPage } from './pages/OrganizationPage';
import { ReportsPage } from './pages/ReportsPage';
import { LogoHero } from './components/ui/Logo';

// Keeps the browser tab title in sync with the active org.
// Falls back to a plain product title before an org is selected
// (login, onboarding, invite acceptance).
function DocumentTitle() {
  const { currentOrg } = useAuth();
  useEffect(() => {
    document.title = currentOrg
      ? `Whiskerville | ${currentOrg.name}`
      : 'Whiskerville';
  }, [currentOrg]);
  return null;
}

function Splash() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background gap-4">
      <LogoHero className="w-96 animate-pulse" />
      <span className="text-2xl text-text-secondary">Loading…</span>
    </div>);

}

// The routed application shell — identical for demo and production.
function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<AppShell />}>
        <Route index element={<Dashboard />} />
        <Route path="animals" element={<AnimalsList />} />
        <Route path="animals/:id" element={<AnimalProfile />} />
        <Route path="litters/:id" element={<LitterProfile />} />
        <Route path="fosters" element={<FostersList />} />
        <Route path="fosters/:id" element={<FosterProfile />} />
        <Route path="supplies" element={<SupplyRequests />} />
        <Route path="supplies/catalog" element={<ProductCatalog />} />
        <Route path="transports" element={<Transports />} />
        <Route path="sitting" element={<Sitting />} />
        <Route path="clinics" element={<Clinics />} />
        <Route path="contacts" element={<Contacts />} />
        <Route path="contacts/:id" element={<ContactProfile />} />
        <Route path="organization" element={<OrganizationPage />} />
        <Route path="reports" element={<ReportsPage />} />
      </Route>
    </Routes>);

}

// Minimum time the hero splash stays on screen at app boot, even when the
// underlying app is ready instantly. Keeps the brand moment from flashing.
const MIN_SPLASH_MS = 2000;

// One-shot timer that flips true after MIN_SPLASH_MS. Used by both the
// production Gate and DemoGate so demo and prod feel identical at boot.
function useMinSplashHold() {
  const [done, setDone] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setDone(true), MIN_SPLASH_MS);
    return () => clearTimeout(t);
  }, []);
  return done;
}

// Production gate: loading → splash, no session → login, no org → onboarding,
// otherwise the routed app. Splash is also held for a minimum duration so the
// brand moment is visible on fast loads.
function Gate() {
  const { loading, session, orgsLoading, currentOrg } = useAuth();
  const minSplashDone = useMinSplashHold();
  if (loading || !minSplashDone) return <Splash />;
  if (!session) return <Login />;
  if (orgsLoading) return <Splash />;
  if (!currentOrg) return <Onboarding />;
  return <AppRoutes />;
}

// Demo-mode equivalent of the splash hold. Demo mode has no auth/loading
// states of its own, so the hold is the only thing keeping the splash up.
function DemoGate({ children }: { children: React.ReactNode }) {
  const minSplashDone = useMinSplashHold();
  if (!minSplashDone) return <Splash />;
  return <>{children}</>;
}

// Demo mode: no auth, no Supabase. Seed-backed providers feed the same
// contexts, so the app renders identically minus the gate.
function DemoApp() {
  return (
    <DemoAuthProvider>
      <DemoWhiskerProvider>
        <DocumentTitle />
        <BrowserRouter>
          <DemoGate>
            <AppRoutes />
          </DemoGate>
        </BrowserRouter>
      </DemoWhiskerProvider>
    </DemoAuthProvider>);

}

function ProductionApp() {
  return (
    <AuthProvider>
      <WhiskerProvider>
        <DocumentTitle />
        <BrowserRouter>
          <Routes>
            {/* Invite acceptance is reachable without a session — signed-out
             visitors stash the token and sign in; AuthContext consumes it. */}
            <Route path="/invite/:token" element={<AcceptInvitePage />} />
            <Route path="*" element={<Gate />} />
          </Routes>
        </BrowserRouter>
      </WhiskerProvider>
    </AuthProvider>);

}

export function App() {
  return isDemoMode ? <DemoApp /> : <ProductionApp />;
}
