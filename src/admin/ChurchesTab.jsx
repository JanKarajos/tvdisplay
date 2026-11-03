import React, { useState } from 'react';
import Card from '../components/Card';
import { adminApi, churchDataUrl } from './adminApi';
import InlineRename from './InlineRename';
import { toast } from '../lib/toast';

export default function ChurchesTab({ churches, onChanged, run }) {
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);

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
        subtitle="Adresu kostola zadáš pri inštalácii Orange Pi v tom kostole"
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
                  <code className="truncate">{churchDataUrl(c.id)}</code>
                  <button type="button" className="btn-icon !w-8 !h-8" title="Kopírovať adresu" aria-label="Kopírovať adresu" onClick={() => copy(churchDataUrl(c.id))}>⧉</button>
                </div>
              </div>
              <button onClick={() => remove(c)} className="btn-icon hover:!text-danger" title="Zmazať" aria-label={`Zmazať: ${c.name}`}>🗑</button>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
