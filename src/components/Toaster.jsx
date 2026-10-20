import React, { useSyncExternalStore } from 'react';
import { toastStore } from '../lib/toast';

export default function Toaster() {
  const toasts = useSyncExternalStore(toastStore.subscribe, toastStore.getSnapshot);
  return (
    <div className="fixed left-0 right-0 bottom-36 sm:bottom-28 z-40 flex flex-col items-center gap-2 pointer-events-none px-4" aria-live="polite">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`animate-toast-in max-w-sm px-4 py-2 rounded-xl shadow-lg text-sm font-semibold ${t.tone === 'ok' ? 'bg-ok text-white dark:text-black' : 'bg-fg text-bg'}`}
        >
          {t.tone === 'ok' && '✓ '}
          {t.message}
        </div>
      ))}
    </div>
  );
}
