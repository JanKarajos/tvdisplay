import React from 'react';

// Malé spoločné prvky pre administráciu
export function Button({ variant = 'default', className = '', ...props }) {
  const styles = {
    primary: 'bg-blue-500 text-white hover:bg-blue-600 disabled:bg-gray-300',
    success: 'bg-green-500 text-white hover:bg-green-600 disabled:bg-gray-300',
    danger: 'border border-red-300 text-red-600 hover:bg-red-50 disabled:opacity-50',
    default: 'border hover:bg-gray-50 disabled:opacity-50',
  };
  return <button type="button" className={`px-3 py-1.5 text-sm rounded ${styles[variant]} ${className}`} {...props} />;
}

export function Input({ className = '', ...props }) {
  return <input className={`border rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${className}`} {...props} />;
}

export function Select({ className = '', ...props }) {
  return <select className={`border rounded px-2 py-1.5 text-sm bg-white ${className}`} {...props} />;
}

export function Field({ label, children }) {
  return (
    <label className="block">
      <span className="block text-xs font-medium text-gray-600 mb-1">{label}</span>
      {children}
    </label>
  );
}

// Upravovateľný názov s tlačidlami Uložiť/Zrušiť
export function InlineRename({ value, onSave }) {
  const [editing, setEditing] = React.useState(false);
  const [text, setText] = React.useState(value);
  if (!editing) {
    return (
      <span className="inline-flex items-center gap-2">
        <span>{value}</span>
        <button type="button" className="text-xs text-blue-600 underline" onClick={() => { setText(value); setEditing(true); }}>premenovať</button>
      </span>
    );
  }
  return (
    <form
      className="inline-flex items-center gap-1"
      onSubmit={async (e) => {
        e.preventDefault();
        if (text.trim() && (await onSave(text.trim())) !== false) setEditing(false);
      }}
    >
      <Input value={text} onChange={e => setText(e.target.value)} autoFocus className="w-48" />
      <Button type="submit" variant="primary" disabled={!text.trim()}>Uložiť</Button>
      <Button onClick={() => setEditing(false)}>Zrušiť</Button>
    </form>
  );
}
