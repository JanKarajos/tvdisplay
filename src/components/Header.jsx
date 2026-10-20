import React from 'react';
export default function Header() {
  return (
    <header className="flex items-center justify-between mb-6">
      <h1 className="text-2xl font-semibold">SongDisplay</h1>
      <nav className="space-x-3">
        <a className="text-sm underline" href="#control">Ovládanie</a>
        <a className="text-sm underline" href="#display">Obrazovka</a>
      </nav>
    </header>
  );
}
