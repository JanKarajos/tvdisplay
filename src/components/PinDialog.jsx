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
      <form onSubmit={submit} className="bg-white rounded-xl shadow-xl p-6 w-full max-w-xs space-y-3">
        <h2 className="font-semibold">Zadaj PIN na ovládanie</h2>
        <input
          autoFocus
          type="password"
          inputMode="numeric"
          value={value}
          onChange={(e) => { setValue(e.target.value); setError(''); }}
          className="w-full border rounded-md px-3 py-2 text-lg tracking-widest text-center"
        />
        {error && <div className="text-sm text-red-600">{error}</div>}
        <button className="w-full py-2 bg-blue-600 text-white rounded-md font-medium">Pokračovať</button>
      </form>
    </div>
  );
}
