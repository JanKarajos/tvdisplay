import React from 'react';
import SongRenderer from './SongRenderer';

export default function Preview({ state, song }) {
  return (
    <div className="w-full bg-black rounded-lg overflow-hidden relative border-2 border-gray-600 shadow-lg" style={{ aspectRatio: '16/9', minHeight: '200px' }}>
      {/* Pozadie zobrazíme len keď je text skrytý ALEBO nie je žiadna pieseň */}
      {(!song || state.isHidden) && state.background ? (
        <div className="absolute inset-0" style={{ background: state.background.startsWith('#') ? state.background : `url(${state.background}) center/cover no-repeat` }} />
      ) : <div className="absolute inset-0 bg-black" />}
      
      {/* Obsah - v Preview zobrazujeme text VŽDY (aj keď je na Display skrytý) */}
      <div className="relative z-10 h-full w-full flex items-center justify-center p-3">
        {song ? (
          <div className="w-full h-full relative">
            {state.isHidden && (
              <div className="absolute inset-0 bg-black/30 backdrop-blur-[1px] flex items-center justify-center z-20 pointer-events-none">
                <div className="bg-red-600/90 text-white px-4 py-2 rounded-lg text-sm font-bold shadow-lg">
                  SKRYTÉ NA DISPLEJI
                </div>
              </div>
            )}
            <SongRenderer {...song} currentPage={state.currentPage || 0} isPreview={true} />
          </div>
        ) : (
          <div className="text-sm text-white opacity-40">
            Náhľad displeja
          </div>
        )}
      </div>
    </div>
  );
}