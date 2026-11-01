import React, { useState } from 'react';
import { SERVER_URL } from '../config';
import { setPin } from '../api/stateClient';

export default function PinDialog() {
  const [value, setValue] = useState('');
  const [error, setError] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch(`${SERVER_URL}/api/auth/check`, { method: 'POST', headers: { 'X-Control-Pin': value } });
      if (!res.ok) {
        setError('Nesprávny PIN');
        return;
      }
      setPin(value);
    } catch {
      setError('Server nie je dostupný');
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <form onSubmit={submit} className="bg-surface text-fg rounded-2xl shadow-xl border border-line p-6 w-full max-w-xs space-y-3">
        <h2 className="font-semibold">Zadaj PIN na ovládanie</h2>
        <input
          autoFocus
          type="password"
          inputMode="numeric"
          value={value}
          onChange={(e) => { setValue(e.target.value); setError(''); }}
          className="field text-lg tracking-widest text-center"
        />
        {error && <div className="text-sm text-danger">{error}</div>}
        <button className="btn-primary w-full">Pokračovať</button>
      </form>
    </div>
  );
}
