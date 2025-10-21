'use client';

import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';

import { useToast } from '@/components/admin/ui/toast';
import type { ContactDTO } from '@/types/admin/contacts';

type EditContactModalProps = {
  open: boolean;
  contact: ContactDTO | null;
  onClose: () => void;
  onSaved: () => void;
};

export default function EditContactModal({ open, contact, onClose, onSaved }: EditContactModalProps) {
  const toast = useToast();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open && contact) {
      setName(contact.name ?? '');
      setPhone(contact.phone ?? '');
      setError(null);
    }
  }, [contact, open]);

  if (!open || !contact) {
    return null;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!contact.email) {
      toast.error('Email del contatto non disponibile');
      return;
    }

    const normalizedName = name.trim();
    const normalizedPhone = phone.trim();

    const originalName = (contact.name ?? '').trim();
    const originalPhone = (contact.phone ?? '').trim();

    const payload: Record<string, string | null> = {};
    if (normalizedName !== originalName) payload.name = normalizedName;
    if (normalizedPhone !== originalPhone) payload.phone = normalizedPhone;

    if (Object.keys(payload).length === 0) {
      toast.show('info', 'Nessuna modifica da salvare');
      onClose();
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const res = await fetch(`/api/admin/contacts/${encodeURIComponent(contact.email)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        credentials: 'include',
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        const message = data?.error?.message ?? data?.error ?? 'Impossibile aggiornare il contatto';
        throw new Error(typeof message === 'string' ? message : 'Impossibile aggiornare il contatto');
      }

      toast.success('Contatto aggiornato');
      onSaved();
    } catch (err: any) {
      const message = err?.message ?? 'Impossibile aggiornare il contatto';
      setError(message);
      toast.error(message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(17,24,39,0.4)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1.5rem',
        zIndex: 1000,
      }}
      onClick={onClose}
    >
      <div
        style={{
          backgroundColor: '#fff',
          borderRadius: 16,
          padding: '1.75rem',
          width: '100%',
          maxWidth: 440,
          boxShadow: '0 25px 60px rgba(15,23,42,0.25)',
        }}
        onClick={(event) => event.stopPropagation()}
      >
        <h2 style={{ margin: 0, marginBottom: '1rem', fontSize: '1.35rem', fontWeight: 700 }}>Modifica contatto</h2>
        <p style={{ margin: 0, marginBottom: '1.5rem', color: '#6b7280', fontSize: '0.95rem' }}>
          Aggiorna nome e telefono. Le modifiche vengono propagate alle prenotazioni esistenti.
        </p>

        <form onSubmit={handleSubmit} style={{ display: 'grid', gap: '1rem' }}>
          <label style={{ display: 'grid', gap: '0.4rem' }}>
            <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#374151' }}>Email</span>
            <input
              value={contact.email}
              readOnly
              style={{
                padding: '0.65rem 0.75rem',
                borderRadius: 10,
                border: '1px solid #d1d5db',
                fontSize: '0.95rem',
                backgroundColor: '#f3f4f6',
                color: '#4b5563',
              }}
            />
          </label>

          <label style={{ display: 'grid', gap: '0.4rem' }}>
            <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#374151' }}>Nome</span>
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Nome contatto"
              style={{
                padding: '0.65rem 0.75rem',
                borderRadius: 10,
                border: '1px solid #d1d5db',
                fontSize: '0.95rem',
              }}
            />
          </label>

          <label style={{ display: 'grid', gap: '0.4rem' }}>
            <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#374151' }}>Telefono</span>
            <input
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              placeholder="Numero di telefono"
              style={{
                padding: '0.65rem 0.75rem',
                borderRadius: 10,
                border: '1px solid #d1d5db',
                fontSize: '0.95rem',
              }}
            />
          </label>

          {error ? (
            <div
              role="alert"
              style={{
                padding: '0.75rem 1rem',
                borderRadius: 12,
                backgroundColor: '#fee2e2',
                border: '1px solid #fecaca',
                color: '#b91c1c',
                fontSize: '0.9rem',
              }}
            >
              {error}
            </div>
          ) : null}

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              style={{
                padding: '0.55rem 1.2rem',
                borderRadius: 999,
                border: '1px solid #d1d5db',
                backgroundColor: '#fff',
                color: '#374151',
                fontWeight: 600,
                cursor: saving ? 'not-allowed' : 'pointer',
                opacity: saving ? 0.7 : 1,
              }}
            >
              Annulla
            </button>
            <button
              type="submit"
              disabled={saving}
              style={{
                padding: '0.55rem 1.6rem',
                borderRadius: 999,
                border: 'none',
                backgroundColor: '#111827',
                color: '#f9fafb',
                fontWeight: 700,
                cursor: saving ? 'not-allowed' : 'pointer',
                opacity: saving ? 0.7 : 1,
              }}
            >
              {saving ? 'Salvataggio…' : 'Salva'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
