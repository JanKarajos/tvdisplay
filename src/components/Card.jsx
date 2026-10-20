import React from 'react';

export default function Card({ title, subtitle, actions, children, className = '' }) {
  return (
    <section className={`bg-surface border border-line rounded-2xl p-4 shadow-sm ${className}`}>
      {(title || actions) && (
        <div className="flex items-center justify-between gap-2 mb-3">
          <div className="min-w-0">
            <h2 className="font-bold text-base">{title}</h2>
            {subtitle && <p className="text-xs text-muted">{subtitle}</p>}
          </div>
          {actions}
        </div>
      )}
      {children}
    </section>
  );
}
