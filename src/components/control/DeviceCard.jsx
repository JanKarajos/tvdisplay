import React, { useState } from 'react';
import Card from '../Card';
import { SERVER_URL } from '../../config';
import { markAuthRequired, writeHeaders } from '../../api/stateClient';
import { toast } from '../../lib/toast';

const ACTIONS = {
  'restart-app': {
    label: 'Reštartovať aplikáciu',
    hint: 'Server aj obrazovka na TV sa spustia znova (asi 20 s).',
    confirm: 'Reštartovať aplikáciu? TV bude na chvíľu prázdna.',
    done: 'Aplikácia sa reštartuje, o chvíľu sa znova pripojí.',
  },
  reboot: {
    label: 'Reštartovať Orange Pi',
    hint: 'Celé zariadenie sa vypne a znova zapne (1–2 minúty).',
    confirm: 'Reštartovať celé zariadenie v kostole? TV bude 1–2 minúty prázdna.',
    done: 'Zariadenie sa reštartuje. Ovládanie sa pripojí samo, keď nabehne.',
  },
};

// Reštart aplikácie a zariadenia na diaľku (to isté robia fyzické tlačidlá pri Orange Pi)
export default function DeviceCard({ health }) {
  const [busy, setBusy] = useState(null);
  const available = Boolean(health?.system?.actions);

  const run = async (action) => {
    const a = ACTIONS[action];
    if (!window.confirm(a.confirm)) return;
    setBusy(action);
    try {
      const res = await fetch(`${SERVER_URL}/api/system/${action}`, { method: 'POST', headers: writeHeaders() });
      if (res.status === 401) {
        markAuthRequired();
        throw new Error('Je potrebný PIN');
      }
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || `Chyba ${res.status}`);
      toast(a.done, { tone: 'ok', duration: 6000 });
    } catch (e) {
      toast(e.message || 'Zariadenie neodpovedá', { tone: 'danger', duration: 6000 });
    }
    setBusy(null);
  };

  return (
    <Card title="Zariadenie v kostole" subtitle="Keď sa niečo zasekne: reštart aplikácie alebo celého Orange Pi">
      {!available && (
        <div className="text-sm text-muted mb-3">
          Na tomto zariadení reštart z ovládania nie je zapnutý. Zapne ho nový inštalátor Laudate.
        </div>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {Object.entries(ACTIONS).map(([id, a]) => (
          <button key={id} onClick={() => run(id)} disabled={!available || Boolean(busy)} className={`btn h-auto py-3 flex-col items-start text-left ${id === 'reboot' ? '!border-danger/40' : ''}`}>
            <span className="font-semibold">{busy === id ? 'Posielam…' : a.label}</span>
            <span className="text-xs text-muted font-normal">{a.hint}</span>
          </button>
        ))}
      </div>
    </Card>
  );
}
