// Volania API administrácie (server/admin.mjs). Prihlásenie drží HttpOnly cookie.
let onUnauthorized = () => {};
export function setUnauthorizedHandler(handler) {
  onUnauthorized = handler;
}

async function request(method, path, body) {
  const res = await fetch('/api/admin' + path, {
    method,
    credentials: 'same-origin',
    headers: body !== undefined || method !== 'GET' ? { 'Content-Type': 'application/json' } : {},
    body: body !== undefined ? JSON.stringify(body) : method !== 'GET' ? '{}' : undefined,
  });
  let data = null;
  try {
    data = await res.json();
  } catch {
    // odpoveď bez JSON
  }
  if (!res.ok) {
    if (res.status === 401 && path !== '/login') onUnauthorized();
    throw new Error(data?.error || `Chyba servera (${res.status})`);
  }
  return data;
}

const church = (id) => `/churches/${encodeURIComponent(id)}`;

export const adminApi = {
  login: (username, password) => request('POST', '/login', { username, password }),
  logout: () => request('POST', '/logout'),
  me: () => request('GET', '/me'),
  changePassword: (currentPassword, newPassword) => request('PUT', '/me/password', { currentPassword, newPassword }),

  listChurches: () => request('GET', '/churches'),
  createChurch: (name, seed) => request('POST', '/churches', { name, seed }),
  renameChurch: (id, name) => request('PUT', church(id), { name }),
  deleteChurch: (id) => request('DELETE', church(id)),

  listUsers: () => request('GET', '/users'),
  createUser: (user) => request('POST', '/users', user),
  updateUser: (id, fields) => request('PUT', `/users/${encodeURIComponent(id)}`, fields),
  deleteUser: (id) => request('DELETE', `/users/${encodeURIComponent(id)}`),

  // Piesne, kategórie, obrázky a PDF jedného kostola
  list: (churchId, kind) => request('GET', `${church(churchId)}/${kind}`),
  create: (churchId, kind, item) => request('POST', `${church(churchId)}/${kind}`, item),
  update: (churchId, kind, id, item) => request('PUT', `${church(churchId)}/${kind}/${encodeURIComponent(id)}`, item),
  remove: (churchId, kind, id) => request('DELETE', `${church(churchId)}/${kind}/${encodeURIComponent(id)}`),
};

// Adresa súboru (obrázok/PDF) uloženého v administrácii
export function mediaUrl(churchId, relUrl) {
  return `/api/public/churches/${encodeURIComponent(churchId)}/${relUrl}`;
}

// Adresa, ktorú treba zadať na Orange Pi v kostole
export function churchDataUrl(churchId) {
  return `${window.location.origin}/api/public/churches/${encodeURIComponent(churchId)}`;
}
