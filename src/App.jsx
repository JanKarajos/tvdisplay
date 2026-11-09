import { timeoutSignal } from './lib/net';
import React, { Suspense, lazy, useEffect, useState } from 'react';
import DisplayPage from './pages/DisplayPage';
import ControlPage from './pages/ControlPage';
import ControlPageLegacy from './pages/ControlPageLegacy';
import { SERVER_URL } from './config';

// Administrácia sa načíta iba keď je potrebná (na Orange Pi sa nepoužíva)
const AdminPage = lazy(() => import('./admin/AdminPage'));

function currentRoute() {
  return window.location.hash.replace('#', '');
}

export default function App() {
  const [route, setRoute] = useState(currentRoute);
  const [defaultRoute, setDefaultRoute] = useState(null);

  useEffect(() => {
    const onHash = () => setRoute(currentRoute());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  // Bez adresy v URL: na serveri administrácie (NAS) otvor administráciu, inak ovládanie
  useEffect(() => {
    if (route || defaultRoute) return;
    fetch(`${SERVER_URL}/health`, { signal: timeoutSignal(3000) })
      .then((r) => (r.ok ? r.json() : {}))
      .catch(() => ({}))
      .then((h) => setDefaultRoute(h.admin ? 'admin' : 'control'));
  }, [route, defaultRoute]);

  const page = route || defaultRoute;
  if (!page) return null;
  if (page === 'display') return <DisplayPage />;
  if (page === 'control-legacy') return <ControlPageLegacy />;
  if (page === 'admin') {
    return (
      <Suspense fallback={null}>
        <AdminPage />
      </Suspense>
    );
  }
  return <ControlPage />;
}
