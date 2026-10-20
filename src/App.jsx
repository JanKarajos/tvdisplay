import React, { useState, useEffect } from 'react';
import Header from './components/Header';
import DisplayPage from './pages/DisplayPage';
import ControlPage from './pages/ControlPage';
import ControlPageLegacy from './pages/ControlPageLegacy';
import { api } from './api/mockApi';

export default function App() {
  const [route, setRoute] = useState(() => window.location.hash.replace('#', '') || 'control');
  
  useEffect(() => {
    // Skontroluj dostupnosť state servera pri načítaní
    api.checkStateServer().then(available => {
      if (available) {
        console.log('📡 Aplikácia používa state server pre cross-device synchronizáciu');
      } else {
        console.log('💾 Aplikácia používa localStorage (iba single-device)');
      }
    });
  }, []);
  
  useEffect(() => {
    const onHash = () => setRoute(window.location.hash.replace('#', '') || 'control');
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  if (route === 'control-legacy') {
    return <ControlPageLegacy />;
  }

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      <Header />
      <div className="p-6">
        {route === 'display' ? (
          <DisplayPage />
        ) : (
          <ControlPage />
        )}
      </div>
    </div>
  );
}
