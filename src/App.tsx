import React, { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
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
import { ClinicProfile } from './pages/ClinicProfile';
import { Login } from './pages/Login';
import { NoOrganizationScreen } from './pages/Onboarding';
import { AcceptInvitePage } from './pages/AcceptInvitePage';
import { OrganizationPage } from './pages/OrganizationPage';
import { Settings } from './pages/Settings';
import { ReportsPage } from './pages/ReportsPage';
import { RecycleBin } from './pages/RecycleBin';
import { LegalPage } from './pages/LegalPage';
import { LandingPage } from './pages/LandingPage';
import { RequestAccessPage } from './pages/RequestAccessPage';
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
        <Route path="clinics/:id" element={<ClinicProfile />} />
        <Route path="contacts" element={<Contacts />} />
        <Route path="contacts/:id" element={<ContactProfile />} />
        <Route path="organization" element={<OrganizationPage />} />
        <Route path="settings" element={<Settings />} />
        <Route path="reports" element={<ReportsPage />} />
        <Route path="recycle-bin" element={<RecycleBin />} />
      </Route>
    </Routes>);

}

// Minimum time the hero splash stays on screen at app boot, even when the
// underlying app is ready instantly. Keeps the brand moment from flashing.
const MIN_SPLASH_MS = 2000;

// Per-tab-session flag so the cosmetic hold runs only on the *first time you
// enter the app* — the boot right after signing in (or restoring a session in
// a fresh tab). sessionStorage survives page refreshes within the same tab but
// resets on a new tab/session, so refreshing a record or list won't replay the
// 2s brand moment, while signing in fresh always shows it.
const SPLASH_SHOWN_KEY = 'wv:splashShown';

function splashAlreadyShown() {
  try {
    return sessionStorage.getItem(SPLASH_SHOWN_KEY) === '1';
  } catch {
    return false;
  }
}

// One-shot timer that flips true after MIN_SPLASH_MS — but only the first time
// the app boots into an authenticated session this tab. `active` gates it on a
// real session so the flag isn't burned while a signed-out visitor sits on the
// landing page (which would suppress the brand moment at the next login). On
// later refreshes it resolves instantly, so the splash only lingers while
// something is genuinely loading. Shared by the production Gate and DemoGate.
function useMinSplashHold(active = true) {
  const [done, setDone] = useState(splashAlreadyShown);
  useEffect(() => {
    if (!active || done) return;
    const t = setTimeout(() => setDone(true), MIN_SPLASH_MS);
    // Mark shown immediately so a refresh mid-hold also skips the replay.
    try {
      sessionStorage.setItem(SPLASH_SHOWN_KEY, '1');
    } catch {
      // Ignore — worst case the hold simply plays again.
    }
    return () => clearTimeout(t);
  }, [active, done]);
  return done;
}

// Production gate: loading → splash, no session → public landing page, no org →
// onboarding, otherwise the routed app. The minimum splash hold keeps the brand
// moment visible when booting *into* the app; signed-out visitors skip it so the
// public landing page loads promptly (the `!session` check runs before the hold).
function Gate() {
  const { loading, session, orgsLoading, currentOrg } = useAuth();
  // Only arm the brand hold once a session exists — i.e. we're booting *into*
  // the app — so it isn't consumed while a signed-out visitor views the landing
  // page (the `!session` branch below returns before the hold is ever checked).
  const minSplashDone = useMinSplashHold(Boolean(session));
  if (loading) return <Splash />;
  if (!session) return <LandingPage />;
  if (!minSplashDone) return <Splash />;
  if (orgsLoading) return <Splash />;
  // No org yet → honest "no access" gate (self-service org creation is disabled
  // during the beta; orgs are provisioned by us and members join via invite).
  if (!currentOrg) return <NoOrganizationScreen />;
  return <AppRoutes />;
}

// Public /login route. Renders the auth screen for signed-out visitors and
// redirects to "/" once a session exists — so signing in here (or landing on
// /login while already authenticated) hands off to the Gate/app cleanly.
function LoginRoute() {
  const { loading, session } = useAuth();
  if (loading) return <Splash />;
  if (session) return <Navigate to="/" replace />;
  return <Login />;
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
          <Routes>
            {/* Public legal pages render outside the gate in demo mode too. */}
            <Route path="/terms" element={<LegalPage doc="terms" />} />
            <Route path="/privacy" element={<LegalPage doc="privacy" />} />
            <Route
              path="*"
              element={
                <DemoGate>
                  <AppRoutes />
                </DemoGate>
              } />
          </Routes>
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
            {/* Public sign-in route. The signed-out front door is the landing
             page (rendered by the Gate at "/"); this is the explicit /login the
             landing page's Sign In button links to. */}
            <Route path="/login" element={<LoginRoute />} />
            {/* Public "Request Beta Access" page — self-service org creation is
             disabled during the beta, so prospective rescues request access. */}
            <Route path="/request-access" element={<RequestAccessPage />} />
            {/* Invite acceptance is reachable without a session — signed-out
             visitors stash the token and sign in; AuthContext consumes it. */}
            <Route path="/invite/:token" element={<AcceptInvitePage />} />
            {/* Public legal pages — must render outside the auth Gate so
             external reviewers (e.g. Google OAuth verification) can load them. */}
            <Route path="/terms" element={<LegalPage doc="terms" />} />
            <Route path="/privacy" element={<LegalPage doc="privacy" />} />
            <Route path="*" element={<Gate />} />
          </Routes>
        </BrowserRouter>
      </WhiskerProvider>
    </AuthProvider>);

}

export function App() {
  return isDemoMode ? <DemoApp /> : <ProductionApp />;
}
