'use client';

import { useEffect, useMemo, useState } from 'react';

import { useToast } from '@/components/admin/ui/toast';
import type { ContactDTO } from '@/types/admin/contacts';

type MergeContactsDialogProps = {
  open: boolean;
  contacts: ContactDTO[];
  onClose: () => void;
  onMerged: () => void;
};

export default function MergeContactsDialog({ open, contacts, onClose, onMerged }: MergeContactsDialogProps) {
  const toast = useToast();
  const [targetEmail, setTargetEmail] = useState('');
  const [targetName, setTargetName] = useState('');
  const [targetPhone, setTargetPhone] = useState('');
  const [sourceEmails, setSourceEmails] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) {
      setTargetEmail('');
      setTargetName('');
      setTargetPhone('');
      setSourceEmails([]);
      setSubmitting(false);
    }
  }, [open]);

  const selectableContacts = useMemo(() => {
    return contacts.filter((contact) => Boolean(contact.email));
  }, [contacts]);

  if (!open) {
    return null;
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const sources = Array.from(new Set(sourceEmails.map((email) => email.toLowerCase())));
    const normalizedTargetEmail = targetEmail.trim().toLowerCase();

    if (sources.length === 0) {
      toast.error('Seleziona almeno un contatto da unire.');
      return;
    }

    if (!normalizedTargetEmail) {
      toast.error("Inserisci l'email di destinazione.");
      return;
    }

    const payload = {
      sourceEmails: sources,
      targetEmail: normalizedTargetEmail,
      targetName: targetName.trim().length > 0 ? targetName.trim() : null,
      targetPhone: targetPhone.trim().length > 0 ? targetPhone.trim() : null,
    };

    try {
      setSubmitting(true);
      const res = await fetch('/api/admin/contacts/merge', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => null);
        if (body?.error?.fieldErrors) {
          toast.error('Dati non validi.');
        } else if (body?.error === 'no_sources') {
          toast.error('Seleziona contatti differenti dal target.');
        } else {
          toast.error('Unione non riuscita.');
        }
        return;
      }

      const json = (await res.json().catch(() => null)) as { ok?: boolean; merged?: number } | null;
      const merged = typeof json?.merged === 'number' ? json?.merged : undefined;
      if (merged && merged > 0) {
        toast.success(`Unione completata (${merged} prenotazioni aggiornate).`);
      } else {
        toast.success('Unione completata.');
      }
      onMerged();
    } catch (err: any) {
      const message = err?.message ?? 'Unione non riuscita.';
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  }

  function handleBackdropClick(event: React.MouseEvent<HTMLDivElement>) {
    if (event.target === event.currentTarget && !submitting) {
      onClose();
    }
  }

  function handleSourceChange(event: React.ChangeEvent<HTMLSelectElement>) {
    const values = Array.from(event.target.selectedOptions).map((option) => option.value);
    setSourceEmails(values);
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
        zIndex: 40,
      }}
    >
      <form
        onSubmit={handleSubmit}
        style={{
          background: '#fff',
          borderRadius: 20,
          padding: '1.75rem',
          width: '100%',
          maxWidth: 520,
          display: 'grid',
          gap: '1.2rem',
          boxShadow: '0 20px 45px rgba(15,23,42,0.25)',
        }}
      >
        <div style={{ display: 'grid', gap: '0.35rem' }}>
          <h2 style={{ margin: 0, fontSize: '1.35rem', fontWeight: 700 }}>Unisci contatti</h2>
          <p style={{ margin: 0, color: '#b45309', fontWeight: 500 }}>
            Attenzione: unisce tutte le prenotazioni su un&apos;unica email.
          </p>
        </div>

        <label style={{ display: 'grid', gap: '0.35rem' }}>
          <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#374151' }}>Email di destinazione</span>
          <input
            value={targetEmail}
            onChange={(event) => setTargetEmail(event.target.value)}
            placeholder="esempio@dominio.it"
            style={{
              padding: '0.6rem 0.75rem',
              borderRadius: 10,
              border: '1px solid #d1d5db',
              fontSize: '0.95rem',
            }}
          />
        </label>

        <label style={{ display: 'grid', gap: '0.35rem' }}>
          <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#374151' }}>Nome destinazione (opzionale)</span>
          <input
            value={targetName}
            onChange={(event) => setTargetName(event.target.value)}
            maxLength={255}
            placeholder="Nome consolidato"
            style={{
              padding: '0.6rem 0.75rem',
              borderRadius: 10,
              border: '1px solid #d1d5db',
              fontSize: '0.95rem',
            }}
          />
        </label>

        <label style={{ display: 'grid', gap: '0.35rem' }}>
          <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#374151' }}>Telefono destinazione (opzionale)</span>
          <input
            value={targetPhone}
            onChange={(event) => setTargetPhone(event.target.value)}
            maxLength={32}
            placeholder="Telefono consolidato"
            style={{
              padding: '0.6rem 0.75rem',
              borderRadius: 10,
              border: '1px solid #d1d5db',
              fontSize: '0.95rem',
            }}
          />
        </label>

        <label style={{ display: 'grid', gap: '0.35rem' }}>
          <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#374151' }}>Contatti da unire</span>
          <select
            multiple
            value={sourceEmails}
            onChange={handleSourceChange}
            size={Math.min(6, selectableContacts.length || 3)}
            style={{
              padding: '0.6rem 0.75rem',
              borderRadius: 10,
              border: '1px solid #d1d5db',
              fontSize: '0.95rem',
              minHeight: '8rem',
            }}
          >
            {selectableContacts.map((contact) => (
              <option key={contact.email} value={contact.email}>
                {contact.name ? `${contact.name} — ${contact.email}` : contact.email}
              </option>
            ))}
          </select>
          <small style={{ color: '#6b7280' }}>
            Suggerimento: seleziona più righe tenendo premuto Ctrl (Windows) o ⌘ (macOS).
          </small>
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
              backgroundColor: '#1d4ed8',
              color: '#f9fafb',
              fontWeight: 600,
              cursor: submitting ? 'not-allowed' : 'pointer',
              opacity: submitting ? 0.7 : 1,
            }}
          >
            {submitting ? 'Unione in corso…' : 'Conferma unione'}
          </button>
        </div>
      </form>
    </div>
  );
}
