// Krátke oznámenia v ovládaní ("Pridané do poradia" a pod.)
const listeners = new Set();
let toasts = [];
let nextId = 1;

export function toast(message, { tone = 'info', duration = 2500 } = {}) {
  const id = nextId++;
  toasts = [...toasts, { id, message, tone }];
  listeners.forEach((cb) => cb());
  setTimeout(() => {
    toasts = toasts.filter((t) => t.id !== id);
    listeners.forEach((cb) => cb());
  }, duration);
}

export const toastStore = {
  subscribe(cb) {
    listeners.add(cb);
    return () => listeners.delete(cb);
  },
  getSnapshot: () => toasts,
};
