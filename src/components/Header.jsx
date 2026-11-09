import React from 'react';

const STATUS = {
  online: ['bg-ok', 'Pripojené'],
  connecting: ['bg-warn animate-pulse', 'Pripájam…'],
  offline: ['bg-danger animate-pulse', 'Offline – zmeny sa nedostanú na TV'],
};

const THEME_ICON = { system: '◐', dark: '☾', light: '☀' };
const THEME_LABEL = { system: 'Podľa systému', dark: 'Tmavý režim', light: 'Svetlý režim' };

export const TABS = [
  ['mass', 'Omša'],
  ['screen', 'Obrazovka'],
  ['content', 'Obsah'],
];

export default function Header({ status, clients, tab, onTab, uiTheme, onCycleTheme }) {
  const [dot, label] = STATUS[status] || STATUS.connecting;
  return (
    <header className="sticky top-0 z-30 bg-surface/90 backdrop-blur border-b border-line">
      <div className="max-w-7xl mx-auto px-3 sm:px-4 flex flex-wrap items-center gap-x-4">
        <div className="flex items-center gap-2 h-14 mr-auto">
          <span className="w-8 h-8 rounded-lg bg-accent text-on-accent grid place-items-center font-bold">♪</span>
          <span className="font-bold tracking-tight">Laudate</span>
        </div>

        <nav className="order-last sm:order-none w-full sm:w-auto flex gap-1 -mx-1 pb-2 sm:pb-0" aria-label="Sekcie">
          {TABS.map(([id, text]) => (
            <button
              key={id}
              onClick={() => onTab(id)}
              aria-current={tab === id ? 'page' : undefined}
              className={`flex-1 sm:flex-none min-h-[40px] px-4 rounded-xl text-sm font-semibold transition ${tab === id ? 'bg-accent/15 text-accent' : 'text-muted hover:text-fg hover:bg-sunken'}`}
            >
              {text}
            </button>
          ))}
        </nav>

        <div className="flex items-center gap-1 h-14">
          <span className="flex items-center gap-2 px-2 text-sm text-muted" title={clients != null ? `${label} · pripojených zariadení: ${clients}` : label}>
            <span className={`w-2.5 h-2.5 rounded-full ${dot}`} />
            <span className="hidden lg:inline">{label}</span>
          </span>
          <button onClick={onCycleTheme} className="btn-icon text-lg" title={THEME_LABEL[uiTheme]} aria-label={THEME_LABEL[uiTheme]}>
            {THEME_ICON[uiTheme]}
          </button>
          <a className="btn-icon" href="#display" target="_blank" rel="noreferrer" title="Otvoriť obrazovku TV" aria-label="Otvoriť obrazovku TV">
            ⧉
          </a>
        </div>
      </div>
    </header>
  );
}
