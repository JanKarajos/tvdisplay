import React from 'react';
import Stage from './Stage';

// Zmenšená kópia TV (16:9). Text je viditeľný aj keď je na TV skrytý, s upozornením.
export default function Preview({ state, song, page }) {
  return (
    <div className="relative w-full aspect-video bg-black rounded-md overflow-hidden ring-1 ring-black/10">
      {song || state.background ? (
        <Stage state={state} song={song} page={page} preview />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center text-xs text-white/40">Prázdna obrazovka</div>
      )}
      {state.isHidden && song && (
        <div className="absolute top-2 left-2 bg-red-600 text-white text-[10px] font-bold px-2 py-0.5 rounded">
          SKRYTÉ NA TV
        </div>
      )}
    </div>
  );
}
