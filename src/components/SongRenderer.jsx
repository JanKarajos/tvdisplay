import React from 'react';
export default function SongRenderer({ lyrics, title, imageUrl }) {
  if (imageUrl && !lyrics) {
    return (
      <div className="flex flex-col items-center justify-center w-full h-full">
        <img src={imageUrl} alt={title || 'Obrázok'} className="max-h-[60vh] max-w-full object-contain rounded shadow" />
        {title && <div className="mt-2 text-white text-xl font-bold">{title}</div>}
      </div>
    );
  }
  const length = lyrics ? lyrics.length : 0;
  const fontSize = length > 400 ? 'text-2xl' : length > 200 ? 'text-3xl' : 'text-4xl';
  const lines = lyrics ? lyrics.split('\n').filter(Boolean) : [];
  return (
    <div className="text-white">
      <div className="mb-4 font-bold text-2xl">{title}</div>
      <div className={`${fontSize} leading-snug`}>{lines.map((l, i) => <div key={i}>{l}</div>)}</div>
    </div>
  );
}
