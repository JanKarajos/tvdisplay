import React from 'react';
import Card from '../Card';
import { actions } from '../../lib/actions';

export default function QuickActions({ state, images }) {
  const backgrounds = [
    { label: 'Čierne', value: null, swatch: '#000' },
    { label: 'Svetlé', value: '#F8FAFF', swatch: '#F8FAFF' },
    ...images.map((img) => ({ label: img.title, value: img.imageUrl, image: img.imageUrl })),
  ];

  return (
    <Card title="Rýchle akcie">
      <button onClick={actions.loadPsalm} className="w-full mb-3 px-3 py-2 text-sm font-medium bg-emerald-600 text-white rounded-md hover:bg-emerald-700">
        Dnešný žalm
      </button>
      <div className="text-xs text-gray-500 mb-1.5">Pozadie (keď nie je zobrazený text)</div>
      <div className="flex gap-2 overflow-x-auto pb-1">
        {backgrounds.map((bg) => {
          const active = (state.background || null) === bg.value;
          return (
            <button
              key={bg.label + bg.value}
              onClick={() => actions.setBackground(bg.value)}
              title={bg.label}
              className={`shrink-0 w-20 rounded-md overflow-hidden border-2 ${active ? 'border-blue-600' : 'border-transparent hover:border-gray-300'}`}
            >
              <div className="aspect-video bg-cover bg-center" style={bg.image ? { backgroundImage: `url(${bg.image})` } : { background: bg.swatch }} />
              <div className="text-[10px] truncate px-1 py-0.5 bg-gray-50">{bg.label}</div>
            </button>
          );
        })}
      </div>
    </Card>
  );
}
