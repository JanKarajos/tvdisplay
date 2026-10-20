import React from 'react';
import Card from '../Card';
import { actions } from '../../lib/actions';

export default function Playlist({ songs, currentId, nextId }) {
  return (
    <Card
      title={`Zoznam na omšu (${songs.length})`}
      actions={
        <button onClick={actions.clearPlaylist} disabled={!songs.length} className="text-xs text-gray-500 hover:text-red-600 disabled:opacity-40">
          Vyprázdniť
        </button>
      }
    >
      {!songs.length && <div className="text-sm text-gray-500">Pridaj piesne tlačidlom „+ Zoznam“.</div>}
      <ol className="space-y-1">
        {songs.map((s, i) => {
          const isCurrent = s.id === currentId;
          const isNext = s.id === nextId;
          return (
            <li
              key={s.id}
              className={`flex items-center gap-2 px-2 py-1.5 rounded border ${isCurrent ? 'border-blue-300 bg-blue-50' : isNext ? 'border-amber-300 bg-amber-50' : 'border-transparent hover:bg-gray-50'}`}
            >
              <span className="w-5 text-xs text-gray-400 tabular-nums">{i + 1}.</span>
              <span className="flex-1 text-sm truncate">{s.title}</span>
              {isCurrent && <span className="text-[10px] font-semibold text-blue-700">NA TV</span>}
              {isNext && <span className="text-[10px] font-semibold text-amber-700">ĎALŠIA</span>}
              <button onClick={() => actions.movePlaylistItem(s.id, -1)} disabled={i === 0} className="px-1 text-gray-400 hover:text-gray-700 disabled:opacity-30" title="Vyššie">↑</button>
              <button onClick={() => actions.movePlaylistItem(s.id, 1)} disabled={i === songs.length - 1} className="px-1 text-gray-400 hover:text-gray-700 disabled:opacity-30" title="Nižšie">↓</button>
              <button onClick={() => actions.stageOrShow(s)} className="px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700">Zobraziť</button>
              <button onClick={() => actions.removeFromPlaylist(s.id)} className="px-1 text-gray-400 hover:text-red-600" title="Odobrať">✕</button>
            </li>
          );
        })}
      </ol>
    </Card>
  );
}
