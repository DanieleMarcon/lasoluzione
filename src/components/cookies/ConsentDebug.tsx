'use client';

import { useEffect, useState } from 'react';
import { useConsentStore } from '@/state/useConsentStore';

export default function ConsentDebug() {
  const [mounted, setMounted] = useState(false);
  const state = useConsentStore();
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;

  return (
    <div style={{ position: 'fixed', bottom: 80, right: 16, zIndex: 9999, background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, padding: 12 }}>
      <strong>ConsentDebug</strong>
      <pre style={{ margin: 0, maxWidth: 360, maxHeight: 260, overflow: 'auto' }}>
        {JSON.stringify(state, null, 2)}
      </pre>
      <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
        <button onClick={state.acceptAll}>acceptAll()</button>
        <button onClick={state.rejectAll}>rejectAll()</button>
        <button onClick={state.openPreferences}>openPreferences()</button>
        <button onClick={() => { document.cookie.split(';').forEach(c => document.cookie = c.replace(/^ +/, '').replace(/=.*/, '=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/')); location.reload(); }}>
          wipe cookie
        </button>
      </div>
    </div>
  );
}
