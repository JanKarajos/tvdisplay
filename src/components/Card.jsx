import React from 'react';

export default function Card({ title, actions, children, className = '' }) {
  return (
    <section className={`bg-white border rounded-lg p-4 shadow-sm ${className}`}>
      {(title || actions) && (
        <div className="flex items-center justify-between gap-2 mb-3">
          <h2 className="font-semibold">{title}</h2>
          {actions}
        </div>
      )}
      {children}
    </section>
  );
}
