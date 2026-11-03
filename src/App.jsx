import React, { useState, useEffect } from 'react';
import Header from './components/Header';
import DisplayPage from './pages/DisplayPage';
import ControlPage from './pages/ControlPage';
import AdminPage from './admin/AdminPage';
import { appConfig } from './api/server';

const currentRoute = () => window.location.hash.replace('#', '');

export default function App() {
  const [route, setRoute] = useState(currentRoute);
  const [config, setConfig] = useState(null);
  useEffect(() => {
    const onHash = () => setRoute(currentRoute());
    window.addEventListener('hashchange', onHash);
    appConfig.then(setConfig);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  // Bez adresy v URL: na serveri s administráciou (NAS) otvor administráciu, inak ovládanie
  const page = route || (config ? (config.admin ? 'admin' : 'control') : null);

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      <Header adminOnly={!!config?.admin && !config?.dataUrl} />
      <div className="p-6">
        {page === 'display' && <DisplayPage />}
        {page === 'admin' && <AdminPage />}
        {page && page !== 'display' && page !== 'admin' && <ControlPage />}
      </div>
    </div>
  );
}
