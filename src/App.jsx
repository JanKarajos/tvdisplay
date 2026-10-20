import React, { useEffect, useState } from 'react';
import DisplayPage from './pages/DisplayPage';
import ControlPage from './pages/ControlPage';
import ControlPageLegacy from './pages/ControlPageLegacy';

function currentRoute() {
  return window.location.hash.replace('#', '') || 'control';
}

export default function App() {
  const [route, setRoute] = useState(currentRoute);

  useEffect(() => {
    const onHash = () => setRoute(currentRoute());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  if (route === 'display') return <DisplayPage />;
  if (route === 'control-legacy') return <ControlPageLegacy />;
  return <ControlPage />;
}
