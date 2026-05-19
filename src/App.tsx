import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { WhiskerProvider } from './context/WhiskerContext';
import { AppShell } from './components/layout/AppShell';
import { Dashboard } from './pages/Dashboard';
import { AnimalsList } from './pages/AnimalsList';
import { AnimalProfile } from './pages/AnimalProfile';
import { FostersList } from './pages/FostersList';
import { FosterProfile } from './pages/FosterProfile';
import { Contacts } from './pages/Contacts';
import { SupplyRequests } from './pages/SupplyRequests';
import { Transports } from './pages/Transports';
import { Sitting } from './pages/Sitting';
import { Clinics } from './pages/Clinics';
export function App() {
  return (
    <WhiskerProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<AppShell />}>
            <Route index element={<Dashboard />} />
            <Route path="animals" element={<AnimalsList />} />
            <Route path="animals/:id" element={<AnimalProfile />} />
            <Route path="fosters" element={<FostersList />} />
            <Route path="fosters/:id" element={<FosterProfile />} />
            <Route path="supplies" element={<SupplyRequests />} />
            <Route path="transports" element={<Transports />} />
            <Route path="sitting" element={<Sitting />} />
            <Route path="clinics" element={<Clinics />} />
            <Route path="contacts" element={<Contacts />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </WhiskerProvider>);

}