'use client';

import { useEffect } from 'react';

export default function PrintTrigger() {
  useEffect(() => {
    window.print();
  }, []);

  return (
    <button
      type="button"
      onClick={() => window.print()}
      style={{
        alignSelf: 'flex-end',
        padding: '0.65rem 1.4rem',
        borderRadius: 999,
        border: '1px solid #1f2937',
        backgroundColor: '#111827',
        color: '#f9fafb',
        fontWeight: 600,
        cursor: 'pointer',
      }}
    >
      Stampa
    </button>
  );
}
