import React, { useCallback, useEffect, useState } from 'react';
import { adminApi, setUnauthorizedHandler } from './adminApi';
import { Button, Input, Select, Field } from './ui';
import SongsTab from './SongsTab';
import CategoriesTab from './CategoriesTab';
import { ImagesTab, PdfsTab } from './MediaTabs';
import ChurchesTab from './ChurchesTab';
import UsersTab from './UsersTab';

function LoginForm({ onLogin }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await adminApi.login(username, password);
      await onLogin();
    } catch (err) {
      setError(err.message);
    }
    setBusy(false);
  };

  return (
    <div className="flex justify-center pt-12">
      <form className="bg-white border rounded p-6 shadow-sm w-full max-w-sm space-y-3" onSubmit={submit}>
        <div className="text-lg font-semibold">Prihlásenie do administrácie</div>
        <Field label="Meno">
          <Input className="w-full" value={username} onChange={e => setUsername(e.target.value)} autoComplete="username" autoFocus required />
        </Field>
        <Field label="Heslo">
          <Input className="w-full" type="password" value={password} onChange={e => setPassword(e.target.value)} autoComplete="current-password" required />
        </Field>
        {error && <div className="text-sm text-red-600">{error}</div>}
        <Button type="submit" variant="primary" className="w-full" disabled={busy}>{busy ? 'Prihlasujem...' : 'Prihlásiť sa'}</Button>
      </form>
    </div>
  );
}

function ChangePasswordForm({ run, onDone }) {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const submit = async (e) => {
    e.preventDefault();
    const ok = await run(() => adminApi.changePassword(currentPassword, newPassword), 'Heslo je zmenené');
    if (ok) onDone();
  };
  return (
    <form className="bg-white border rounded p-4 shadow-sm flex flex-wrap gap-2 items-end mb-4" onSubmit={submit}>
      <Field label="Súčasné heslo">
        <Input type="password" value={currentPassword} onChange={e => setCurrentPassword(e.target.value)} autoComplete="current-password" required />
      </Field>
      <Field label="Nové heslo (min. 8 znakov)">
        <Input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} autoComplete="new-password" minLength={8} required />
      </Field>
      <Button type="submit" variant="primary">Zmeniť heslo</Button>
      <Button onClick={onDone}>Zrušiť</Button>
    </form>
  );
}

const CHURCH_TABS = [
  { id: 'songs', label: 'Piesne' },
  { id: 'categories', label: 'Kategórie' },
  { id: 'images', label: 'Obrázky' },
  { id: 'pdfs', label: 'Prezentácie (PDF)' },
];
const ADMIN_TABS = [
  { id: 'churches', label: 'Kostoly' },
  { id: 'users', label: 'Používatelia' },
];

export default function AdminPage() {
  const [user, setUser] = useState(undefined); // undefined = zisťujem, null = neprihlásený
  const [churches, setChurches] = useState([]);
  const [churchId, setChurchId] = useState(() => localStorage.getItem('tvdisplay-admin-church') || '');
  const [tab, setTab] = useState('songs');
  const [message, setMessage] = useState(null); // { type: 'ok' | 'error', text }
  const [changingPassword, setChangingPassword] = useState(false);

  const loadMe = useCallback(async () => {
    try {
      const data = await adminApi.me();
      setUser(data.user);
      setChurches(data.churches);
      // Vyber uložený kostol, ak k nemu má používateľ prístup, inak prvý dostupný
      setChurchId(current => (data.churches.some(c => c.id === current) ? current : data.churches[0]?.id || ''));
    } catch {
      setUser(null);
    }
  }, []);

  useEffect(() => {
    setUnauthorizedHandler(() => setUser(null));
    loadMe();
  }, [loadMe]);

  useEffect(() => {
    if (churchId) localStorage.setItem('tvdisplay-admin-church', churchId);
  }, [churchId]);

  // Spustí akciu a zobrazí výsledok; vráti true pri úspechu
  const run = useCallback(async (action, successText) => {
    try {
      await action();
      if (successText) setMessage({ type: 'ok', text: successText });
      return true;
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
      return false;
    }
  }, []);

  useEffect(() => {
    if (!message) return undefined;
    const timer = setTimeout(() => setMessage(null), message.type === 'ok' ? 3000 : 8000);
    return () => clearTimeout(timer);
  }, [message]);

  const logout = async () => {
    await adminApi.logout().catch(() => {});
    setUser(null);
  };

  if (user === undefined) return <div className="text-sm text-gray-500">Načítavam...</div>;
  if (user === null) return <LoginForm onLogin={loadMe} />;

  const isAdmin = user.role === 'admin';
  const tabs = isAdmin ? [...CHURCH_TABS, ...ADMIN_TABS] : CHURCH_TABS;
  const isChurchTab = CHURCH_TABS.some(t => t.id === tab);

  return (
    <div className="max-w-7xl mx-auto">
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="text-xl font-semibold mr-auto">Administrácia</div>
        <span className="text-sm text-gray-600">
          {user.username} · {isAdmin ? 'administrátor' : 'editor'}
        </span>
        <Button onClick={() => setChangingPassword(v => !v)}>Zmeniť heslo</Button>
        <Button onClick={logout}>Odhlásiť</Button>
      </div>

      {changingPassword && <ChangePasswordForm run={run} onDone={() => setChangingPassword(false)} />}

      {message && (
        <div className={`mb-4 p-2 rounded text-sm border ${message.type === 'ok' ? 'bg-green-50 border-green-200 text-green-800' : 'bg-red-50 border-red-200 text-red-800'}`}>
          {message.text}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2 mb-4 border-b pb-2">
        {tabs.map(t => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`px-3 py-1.5 text-sm rounded ${tab === t.id ? 'bg-blue-500 text-white' : 'hover:bg-gray-100'}`}
          >
            {t.label}
          </button>
        ))}
        {isChurchTab && churches.length > 0 && (
          <div className="ml-auto flex items-center gap-2 text-sm">
            <span className="text-gray-600">Kostol:</span>
            {churches.length === 1 ? (
              <span className="font-medium">{churches[0].name}</span>
            ) : (
              <Select value={churchId} onChange={e => setChurchId(e.target.value)}>
                {churches.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </Select>
            )}
          </div>
        )}
      </div>

      {isChurchTab && !churchId && (
        <div className="p-3 bg-yellow-50 border border-yellow-200 rounded text-sm text-yellow-800">
          {isAdmin ? 'Zatiaľ nie je vytvorený žiadny kostol. Pridaj ho v záložke Kostoly.' : 'Nemáš priradený žiadny kostol. Požiadaj administrátora.'}
        </div>
      )}
      {isChurchTab && churchId && (
        <>
          {tab === 'songs' && <SongsTab key={churchId} churchId={churchId} run={run} />}
          {tab === 'categories' && <CategoriesTab key={churchId} churchId={churchId} run={run} />}
          {tab === 'images' && <ImagesTab key={churchId} churchId={churchId} run={run} />}
          {tab === 'pdfs' && <PdfsTab key={churchId} churchId={churchId} run={run} />}
        </>
      )}
      {tab === 'churches' && isAdmin && <ChurchesTab churches={churches} onChanged={loadMe} run={run} />}
      {tab === 'users' && isAdmin && <UsersTab churches={churches} currentUser={user} run={run} />}
    </div>
  );
}
