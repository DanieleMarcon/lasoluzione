'use client';

import { useEffect, useMemo, useState } from 'react';

import { useToast } from '@/components/admin/ui/toast';
import type { ContactDTO } from '@/types/admin/contacts';

type EditContactModalProps = {
  open: boolean;
  contact: ContactDTO | null;
  onClose: () => void;
  onSuccess: () => void;
};

export default function EditContactModal({ open, contact, onClose, onSuccess }: EditContactModalProps) {
  const toast = useToast();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open || !contact) {
      setName('');
      setPhone('');
      setSubmitting(false);
      return;
    }

    setName(contact.name ?? '');
    setPhone(contact.phone ?? '');
  }, [open, contact]);

  const email = useMemo(() => contact?.email ?? '', [contact]);

  if (!open || !contact) {
    return null;
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!email) return;

    const payload = {
      name: name.trim().length > 0 ? name.trim() : null,
      phone: phone.trim().length > 0 ? phone.trim() : null,
    };

    try {
      setSubmitting(true);
      const res = await fetch(`/api/admin/contacts/${encodeURIComponent(email)}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const message = res.status === 400 ? 'Dati non validi.' : 'Aggiornamento non riuscito.';
        throw new Error(message);
      }

      const json = (await res.json().catch(() => null)) as { ok?: boolean; noop?: boolean } | null;
      if (json?.noop) {
        toast.success('Nessuna modifica necessaria.');
      } else {
        toast.success('Contatto aggiornato.');
      }
      onSuccess();
    } catch (err: any) {
      const message = err?.message ?? 'Aggiornamento non riuscito.';
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  }

  function handleBackdropClick(event: React.MouseEvent<HTMLDivElement>) {
    if (event.target === event.currentTarget) {
      onClose();
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={handleBackdropClick}
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(17,24,39,0.45)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1.5rem',
        zIndex: 50,
      }}
    >
      <form
        onSubmit={handleSubmit}
        style={{
          background: '#fff',
          borderRadius: 20,
          padding: '1.75rem',
          width: '100%',
          maxWidth: 420,
          display: 'grid',
          gap: '1.2rem',
          boxShadow: '0 20px 45px rgba(15,23,42,0.25)',
        }}
      >
        <div style={{ display: 'grid', gap: '0.35rem' }}>
          <h2 style={{ margin: 0, fontSize: '1.35rem', fontWeight: 700 }}>Modifica contatto</h2>
          <p style={{ margin: 0, color: '#6b7280' }}>Aggiorna nome e telefono. L&apos;email resta invariata.</p>
        </div>

        <label style={{ display: 'grid', gap: '0.35rem' }}>
          <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#374151' }}>Email</span>
          <input
            value={email}
            readOnly
            style={{
              padding: '0.6rem 0.75rem',
              borderRadius: 10,
              border: '1px solid #d1d5db',
              fontSize: '0.95rem',
              backgroundColor: '#f3f4f6',
              color: '#6b7280',
            }}
          />
        </label>

        <label style={{ display: 'grid', gap: '0.35rem' }}>
          <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#374151' }}>Nome</span>
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            maxLength={255}
            placeholder="Nome e cognome"
            style={{
              padding: '0.6rem 0.75rem',
              borderRadius: 10,
              border: '1px solid #d1d5db',
              fontSize: '0.95rem',
            }}
          />
        </label>

        <label style={{ display: 'grid', gap: '0.35rem' }}>
          <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#374151' }}>Telefono</span>
          <input
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
            maxLength={32}
            placeholder="Numero di telefono"
            style={{
              padding: '0.6rem 0.75rem',
              borderRadius: 10,
              border: '1px solid #d1d5db',
              fontSize: '0.95rem',
            }}
          />
        </label>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            style={{
              padding: '0.55rem 1.2rem',
              borderRadius: 999,
              border: '1px solid #d1d5db',
              backgroundColor: '#fff',
              color: '#374151',
              fontWeight: 600,
              cursor: submitting ? 'not-allowed' : 'pointer',
              opacity: submitting ? 0.6 : 1,
            }}
          >
            Annulla
          </button>
          <button
            type="submit"
            disabled={submitting}
            style={{
              padding: '0.55rem 1.6rem',
              borderRadius: 999,
              border: 'none',
              backgroundColor: '#111827',
              color: '#f9fafb',
              fontWeight: 600,
              cursor: submitting ? 'not-allowed' : 'pointer',
              opacity: submitting ? 0.7 : 1,
            }}
          >
            {submitting ? 'Salvataggio…' : 'Salva modifiche'}
          </button>
        </div>
      </form>
    </div>
  );
}
