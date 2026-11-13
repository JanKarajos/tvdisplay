import React, { useEffect, useState } from 'react';
import Card from '../Card';
import { tvApi } from '../../api/device';
import { toast } from '../../lib/toast';

const DAYS = [[1, 'Po'], [2, 'Ut'], [3, 'St'], [4, 'Št'], [5, 'Pi'], [6, 'So'], [0, 'Ne']];
const POWER = { on: ['zapnutý', 'text-ok'], standby: ['v pohotovosti', 'text-warn'], off: ['vypnutý alebo nedostupný', 'text-muted'] };

// Televízor Samsung cez Wi-Fi: zapnutie, vypnutie, otvorenie Laudate a program podľa omší
export default function TvCard() {
  const [data, setData] = useState(null);
  const [ip, setIp] = useState('');
  const [schedule, setSchedule] = useState([]);
  const [busy, setBusy] = useState(null);

  const load = async () => {
    try {
      const d = await tvApi.get();
      setData(d);
      setIp(d.config.ip || '');
      setSchedule(d.config.schedule || []);
    } catch {
      setData(false);
    }
  };
  useEffect(() => { load(); }, []);

  const save = async (patch, message) => {
    setBusy('save');
    try {
      const { config } = await tvApi.update(patch);
      setData((d) => ({ ...d, config }));
      if (message) toast(message, { tone: 'ok' });
    } catch (e) {
      toast(e.message, { tone: 'danger', duration: 6000 });
    }
    setBusy(null);
  };

  const run = async (action, done) => {
    setBusy(action);
    if (action === 'pair') toast('Na televízore potvrďte ovládačom „Povoliť“ pre Laudate', { duration: 15000 });
    try {
      const d = await tvApi.run(action);
      setData((old) => ({ ...old, ...d }));
      toast(done, { tone: 'ok' });
    } catch (e) {
      toast(e.message, { tone: 'danger', duration: 8000 });
    }
    setBusy(null);
    load();
  };

  if (data === false) return null; // starší server
  if (!data) return <Card title="Televízor"><div className="text-sm text-muted">Načítavam…</div></Card>;
  const { config, status } = data;
  const [powerText, powerClass] = POWER[status?.power] || ['neznámy', 'text-muted'];
  const scheduleDirty = JSON.stringify(schedule) !== JSON.stringify(config.schedule || []);

  const setItem = (i, patch) => setSchedule((list) => list.map((it, j) => (j === i ? { ...it, ...patch } : it)));
  const toggleDay = (i, day) => {
    const days = schedule[i].days.includes(day) ? schedule[i].days.filter((d) => d !== day) : [...schedule[i].days, day];
    setItem(i, { days });
  };

  return (
    <Card title="Televízor" subtitle="Samsung cez Wi-Fi – zapnutie, vypnutie a otvorenie Laudate bez diaľkového ovládača">
      <div className="space-y-4">
        <form
          className="flex flex-wrap items-end gap-2"
          onSubmit={(e) => { e.preventDefault(); save({ ip }, 'IP adresa televízora je uložená'); }}
        >
          <label className="text-xs text-muted flex-1 min-w-[10rem]">
            IP adresa televízora
            <input className="field mt-1 font-mono" value={ip} onChange={(e) => setIp(e.target.value)} placeholder="192.168.0.100" inputMode="decimal" />
          </label>
          <button className="btn" disabled={busy || ip === (config.ip || '')}>Uložiť</button>
        </form>

        {config.ip && (
          <>
            <div className="text-sm space-y-1">
              <div>Stav: <b className={powerClass}>{powerText}</b>{status?.model && <span className="text-muted"> · {status.model}</span>}</div>
              <div className="text-xs text-muted">
                Povolenie na TV: {config.paired ? <span className="text-ok font-semibold">áno</span> : 'zatiaľ nie – stlačte „Spárovať“, keď je TV zapnutá'}
                {' · '}MAC: {config.mac ? <span className="font-mono">{config.mac}</span> : 'zistí sa, keď bude TV zapnutá'}
              </div>
              {status?.lastError && <div className="text-xs text-warn">Posledná chyba: {status.lastError}</div>}
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <button className="btn-primary" disabled={Boolean(busy)} onClick={() => run('on', 'Televízor je zapnutý a ukazuje Laudate')}>{busy === 'on' ? 'Zapínam…' : '⏻ Zapnúť'}</button>
              <button className="btn" disabled={Boolean(busy)} onClick={() => run('off', 'Televízor je vypnutý')}>{busy === 'off' ? 'Vypínam…' : '⏼ Vypnúť'}</button>
              <button className="btn" disabled={Boolean(busy)} onClick={() => run('open', 'Laudate je otvorené na TV')}>{busy === 'open' ? 'Otváram…' : '↻ Otvoriť Laudate'}</button>
              <button className="btn" disabled={Boolean(busy)} onClick={() => run('pair', 'Televízor povolil ovládanie')}>{busy === 'pair' ? 'Čakám na TV…' : '🔗 Spárovať'}</button>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <div className="text-sm font-semibold">Program</div>
                  <div className="text-xs text-muted">V zvolené dni TV zapne a otvorí Laudate, po omši ju vypne.</div>
                </div>
                <label className="flex items-center gap-2 text-sm font-semibold cursor-pointer">
                  <input type="checkbox" className="w-5 h-5" checked={Boolean(config.enabled)} onChange={(e) => save({ enabled: e.target.checked }, e.target.checked ? 'Program je zapnutý' : 'Program je vypnutý')} />
                  Zapnutý
                </label>
              </div>
              {schedule.map((item, i) => (
                <div key={i} className="p-2 rounded-xl bg-sunken space-y-2">
                  <div className="flex flex-wrap gap-1">
                    {DAYS.map(([d, label]) => (
                      <button
                        key={d}
                        type="button"
                        onClick={() => toggleDay(i, d)}
                        className={`w-10 h-9 rounded-lg text-xs font-semibold ${item.days.includes(d) ? 'bg-accent text-on-accent' : 'bg-surface'}`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                  <div className="flex flex-wrap items-end gap-2">
                    <label className="text-xs text-muted">Zapnúť<input type="time" className="field mt-1 w-32" value={item.on} onChange={(e) => setItem(i, { on: e.target.value })} /></label>
                    <label className="text-xs text-muted">Vypnúť<input type="time" className="field mt-1 w-32" value={item.off} onChange={(e) => setItem(i, { off: e.target.value })} /></label>
                    <button type="button" className="btn-icon ml-auto hover:!text-danger" aria-label="Odstrániť" onClick={() => setSchedule((l) => l.filter((_, j) => j !== i))}>🗑</button>
                  </div>
                </div>
              ))}
              <div className="flex flex-wrap gap-2">
                <button type="button" className="btn" onClick={() => setSchedule((l) => [...l, { days: [0], on: '08:45', off: '10:15' }])}>+ Pridať čas</button>
                {scheduleDirty && <button type="button" className="btn-primary" disabled={Boolean(busy)} onClick={() => save({ schedule }, 'Program je uložený')}>Uložiť program</button>}
              </div>
            </div>

            <details className="text-xs text-muted">
              <summary className="cursor-pointer font-semibold">Nastavenie televízora (raz)</summary>
              <ol className="list-decimal pl-5 mt-2 space-y-1">
                <li>TV a zariadenie Laudate musia byť v tej istej sieti. V routeri nastavte TV stálu IP adresu.</li>
                <li>V TV zapnite: Nastavenia → Všeobecné → Sieť → Expertné nastavenia → <b>Zapnúť s mobilným zariadením</b> (Power On with Mobile).</li>
                <li>Pri zapnutej TV stlačte <b>Spárovať</b> a na TV potvrďte ovládačom <b>Povoliť</b>.</li>
                <li>Skúste Vypnúť a Zapnúť. Funguje na televízoroch Samsung s Tizen (od roku 2016).</li>
              </ol>
            </details>
          </>
        )}
      </div>
    </Card>
  );
}
