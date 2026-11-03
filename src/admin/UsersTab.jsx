import React, { useEffect, useState } from 'react';
import { adminApi } from './adminApi';
import { Button, Input, Select, Field } from './ui';

const EMPTY_USER = { username: '', password: '', role: 'editor', churchId: '' };

export default function UsersTab({ churches, currentUser, run }) {
  const [users, setUsers] = useState([]);
  const [form, setForm] = useState(EMPTY_USER);

  useEffect(() => {
    adminApi.listUsers().then(setUsers).catch(() => {});
  }, []);

  const add = async (e) => {
    e.preventDefault();
    await run(async () => {
      const created = await adminApi.createUser(form);
      setUsers(list => [...list, created]);
      setForm({ ...EMPTY_USER, churchId: form.churchId });
    }, 'Používateľ je vytvorený');
  };

  const update = (user, fields, message) => run(async () => {
    const updated = await adminApi.updateUser(user.id, fields);
    setUsers(list => list.map(u => (u.id === user.id ? updated : u)));
  }, message);

  const resetPassword = async (user) => {
    const password = window.prompt(`Nové heslo pre "${user.username}" (aspoň 8 znakov):`);
    if (password) await update(user, { password }, 'Heslo je zmenené');
  };

  const remove = async (user) => {
    if (!window.confirm(`Naozaj zmazať používateľa "${user.username}"?`)) return;
    await run(async () => {
      await adminApi.deleteUser(user.id);
      setUsers(list => list.filter(u => u.id !== user.id));
    }, 'Používateľ je zmazaný');
  };

  return (
    <div className="space-y-4 max-w-4xl">
      <form className="bg-white border rounded p-4 shadow-sm grid grid-cols-1 sm:grid-cols-5 gap-2 items-end" onSubmit={add}>
        <Field label="Prihlasovacie meno">
          <Input className="w-full" value={form.username} onChange={e => setForm({ ...form, username: e.target.value })} required maxLength={60} />
        </Field>
        <Field label="Heslo (min. 8 znakov)">
          <Input className="w-full" type="password" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} required minLength={8} autoComplete="new-password" />
        </Field>
        <Field label="Rola">
          <Select className="w-full" value={form.role} onChange={e => setForm({ ...form, role: e.target.value })}>
            <option value="editor">Editor kostola</option>
            <option value="admin">Administrátor</option>
          </Select>
        </Field>
        <Field label="Kostol">
          <Select className="w-full" value={form.churchId} onChange={e => setForm({ ...form, churchId: e.target.value })} disabled={form.role === 'admin'} required={form.role !== 'admin'}>
            <option value="">{form.role === 'admin' ? 'všetky kostoly' : 'Vyber kostol'}</option>
            {churches.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </Select>
        </Field>
        <Button type="submit" variant="success">Vytvoriť</Button>
      </form>

      <div className="bg-white border rounded shadow-sm overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left text-xs text-gray-600">
            <tr>
              <th className="p-2">Meno</th>
              <th className="p-2">Rola</th>
              <th className="p-2">Kostol</th>
              <th className="p-2"></th>
            </tr>
          </thead>
          <tbody>
            {users.map(u => (
              <tr key={u.id} className="border-t">
                <td className="p-2 font-medium">{u.username}{u.id === currentUser.id && <span className="text-xs text-gray-500"> (ty)</span>}</td>
                <td className="p-2">
                  <Select
                    value={u.role}
                    disabled={u.id === currentUser.id}
                    onChange={e => {
                      const role = e.target.value;
                      if (role === 'editor' && !churches.length) return window.alert('Najprv vytvor kostol.');
                      update(u, role === 'editor' ? { role, churchId: u.churchId || churches[0].id } : { role }, 'Rola je zmenená');
                    }}
                  >
                    <option value="editor">Editor kostola</option>
                    <option value="admin">Administrátor</option>
                  </Select>
                </td>
                <td className="p-2">
                  {u.role === 'admin' ? (
                    <span className="text-gray-500">všetky kostoly</span>
                  ) : (
                    <Select value={u.churchId || ''} onChange={e => update(u, { churchId: e.target.value }, 'Kostol je zmenený')}>
                      {!u.churchId && <option value="">— nepriradený —</option>}
                      {churches.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </Select>
                  )}
                  {u.role !== 'admin' && !u.churchId && <div className="text-xs text-red-600">Priraď kostol</div>}
                </td>
                <td className="p-2 text-right whitespace-nowrap space-x-2">
                  <Button onClick={() => resetPassword(u)}>Zmeniť heslo</Button>
                  {u.id !== currentUser.id && <Button variant="danger" onClick={() => remove(u)}>Zmazať</Button>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
