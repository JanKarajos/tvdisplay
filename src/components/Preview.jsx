import React from 'react';
import Stage from './Stage';
import { getRotation, isPortrait } from '../lib/rotation';

// Zmenšená kópia TV (16:9, pri TV na výšku 9:16). Text je viditeľný aj keď je na TV skrytý, s upozornením.
// Pomer strán je cez padding (nie aspect-ratio), aby fungoval aj v starších prehliadačoch (Android WebView).
export default function Preview({ state, song, page, empty = 'Prázdna obrazovka', onClick, label }) {
  const Tag = onClick ? 'button' : 'div';
  const portrait = isPortrait(getRotation(state.settings));
  return (
    <Tag
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      aria-label={label}
      className={`relative block bg-black rounded-xl overflow-hidden ring-1 ring-line ${portrait ? 'w-[56.25%] mx-auto' : 'w-full'} ${onClick ? 'ring-2 !ring-accent hover:opacity-90 active:scale-[0.99] transition' : ''}`}
    >
      <div style={{ paddingTop: portrait ? '177.78%' : '56.25%' }} />
      <Stage state={state} song={song} page={page} preview />
      {!song && <div className="absolute inset-0 flex items-end p-2 text-[11px] text-white/50">{empty}</div>}
      {state.isHidden && song && (
        <div className="absolute top-2 right-2 bg-red-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-md">SKRYTÉ NA TV</div>
      )}
    </Tag>
  );
}
