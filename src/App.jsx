import React, { useState, useEffect } from 'react';
import Header from './components/Header';
import DisplayPage from './pages/DisplayPage';
import ControlPage from './pages/ControlPage';

export default function App() {
  const [route, setRoute] = useState(() => window.location.hash.replace('#', '') || 'control');
  useEffect(() => {
    const onHash = () => setRoute(window.location.hash.replace('#', '') || 'control');
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      <Header />
      <div className="p-6">
        {route === 'display' ? <DisplayPage /> : <ControlPage />}
      </div>
    </div>
  );
}
