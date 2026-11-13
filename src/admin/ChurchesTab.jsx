import React, { useEffect, useState } from 'react';
import Card from '../components/Card';
import { adminApi, churchDataUrl } from './adminApi';
import InlineRename from './InlineRename';
import { toast } from '../lib/toast';

// Čo sa dá na zariadení v kostole robiť – zariadenie si zmenu stiahne do minúty;
// balíky pre novo zapnutú funkciu doinštaluje najbližšia aktualizácia (inštalátor)
function ChurchFeatures({ church, run }) {
  const [data, setData] = useState(null);
  useEffect(() => {
    let alive = true;
    adminApi.churchFeatures(church.id).then((d) => alive && setData(d)).catch((e) => toast(e.message, { tone: 'danger' }));
    return () => { alive = false; };
  }, [church.id]);

  if (!data) return <div className="text-xs text-muted py-2">Načítavam…</div>;
  const toggle = async (id, value) => {
    let result;
    const ok = await run(async () => { result = await adminApi.setChurchFeatures(church.id, { [id]: value }); }, 'Uložené – zariadenie sa zmení do minúty');
    if (ok && result) setData(result);
  };
  return (
    <div className="w-full mt-1 p-3 rounded-xl bg-sunken space-y-2">
      <div className="text-xs text-muted">Funkcie na zariadení v tomto kostole. Vypnutá funkcia sa v ovládaní nezobrazí a inštalátor nestiahne jej balíky; novo zapnutú doinštaluje najbližšia aktualizácia.</div>
      {data.list.map((f) => {
        const disabled = f.id === 'powerpoint' && !data.features.presentations;
        return (
          <label key={f.id} className={`flex items-start gap-3 ${disabled ? 'opacity-50' : 'cursor-pointer'}`}>
            <input type="checkbox" className="mt-0.5 w-5 h-5 shrink-0" checked={Boolean(data.features[f.id])} disabled={disabled} onChange={(e) => toggle(f.id, e.target.checked)} />
            <span>
              <span className="block text-sm font-semibold">{f.label}</span>
              <span className="block text-xs text-muted">{f.hint}</span>
            </span>
          </label>
        );
      })}
    </div>
  );
}

export default function ChurchesTab({ churches, shareName, onChanged, run }) {
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [openFeatures, setOpenFeatures] = useState(null);

  const add = async (e) => {
    e.preventDefault();
    if (await run(() => adminApi.createChurch(name), `Pridaný kostol: ${name}`)) {
      setName('');
      onChanged();
    }
  };

  // Doplní chýbajúce piesne JKS do všetkých kostolov; upravené piesne ostanú
  const addJks = async () => {
    setBusy(true);
    let result;
    await run(async () => { result = await adminApi.addJksToAll(); });
    setBusy(false);
    if (result) toast(result.total ? `Doplnených ${result.total} piesní JKS` : 'Všetky kostoly už majú všetky piesne JKS', { tone: 'ok', duration: 4000 });
  };

  const rename = async (church, newName) => {
    const ok = await run(() => adminApi.renameChurch(church.id, newName), 'Kostol je premenovaný');
    if (ok) onChanged();
    return ok;
  };

  const remove = async (church) => {
    if (!window.confirm(`Naozaj zmazať kostol „${church.name}“?\n\nJeho piesne, obrázky a prezentácie sa presunú na serveri do priečinka deleted/.`)) return;
    if (await run(() => adminApi.deleteChurch(church.id), `Zmazané: ${church.name}`)) onChanged();
  };

  const copy = async (text) => {
    try {
      await navigator.clipboard.writeText(text);
      toast('Adresa je skopírovaná', { tone: 'ok' });
    } catch {
      window.prompt('Skopíruj adresu:', text);
    }
  };

  return (
    <div className="space-y-4 max-w-4xl">
      <Card title="Nový kostol">
        <form className="space-y-2" onSubmit={add}>
          <div className="flex gap-2">
            <input className="field" placeholder="Názov, napr. Kostol sv. Martina" value={name} onChange={(e) => setName(e.target.value)} maxLength={100} />
            <button className="btn-primary" disabled={!name.trim()}>Pridať</button>
          </div>
          <p className="text-xs text-muted">Kostol dostane vlastnú kópiu všetkých piesní zo spevníka JKS, ktorú môže ľubovoľne upravovať.</p>
        </form>
      </Card>

      <Card
        title="Kostoly"
        subtitle={shareName
          ? `Každý kostol je priečinok v zdieľanom priečinku ${shareName} na NAS. Adresu zadáš pri inštalácii Orange Pi (--nas-url); cez Tailscale namiesto IP použi názov NAS.`
          : 'Adresu kostola zadáš pri inštalácii Orange Pi v tom kostole'}
        actions={
          <button className="btn" onClick={addJks} disabled={busy || !churches.length} title="Pridá do každého kostola piesne JKS, ktoré mu chýbajú. Upravené piesne sa neprepíšu.">
            {busy ? 'Dopĺňam…' : 'Doplniť piesne JKS'}
          </button>
        }
      >
        {!churches.length && <div className="text-sm text-muted">Zatiaľ žiadne kostoly.</div>}
        <div className="divide-y divide-line">
          {churches.map((c) => (
            <div key={c.id} className="py-2 flex flex-wrap items-center gap-2">
              <div className="flex-1 min-w-[14rem]">
                <InlineRename value={c.name} onSave={(n) => rename(c, n)} className="font-semibold" />
                <div className="flex items-center gap-1 text-xs text-muted">
                  <code className="truncate">{churchDataUrl(c.id, shareName)}</code>
                  <button type="button" className="btn-icon !w-8 !h-8" title="Kopírovať adresu" aria-label="Kopírovať adresu" onClick={() => copy(churchDataUrl(c.id, shareName))}>⧉</button>
                </div>
              </div>
              <button onClick={() => setOpenFeatures(openFeatures === c.id ? null : c.id)} className="btn !min-h-[36px] !px-3 text-xs" aria-expanded={openFeatures === c.id}>
                ⚙ Funkcie {openFeatures === c.id ? '▴' : '▾'}
              </button>
              <button onClick={() => remove(c)} className="btn-icon hover:!text-danger" title="Zmazať" aria-label={`Zmazať: ${c.name}`}>🗑</button>
              {openFeatures === c.id && <ChurchFeatures church={c} run={run} />}
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
