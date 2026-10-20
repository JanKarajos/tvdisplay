import React from 'react';

const STATUS = {
  online: ['bg-emerald-500', 'Pripojené'],
  connecting: ['bg-amber-400 animate-pulse', 'Pripájam…'],
  offline: ['bg-red-500 animate-pulse', 'Offline – zmeny sa nedostanú na TV'],
};

export default function Header({ status, clients }) {
  const [dot, label] = STATUS[status] || STATUS.connecting;
  return (
    <header className="sticky top-0 z-30 bg-white/90 backdrop-blur border-b">
      <div className="max-w-7xl mx-auto px-4 h-12 flex items-center justify-between gap-4">
        <h1 className="font-semibold tracking-tight">SongDisplay</h1>
        <div className="flex items-center gap-4 text-sm">
          <span className="flex items-center gap-2 text-gray-600" title={clients != null ? `Pripojených zariadení: ${clients}` : undefined}>
            <span className={`w-2.5 h-2.5 rounded-full ${dot}`} />
            <span className="hidden sm:inline">{label}</span>
          </span>
          <a className="text-blue-700 hover:underline" href="#display" target="_blank" rel="noreferrer">Otvoriť obrazovku ↗</a>
        </div>
      </div>
    </header>
  );
}
