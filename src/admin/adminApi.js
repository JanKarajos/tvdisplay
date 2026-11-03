// Volania API administrácie (server/admin.js). Prihlásenie drží HttpOnly cookie.
// Adresy sú relatívne: v produkcii beží administrácia na tom istom serveri, pri vývoji ich Vite presmeruje.
let onUnauthorized = () => {};
export function setUnauthorizedHandler(handler) {
  onUnauthorized = handler;
}

async function request(method, path, body, headers = {}) {
  const isJson = body !== undefined && !(body instanceof Blob);
  const res = await fetch('/api/admin' + path, {
    method,
    credentials: 'same-origin',
    headers: {
      ...(method !== 'GET' ? { 'X-Tvdisplay-Admin': '1' } : {}),
      ...(isJson ? { 'Content-Type': 'application/json' } : {}),
      ...headers,
    },
    body: isJson ? JSON.stringify(body) : body,
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    if (res.status === 401 && path !== '/login') onUnauthorized();
    throw new Error(data?.error || `Chyba servera (${res.status})`);
  }
  return data;
}

const church = (id) => `/churches/${encodeURIComponent(id)}`;

export const adminApi = {
  login: (username, password) => request('POST', '/login', { username, password }),
  logout: () => request('POST', '/logout', {}),
  me: () => request('GET', '/me'),
  changePassword: (currentPassword, newPassword) => request('PUT', '/me/password', { currentPassword, newPassword }),

  createChurch: (name) => request('POST', '/churches', { name }),
  addJksToAll: () => request('POST', '/churches/add-jks', {}),
  renameChurch: (id, name) => request('PUT', church(id), { name }),
  deleteChurch: (id) => request('DELETE', church(id)),

  listUsers: () => request('GET', '/users'),
  createUser: (user) => request('POST', '/users', user),
  updateUser: (id, fields) => request('PUT', `/users/${encodeURIComponent(id)}`, fields),
  deleteUser: (id) => request('DELETE', `/users/${encodeURIComponent(id)}`),

  // Piesne, kategórie, obrázky a prezentácie jedného kostola
  list: (churchId, kind) => request('GET', `${church(churchId)}/${kind}`),
  create: (churchId, kind, item) => request('POST', `${church(churchId)}/${kind}`, item),
  update: (churchId, kind, id, item) => request('PUT', `${church(churchId)}/${kind}/${encodeURIComponent(id)}`, item),
  remove: (churchId, kind, id) => request('DELETE', `${church(churchId)}/${kind}/${encodeURIComponent(id)}`),
  // Prezentácia ide ako súbor; PowerPoint server prevedie na PDF (ak má LibreOffice)
  uploadPresentation: (churchId, title, file) => request('POST', `${church(churchId)}/pdfs`, file, {
    'Content-Type': file.type || 'application/octet-stream',
    'X-Filename': encodeURIComponent(file.name),
    'X-Title': encodeURIComponent(title),
  }),
};

// Súbor (obrázok/PDF) uložený v administrácii
export function mediaUrl(churchId, relUrl) {
  return `/api/public/churches/${encodeURIComponent(churchId)}/${relUrl}`;
}

// Adresa, ktorú treba zadať pri inštalácii Orange Pi v kostole
export function churchDataUrl(churchId) {
  return `${window.location.origin}/api/public/churches/${encodeURIComponent(churchId)}`;
}
