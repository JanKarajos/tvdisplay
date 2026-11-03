import React, { useCallback, useEffect, useState } from 'react';
import Toaster from '../components/Toaster';
import { useUiTheme } from '../hooks/useUiTheme';
import { toast } from '../lib/toast';
import { SERVER_URL } from '../config';
import { adminApi, setUnauthorizedHandler } from './adminApi';
import SongsTab from './SongsTab';
import CategoriesTab from './CategoriesTab';
import { ImagesTab, PdfsTab } from './MediaTabs';
import ChurchesTab from './ChurchesTab';
import UsersTab from './UsersTab';

const THEME_ICON = { system: '◐', dark: '☾', light: '☀' };
const THEME_LABEL = { system: 'Podľa systému', dark: 'Tmavý režim', light: 'Svetlý režim' };

const CHURCH_TABS = [
  ['songs', 'Piesne'],
  ['categories', 'Kategórie'],
  ['images', 'Obrázky'],
  ['pdfs', 'Prezentácie'],
];
const ADMIN_TABS = [
  ['churches', 'Kostoly'],
  ['users', 'Používatelia'],
];

function Logo() {
  return (
    <div className="flex items-center gap-2">
      <span className="w-8 h-8 rounded-lg bg-accent text-on-accent grid place-items-center font-bold">♪</span>
      <span className="font-bold tracking-tight">SongDisplay</span>
    </div>
  );
}

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
    <div className="min-h-screen flex items-center justify-center p-4">
      <form onSubmit={submit} className="bg-surface border border-line rounded-2xl shadow-sm p-6 w-full max-w-sm space-y-3">
        <Logo />
        <h1 className="font-bold text-lg pt-2">Administrácia kostolov</h1>
        <label className="block text-xs text-muted">
          Meno
          <input className="field mt-1" value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" autoFocus required />
        </label>
        <label className="block text-xs text-muted">
          Heslo
          <input className="field mt-1" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required />
        </label>
        {error && <div className="text-sm text-danger">{error}</div>}
        <button className="btn-primary w-full" disabled={busy}>{busy ? 'Prihlasujem…' : 'Prihlásiť sa'}</button>
      </form>
    </div>
  );
}

function ChangePassword({ run, onDone }) {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const submit = async (e) => {
    e.preventDefault();
    if (await run(() => adminApi.changePassword(currentPassword, newPassword), 'Heslo je zmenené')) onDone();
  };
  return (
    <form onSubmit={submit} className="bg-surface border border-line rounded-2xl p-4 shadow-sm flex flex-wrap items-end gap-2">
      <label className="text-xs text-muted flex-1 min-w-[12rem]">
        Súčasné heslo
        <input className="field mt-1" type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} autoComplete="current-password" required />
      </label>
      <label className="text-xs text-muted flex-1 min-w-[12rem]">
        Nové heslo (min. 8 znakov)
        <input className="field mt-1" type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} autoComplete="new-password" minLength={8} required />
      </label>
      <button className="btn-primary">Zmeniť heslo</button>
      <button type="button" className="btn" onClick={onDone}>Zrušiť</button>
    </form>
  );
}

function readChurch() {
  try {
    return localStorage.getItem('tvdisplay-admin-church') || '';
  } catch {
    return '';
  }
}

