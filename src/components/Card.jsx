import React from 'react';
export default function Card({ title, children }) {
  return (
    <div className="bg-white border rounded p-4 shadow-sm">
      <div className="font-semibold mb-3">{title}</div>
      <div>{children}</div>
    </div>
  );
}
