import React, { useState } from 'react';

// Názov s možnosťou premenovania priamo v zozname
export default function InlineRename({ value, onSave, className = '' }) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(value);

  if (!editing) {
    return (
      <span className={`inline-flex items-center gap-1 min-w-0 ${className}`}>
        <span className="truncate" title={value}>{value}</span>
        <button
          type="button"
          className="btn-icon !w-8 !h-8 shrink-0 text-sm"
          title="Premenovať"
          aria-label={`Premenovať: ${value}`}
          onClick={() => { setText(value); setEditing(true); }}
        >
          ✎
        </button>
      </span>
    );
  }

  return (
    <form
      className={`flex items-center gap-1 min-w-0 ${className}`}
      onSubmit={async (e) => {
        e.preventDefault();
        if (text.trim() && (await onSave(text.trim()))) setEditing(false);
      }}
    >
      <input className="field !min-h-[36px] min-w-0" value={text} onChange={(e) => setText(e.target.value)} autoFocus maxLength={200} />
      <button className="btn-primary !min-h-[36px] !px-3" disabled={!text.trim()}>Uložiť</button>
      <button type="button" className="btn-icon !w-8 !h-8" aria-label="Zrušiť" onClick={() => setEditing(false)}>✕</button>
    </form>
  );
}
