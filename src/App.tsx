import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { WhiskerProvider } from './context/WhiskerContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import { DemoAuthProvider, DemoWhiskerProvider } from './context/DemoProviders';
import { isDemoMode } from './lib/appMode';
import { AppShell } from './components/layout/AppShell';
import { Dashboard } from './pages/Dashboard';
import { AnimalsList } from './pages/AnimalsList';
import { AnimalProfile } from './pages/AnimalProfile';
import { FostersList } from './pages/FostersList';
import { FosterProfile } from './pages/FosterProfile';
import { Contacts } from './pages/Contacts';
import { SupplyRequests } from './pages/SupplyRequests';
import { ProductCatalog } from './pages/ProductCatalog';
import { Transports } from './pages/Transports';
import { Sitting } from './pages/Sitting';
import { Clinics } from './pages/Clinics';
import { Login } from './pages/Login';
import { Onboarding } from './pages/Onboarding';
import { PawPrintIcon } from 'lucide-react';

function Splash() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background gap-3 text-primary">
      <PawPrintIcon className="w-10 h-10 animate-pulse" />
      <span className="text-sm text-text-secondary">Loading…</span>
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
        <Route path="fosters" element={<FostersList />} />
        <Route path="fosters/:id" element={<FosterProfile />} />
        <Route path="supplies" element={<SupplyRequests />} />
        <Route path="supplies/catalog" element={<ProductCatalog />} />
        <Route path="transports" element={<Transports />} />
        <Route path="sitting" element={<Sitting />} />
        <Route path="clinics" element={<Clinics />} />
        <Route path="contacts" element={<Contacts />} />
      </Route>
    </Routes>);

}

// Production gate: loading → splash, no session → login, no org → onboarding,
// otherwise the routed app.
function Gate() {
  const { loading, session, orgsLoading, currentOrg } = useAuth();
  if (loading) return <Splash />;
  if (!session) return <Login />;
  if (orgsLoading) return <Splash />;
  if (!currentOrg) return <Onboarding />;
  return <AppRoutes />;
}

// Demo mode: no auth, no Supabase. Seed-backed providers feed the same
// contexts, so the app renders identically minus the gate.
function DemoApp() {
  return (
    <DemoAuthProvider>
      <DemoWhiskerProvider>
        <BrowserRouter>
          <AppRoutes />
        </BrowserRouter>
      </DemoWhiskerProvider>
    </DemoAuthProvider>);

}

function ProductionApp() {
  return (
    <AuthProvider>
      <WhiskerProvider>
        <BrowserRouter>
          <Gate />
        </BrowserRouter>
      </WhiskerProvider>
    </AuthProvider>);

}

export function App() {
  return isDemoMode ? <DemoApp /> : <ProductionApp />;
}