export default function AdminPage() {
  const { mode: uiTheme, cycle: cycleUiTheme } = useUiTheme();
  const [user, setUser] = useState(undefined); // undefined = zisťujem, null = neprihlásený
  const [churches, setChurches] = useState([]);
  const [churchId, setChurchId] = useState(readChurch);
  const [tab, setTab] = useState('songs');
  const [changingPassword, setChangingPassword] = useState(false);
  const [canConvert, setCanConvert] = useState(false);

  const loadMe = useCallback(async () => {
    try {
      const data = await adminApi.me();
      setUser(data.user);
      setChurches(data.churches);
      // Posledný vybraný kostol, ak k nemu má používateľ prístup, inak prvý dostupný
      setChurchId((current) => (data.churches.some((c) => c.id === current) ? current : data.churches[0]?.id || ''));
    } catch {
      setUser(null);
    }
  }, []);

  useEffect(() => {
    setUnauthorizedHandler(() => setUser(null));
    loadMe();
    fetch(`${SERVER_URL}/health`).then((r) => r.json()).then((h) => setCanConvert(Boolean(h.converter?.powerpoint))).catch(() => {});
  }, [loadMe]);

  useEffect(() => {
    try {
      if (churchId) localStorage.setItem('tvdisplay-admin-church', churchId);
    } catch {
      // ignoruj
    }
  }, [churchId]);

  // Spustí akciu a oznámi výsledok; vráti true pri úspechu
  const run = useCallback(async (action, successText) => {
    try {
      await action();
      if (successText) toast(successText, { tone: 'ok' });
      return true;
    } catch (err) {
      toast(err.message, { tone: 'danger', duration: 6000 });
      return false;
    }
  }, []);

  const logout = async () => {
    await adminApi.logout().catch(() => {});
    setUser(null);
  };

  if (user === undefined) return <div className="p-6 text-sm text-muted">Načítavam…</div>;
  if (user === null) return <LoginForm onLogin={loadMe} />;

  const isAdmin = user.role === 'admin';
  const tabs = isAdmin ? [...CHURCH_TABS, ...ADMIN_TABS] : CHURCH_TABS;
  // Po prihlásení iného používateľa (napr. editora po administrátorovi) nemusí mať záložku, ktorá bola otvorená
  const activeTab = tabs.some(([id]) => id === tab) ? tab : 'songs';
  const isChurchTab = CHURCH_TABS.some(([id]) => id === activeTab);
  const church = churches.find((c) => c.id === churchId);

  return (
    <div className="min-h-screen pb-24">
      <header className="sticky top-0 z-30 bg-surface/90 backdrop-blur border-b border-line">
        <div className="max-w-7xl mx-auto px-3 sm:px-4 flex flex-wrap items-center gap-x-4">
          <div className="flex items-center gap-3 h-14 mr-auto">
            <Logo />
            <span className="text-sm text-muted hidden sm:inline">Administrácia</span>
          </div>
          <nav className="order-last lg:order-none w-full lg:w-auto flex gap-1 -mx-1 pb-2 lg:pb-0 overflow-x-auto" aria-label="Sekcie">
            {tabs.map(([id, text]) => (
              <button
                key={id}
                onClick={() => setTab(id)}
                aria-current={activeTab === id ? 'page' : undefined}
                className={`shrink-0 min-h-[40px] px-4 rounded-xl text-sm font-semibold transition ${activeTab === id ? 'bg-accent/15 text-accent' : 'text-muted hover:text-fg hover:bg-sunken'}`}
              >
                {text}
              </button>
            ))}
          </nav>
          <div className="flex items-center gap-1 h-14">
            <span className="px-2 text-sm text-muted" title={isAdmin ? 'Administrátor' : 'Editor'}>
              {user.username}
            </span>
            <button onClick={() => setChangingPassword((v) => !v)} className="btn-icon" title="Zmeniť heslo" aria-label="Zmeniť heslo">🔑</button>
            <button onClick={cycleUiTheme} className="btn-icon text-lg" title={THEME_LABEL[uiTheme]} aria-label={THEME_LABEL[uiTheme]}>
              {THEME_ICON[uiTheme]}
            </button>
            <button onClick={logout} className="btn !min-h-[36px]">Odhlásiť</button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-3 sm:p-4 space-y-4">
        {changingPassword && <ChangePassword run={run} onDone={() => setChangingPassword(false)} />}

        {isChurchTab && churches.length > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted">Kostol:</span>
            {churches.length === 1 ? (
              <span className="font-bold">{church?.name}</span>
            ) : (
              <select className="field !w-auto font-semibold" value={churchId} onChange={(e) => setChurchId(e.target.value)} aria-label="Kostol">
                {churches.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            )}
          </div>
        )}

        {isChurchTab && !churchId && (
          <div className="p-3 rounded-xl bg-warn/10 border border-warn/30 text-sm text-warn">
            {isAdmin ? 'Zatiaľ nie je vytvorený žiadny kostol. Pridaj ho v záložke Kostoly.' : 'Nemáš priradený žiadny kostol. Požiadaj administrátora.'}
          </div>
        )}
        {isChurchTab && churchId && (
          <>
            {activeTab === 'songs' && <SongsTab key={churchId} churchId={churchId} run={run} />}
            {activeTab === 'categories' && <CategoriesTab key={churchId} churchId={churchId} run={run} />}
            {activeTab === 'images' && <ImagesTab key={churchId} churchId={churchId} run={run} />}
            {activeTab === 'pdfs' && <PdfsTab key={churchId} churchId={churchId} run={run} canConvert={canConvert} />}
          </>
        )}
        {activeTab === 'churches' && isAdmin && <ChurchesTab churches={churches} onChanged={loadMe} run={run} />}
        {activeTab === 'users' && isAdmin && <UsersTab churches={churches} currentUser={user} run={run} />}
      </main>
      <Toaster />
    </div>
  );
}
