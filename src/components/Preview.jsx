import React from 'react';
import SongRenderer from './SongRenderer';

export default function Preview({ state, song }) {
  return (
    <div className="w-full bg-black rounded-lg overflow-hidden relative border-2 border-gray-600 shadow-lg" style={{ aspectRatio: '16/9', minHeight: '200px' }}>
      {(!song || state.isHidden) && state.background ? (
        <div className="absolute inset-0" style={{ background: state.background.startsWith('#') ? state.background : `url(${state.background}) center/cover no-repeat` }} />
      ) : <div className="absolute inset-0 bg-black" />}
      <div className="relative z-10 h-full w-full flex items-center justify-center p-3">
        {song && !state.isHidden ? (
          <div className="w-full h-full">
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