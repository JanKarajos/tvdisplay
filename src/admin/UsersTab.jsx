import React, { useEffect, useState } from 'react';
import Card from '../components/Card';
import { adminApi } from './adminApi';

const EMPTY_USER = { username: '', password: '', role: 'editor', churchId: '' };

export default function UsersTab({ churches, currentUser, run }) {
  const [users, setUsers] = useState([]);
  const [form, setForm] = useState(EMPTY_USER);

  useEffect(() => {
    adminApi.listUsers().then(setUsers).catch(() => {});
  }, []);

  const add = async (e) => {
    e.preventDefault();
    let created;
    if (await run(async () => { created = await adminApi.createUser(form); }, `Vytvorený používateľ: ${form.username}`)) {
      setUsers((list) => [...list, created]);
      setForm({ ...EMPTY_USER, churchId: form.churchId });
    }
  };

  const update = async (user, fields, message) => {
    let updated;
    if (await run(async () => { updated = await adminApi.updateUser(user.id, fields); }, message)) {
      setUsers((list) => list.map((u) => (u.id === user.id ? updated : u)));
    }
  };

  const resetPassword = (user) => {
    const password = window.prompt(`Nové heslo pre „${user.username}“ (aspoň 8 znakov):`);
    if (password) update(user, { password }, 'Heslo je zmenené');
  };

  const changeRole = (user, role) => {
    if (role === 'editor' && !churches.length) return window.alert('Najprv vytvor kostol.');
    update(user, role === 'editor' ? { role, churchId: user.churchId || churches[0].id } : { role }, 'Rola je zmenená');
  };

  const remove = async (user) => {
    if (!window.confirm(`Naozaj zmazať používateľa „${user.username}“?`)) return;
    if (await run(() => adminApi.deleteUser(user.id), `Zmazané: ${user.username}`)) {
      setUsers((list) => list.filter((u) => u.id !== user.id));
    }
  };

  return (
    <div className="space-y-4 max-w-4xl">
      <Card title="Nový používateľ" subtitle="Editor spravuje iba priradený kostol, administrátor všetky kostoly aj používateľov">
        <form className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_10rem_1fr_auto] gap-2 items-end" onSubmit={add}>
          <label className="text-xs text-muted">
            Prihlasovacie meno
            <input className="field mt-1" value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} required maxLength={60} autoComplete="off" />
          </label>
          <label className="text-xs text-muted">
            Heslo (min. 8 znakov)
            <input className="field mt-1" type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required minLength={8} autoComplete="new-password" />
          </label>
          <label className="text-xs text-muted">
            Rola
            <select className="field mt-1" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
              <option value="editor">Editor</option>
              <option value="admin">Administrátor</option>
            </select>
          </label>
          <label className="text-xs text-muted">
            Kostol
            <select
              className="field mt-1"
              value={form.role === 'admin' ? '' : form.churchId}
              onChange={(e) => setForm({ ...form, churchId: e.target.value })}
              disabled={form.role === 'admin'}
              required={form.role !== 'admin'}
            >
              <option value="">{form.role === 'admin' ? 'všetky kostoly' : 'Vyber kostol…'}</option>
              {churches.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </label>
          <button className="btn-primary">Vytvoriť</button>
        </form>
      </Card>

      <Card title="Používatelia">
        <div className="divide-y divide-line">
          {users.map((u) => (
            <div key={u.id} className="py-2 flex flex-wrap items-center gap-2">
              <div className="flex-1 min-w-[8rem] font-semibold">
                {u.username}
                {u.id === currentUser.id && <span className="text-xs text-muted font-normal"> (ty)</span>}
              </div>
              <select className="field !w-40" value={u.role} disabled={u.id === currentUser.id} onChange={(e) => changeRole(u, e.target.value)} aria-label={`Rola: ${u.username}`}>
                <option value="editor">Editor</option>
                <option value="admin">Administrátor</option>
              </select>
              {u.role === 'admin' ? (
                <span className="w-56 text-sm text-muted px-3">všetky kostoly</span>
              ) : (
                <select className={`field !w-56 ${u.churchId ? '' : '!border-danger'}`} value={u.churchId || ''} onChange={(e) => update(u, { churchId: e.target.value }, 'Kostol je zmenený')} aria-label={`Kostol: ${u.username}`}>
                  {!u.churchId && <option value="">— priraď kostol —</option>}
                  {churches.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              )}
              <button className="btn" onClick={() => resetPassword(u)}>Zmeniť heslo</button>
              {u.id !== currentUser.id && (
                <button onClick={() => remove(u)} className="btn-icon hover:!text-danger" title="Zmazať" aria-label={`Zmazať: ${u.username}`}>🗑</button>
              )}
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
