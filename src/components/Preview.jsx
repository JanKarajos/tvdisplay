import React from 'react';
import SongRenderer from './SongRenderer';

export default function Preview({ state, song }) {
  return (
    <div className="h-40 bg-black rounded overflow-hidden relative">
      {(!song || state.isHidden) && state.background ? (
        <div className="absolute inset-0" style={{ background: state.background.startsWith('#') ? state.background : `url(${state.background}) center/cover no-repeat` }} />
      ) : <div className="absolute inset-0 bg-black" />}
      <div className="relative z-10 h-full flex items-center justify-center p-2">
        <div className="text-white text-center max-h-full overflow-hidden">
          {song && !state.isHidden ? (
            <div className="transform scale-50 origin-center">
              <SongRenderer {...song} />
            </div>
          ) : (
            <div className="text-sm opacity-80">
              {state.background && (!song || state.isHidden) ? ' ' : ' '}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}