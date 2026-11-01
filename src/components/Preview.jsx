import React from 'react';
import Stage from './Stage';

// Zmenšená kópia TV (16:9). Text je viditeľný aj keď je na TV skrytý, s upozornením.
export default function Preview({ state, song, page, empty = 'Prázdna obrazovka', onClick, label }) {
  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      aria-label={label}
      className={`relative block w-full aspect-video bg-black rounded-xl overflow-hidden ring-1 ring-line ${onClick ? 'hover:ring-2 hover:ring-accent transition' : ''}`}
    >
      <Stage state={state} song={song} page={page} preview />
      {!song && <div className="absolute inset-0 flex items-end p-2 text-[11px] text-white/50">{empty}</div>}
      {state.isHidden && song && (
        <div className="absolute top-2 right-2 bg-red-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-md">SKRYTÉ NA TV</div>
      )}
    </Tag>
  );
}
