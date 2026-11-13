import React from 'react';
import Card from '../Card';
import Preview from '../Preview';
import { actions } from '../../lib/actions';
import { THEMES, liturgicalSeason } from '../../lib/liturgy';
import { ROTATIONS, getRotation } from '../../lib/rotation';
import DeviceCard from './DeviceCard';
import TvCard from './TvCard';
import { useFeature } from '../../lib/features';

function Toggle({ checked, onChange, label, hint }) {
  return (
    <label className="flex items-start gap-3 cursor-pointer">
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`mt-0.5 shrink-0 w-12 h-7 rounded-full p-1 transition ${checked ? 'bg-accent' : 'bg-line'}`}
      >
        <span className={`block w-5 h-5 rounded-full bg-white shadow transition ${checked ? 'translate-x-5' : ''}`} />
      </button>
      <span>
        <span className="block text-sm font-semibold">{label}</span>
        {hint && <span className="block text-xs text-muted">{hint}</span>}
      </span>
    </label>
  );
}

export default function ScreenSettings({ state, images, sampleSong, health }) {
  const settings = state.settings || {};
  const season = liturgicalSeason();
  const themeOptions = [['auto', `Automaticky – ${THEMES[season].name}`, THEMES[season]], ...Object.entries(THEMES).map(([id, t]) => [id, t.name, t])];
  const rotation = getRotation(settings);
  const tvControl = useFeature('tv');
  const backgrounds = [
    { label: 'Podľa témy', value: null },
    { label: 'Čierna', value: '#000000', swatch: '#000' },
    { label: 'Svetlá', value: '#F8FAFF', swatch: '#F8FAFF' },
    ...images.map((img) => ({ label: img.title, value: img.imageUrl, image: img.imageUrl })),
  ];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <Card title="Vzhľad textu na TV" subtitle="Farba pozadia a zvýraznenia podľa liturgického obdobia">
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {themeOptions.map(([id, name, t]) => {
            const active = (settings.theme || 'auto') === id;
            return (
              <button
                key={id}
                onClick={() => actions.setSettings({ theme: id })}
                className={`rounded-xl overflow-hidden border-2 text-left transition ${active ? 'border-accent' : 'border-transparent hover:border-line'}`}
              >
                <div className="aspect-video grid place-items-center" style={{ background: t.background }}>
                  <span className="w-1/3 h-1 rounded-full" style={{ background: t.accent }} />
                </div>
                <div className="px-2 py-1.5 text-xs font-semibold bg-sunken truncate">{name}</div>
              </button>
            );
          })}
        </div>
        <div className="mt-4">
          <Toggle
            checked={Boolean(settings.textOverBackground)}
            onChange={(v) => actions.setSettings({ textOverBackground: v })}
            label="Text cez obrázok pozadia"
            hint="Obrázok ostane pod textom stmavený. Inak je pod textom téma."
          />
        </div>
      </Card>

      <Card title="Pozadie" subtitle="Zobrazí sa, keď na TV nie je text alebo je skrytý">
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
          {backgrounds.map((bg) => {
            const active = (state.background || null) === bg.value;
            return (
              <button
                key={`${bg.label}-${bg.value}`}
                onClick={() => actions.setBackground(bg.value)}
                title={bg.label}
                className={`rounded-xl overflow-hidden border-2 text-left transition ${active ? 'border-accent' : 'border-transparent hover:border-line'}`}
              >
                <div
                  className="aspect-video bg-cover bg-center"
                  style={bg.image ? { backgroundImage: `url(${bg.image})` } : { background: bg.swatch || THEMES[season].background }}
                />
                <div className="px-2 py-1.5 text-xs bg-sunken truncate">{bg.label}</div>
              </button>
            );
          })}
        </div>
        <div className="mt-4">
          <div className="text-xs text-muted mb-1.5">Ukážka</div>
          <Preview state={{ ...state, isHidden: false }} song={sampleSong} page={0} />
        </div>
      </Card>
      <Card title="Otočenie obrazovky" subtitle="Pre televízor zavesený na výšku. Ak je text naopak, zvoľte druhú možnosť na výšku.">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2" role="radiogroup" aria-label="Otočenie obrazovky">
          {ROTATIONS.map((r) => {
            const active = rotation === r.value;
            const portrait = r.value === 90 || r.value === 270;
            return (
              <button
                key={r.value}
                role="radio"
                aria-checked={active}
                onClick={() => actions.setSettings({ rotation: r.value })}
                className={`rounded-xl border-2 p-3 flex flex-col items-center gap-2 transition ${active ? 'border-accent bg-accent/10' : 'border-line hover:border-accent/50'}`}
              >
                <span className="h-12 grid place-items-center">
                  <span
                    className={`grid place-items-center rounded-md border-2 ${active ? 'border-accent' : 'border-muted'} ${portrait ? 'w-7 h-12' : 'w-12 h-7'}`}
                  >
                    <span className="text-[10px] font-bold leading-none">Aa</span>
                  </span>
                </span>
                <span className="text-sm font-semibold">{r.label}</span>
                <span className="text-[11px] text-muted -mt-1.5">{r.hint}</span>
              </button>
            );
          })}
        </div>
      </Card>

      {tvControl && <TvCard />}
      <DeviceCard health={health} />
    </div>
  );
}
