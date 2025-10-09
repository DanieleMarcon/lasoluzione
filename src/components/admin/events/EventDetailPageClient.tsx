'use client';

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
  type FormEvent,
} from 'react';
import Link from 'next/link';

import { useToast } from '@/components/admin/ui/toast';

export type EventSummary = {
  id: number;
  title: string;
  slug: string;
  startAt: string;
  endAt: string | null;
  active: boolean;
  showOnHome: boolean;
  allowEmailOnlyBooking: boolean;
};

export type EventTierRow = {
  id: number;
  label: string;
  description: string | null;
  priceCents: number;
  order: number;
  active: boolean;
};

type PackageDraft = {
  label: string;
  description: string;
  price: string;
  order: string;
};

type CreateFormState = {
  label: string;
  description: string;
  price: string;
  order: string;
  active: boolean;
};

type Props = {
  event: EventSummary;
  initialTiers: EventTierRow[];
};

const containerStyle: CSSProperties = {
  padding: '2rem 3rem',
  display: 'grid',
  gap: '2rem',
  maxWidth: 1100,
};

const sectionStyle: CSSProperties = {
  backgroundColor: '#1f2937',
  borderRadius: 18,
  padding: '1.75rem',
  color: '#f9fafb',
  boxShadow: '0 14px 34px rgba(15,23,42,0.3)',
  display: 'grid',
  gap: '1.5rem',
};

function formatDate(value: string | null) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString('it-IT', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

function formatMoney(cents: number) {
  return (cents / 100).toLocaleString('it-IT', {
    style: 'currency',
    currency: 'EUR',
  });
}

function formatPriceInput(cents: number) {
  return (cents / 100).toLocaleString('it-IT', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function parsePriceInput(value: string) {
  const normalized = value.replace(/\s+/g, '').replace(',', '.');
  if (!normalized) return null;
  const parsed = Number.parseFloat(normalized);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return null;
  }
  return Math.round(parsed * 100);
}

function toDraftMap(rows: EventTierRow[]): Record<number, PackageDraft> {
  return rows.reduce<Record<number, PackageDraft>>((acc, row) => {
    acc[row.id] = {
      label: row.label,
      description: row.description ?? '',
      price: formatPriceInput(row.priceCents),
      order: String(row.order),
    };
    return acc;
  }, {});
}

export default function EventDetailPageClient({ event, initialTiers }: Props) {
  const toast = useToast();
  const [tiers, setTiers] = useState<EventTierRow[]>(initialTiers);
  const [drafts, setDrafts] = useState<Record<number, PackageDraft>>(() => toDraftMap(initialTiers));
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [savingId, setSavingId] = useState<number | null>(null);
  const [togglingId, setTogglingId] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [createForm, setCreateForm] = useState<CreateFormState>({
    label: '',
    description: '',
    price: '',
    order: '',
    active: true,
  });

  const suggestedOrder = useMemo(() => {
    if (tiers.length === 0) return '10';
    const maxOrder = tiers.reduce((max, tier) => Math.max(max, tier.order), tiers[0].order);
    return String(maxOrder + 10);
  }, [tiers]);

  useEffect(() => {
    setCreateForm((prev) => ({
      ...prev,
      order: prev.order || suggestedOrder,
    }));
  }, [suggestedOrder]);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/events/${event.id}/tiers`, { cache: 'no-store' });
      const body = await res.json().catch(() => null);
      if (!res.ok || !body?.ok) {
        toast.error(body?.error || 'Impossibile caricare i pacchetti');
        return;
      }
      const rows = (body.data ?? []) as EventTierRow[];
      setTiers(rows);
      setDrafts(toDraftMap(rows));
    } catch (error) {
      console.error('[admin][event][tiers] refresh error', error);
      toast.error('Errore di rete durante il caricamento');
    } finally {
      setLoading(false);
    }
  }, [event.id, toast]);

  const handleCreateFieldChange = <K extends keyof CreateFormState>(field: K, value: CreateFormState[K]) => {
    setCreateForm((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleCreateSubmit = async (eventObj: FormEvent<HTMLFormElement>) => {
    eventObj.preventDefault();
    if (creating) return;

    const trimmedLabel = createForm.label.trim();
    if (trimmedLabel.length < 2) {
      toast.error("L'etichetta deve contenere almeno 2 caratteri");
      return;
    }

    const priceCents = parsePriceInput(createForm.price);
    if (priceCents == null) {
      toast.error('Prezzo non valido');
      return;
    }

    const parsedOrder = Number.parseInt(createForm.order, 10);
    if (!Number.isFinite(parsedOrder)) {
      toast.error('Ordine non valido');
      return;
    }

    setCreating(true);
    try {
      const res = await fetch(`/api/admin/events/${event.id}/tiers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          label: trimmedLabel,
          description: createForm.description.trim() || null,
          priceCents,
          order: parsedOrder,
          active: createForm.active,
        }),
        cache: 'no-store',
      });
      const body = await res.json().catch(() => null);
      if (!res.ok || !body?.ok) {
        toast.error(body?.error || 'Errore durante la creazione');
        return;
      }
      toast.success('Pacchetto creato');
      setCreateForm({
        label: '',
        description: '',
        price: '',
        order: '',
        active: true,
      });
      await refresh();
    } catch (error) {
      console.error('[admin][event][tiers] create error', error);
      toast.error('Errore di rete durante la creazione');
    } finally {
      setCreating(false);
    }
  };

  const handleDraftChange = (id: number, field: keyof PackageDraft, value: string) => {
    setDrafts((prev) => ({
      ...prev,
      [id]: {
        ...(prev[id] ?? { label: '', description: '', price: '', order: '' }),
        [field]: value,
      },
    }));
  };

  const handleSave = async (tier: EventTierRow) => {
    const draft = drafts[tier.id] ?? {
      label: tier.label,
      description: tier.description ?? '',
      price: formatPriceInput(tier.priceCents),
      order: String(tier.order),
    };

    const trimmedLabel = draft.label.trim();
    if (trimmedLabel.length < 2) {
      toast.error("L'etichetta deve contenere almeno 2 caratteri");
      return;
    }

    const priceCents = parsePriceInput(draft.price);
    if (priceCents == null) {
      toast.error('Prezzo non valido');
      return;
    }

    const parsedOrder = Number.parseInt(draft.order, 10);
    if (!Number.isFinite(parsedOrder)) {
      toast.error('Ordine non valido');
      return;
    }

    const changes: Record<string, unknown> = { eventId: event.id };
    if (trimmedLabel !== tier.label) changes.label = trimmedLabel;

    const normalizedDescription = draft.description.trim();
    const currentDescription = (tier.description ?? '').trim();
    if (normalizedDescription !== currentDescription) {
      changes.description = normalizedDescription ? normalizedDescription : null;
    }

    if (priceCents !== tier.priceCents) changes.priceCents = priceCents;
    if (parsedOrder !== tier.order) changes.order = parsedOrder;

    if (Object.keys(changes).length === 1) {
      toast.show('info', 'Nessuna modifica da salvare');
      return;
    }

    setSavingId(tier.id);
    try {
      const res = await fetch(`/api/admin/events/tiers/${tier.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(changes),
        cache: 'no-store',
      });
      const body = await res.json().catch(() => null);
      if (!res.ok || !body?.ok) {
        toast.error(body?.error || "Errore durante l'aggiornamento");
        return;
      }
      toast.success('Pacchetto aggiornato');
      await refresh();
    } catch (error) {
      console.error('[admin][event][tiers] save error', error);
      toast.error("Errore di rete durante l'aggiornamento");
    } finally {
      setSavingId(null);
    }
  };

  const handleToggleActive = async (tier: EventTierRow) => {
    setTogglingId(tier.id);
    try {
      const res = await fetch(`/api/admin/events/tiers/${tier.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ eventId: event.id, active: !tier.active }),
        cache: 'no-store',
      });
      const body = await res.json().catch(() => null);
      if (!res.ok || !body?.ok) {
        toast.error(body?.error || "Errore durante l'aggiornamento dello stato");
        return;
      }
      toast.success(`Pacchetto ${tier.active ? 'disattivato' : 'attivato'}`);
      await refresh();
    } catch (error) {
      console.error('[admin][event][tiers] toggle error', error);
      toast.error('Errore di rete durante il toggle');
    } finally {
      setTogglingId(null);
    }
  };

  const handleDelete = async (tier: EventTierRow) => {
    if (!window.confirm(`Eliminare il pacchetto “${tier.label}”?`)) return;
    setDeletingId(tier.id);
    try {
      const res = await fetch(`/api/admin/events/tiers/${tier.id}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ eventId: event.id }),
        cache: 'no-store',
      });
      const body = await res.json().catch(() => null);
      if (!res.ok || !body?.ok) {
        toast.error(body?.error || 'Errore durante la rimozione');
        return;
      }
      toast.success('Pacchetto eliminato');
      await refresh();
    } catch (error) {
      console.error('[admin][event][tiers] delete error', error);
      toast.error('Errore di rete durante la rimozione');
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div style={{ display: 'flex', justifyContent: 'center' }}>
      <div style={containerStyle}>
        <section style={sectionStyle}>
          <header style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', gap: '1rem' }}>
            <div style={{ display: 'grid', gap: '0.5rem' }}>
              <span style={{ color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em', fontSize: '0.8rem' }}>
                Evento #{event.id}
              </span>
              <h1 style={{ margin: 0, fontSize: '1.9rem' }}>{event.title}</h1>
              <div style={{ color: '#cbd5f5', fontSize: '0.95rem' }}>
                <div>Slug: <code style={{ backgroundColor: '#111827', padding: '0.2rem 0.4rem', borderRadius: 6 }}>{event.slug}</code></div>
                <div>
                  {formatDate(event.startAt)}
                  {event.endAt ? ` → ${formatDate(event.endAt)}` : ''}
                </div>
              </div>
              <div style={{ display: 'flex', gap: '0.75rem', color: '#e2e8f0', fontSize: '0.9rem' }}>
                <span>{event.active ? 'Attivo' : 'Disattivato'}</span>
                <span>•</span>
                <span>{event.showOnHome ? 'In home' : 'Fuori home'}</span>
                <span>•</span>
                <span>{event.allowEmailOnlyBooking ? 'Prenotazione via email ammessa' : 'Solo prenotazione standard'}</span>
              </div>
            </div>
            <Link
              href={`/eventi/${event.slug}`}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                alignSelf: 'flex-start',
                padding: '0.75rem 1.25rem',
                borderRadius: 12,
                background: 'linear-gradient(135deg, #38bdf8, #3b82f6)',
                color: '#0f172a',
                fontWeight: 600,
                textDecoration: 'none',
                boxShadow: '0 12px 24px rgba(56,189,248,0.35)',
              }}
            >
              Apri pubblico
            </Link>
          </header>
        </section>

        <section style={sectionStyle}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
            <div>
              <h2 style={{ margin: 0, fontSize: '1.5rem' }}>Pacchetti</h2>
              <p style={{ margin: '0.25rem 0 0', color: '#cbd5f5' }}>
                Crea e gestisci i pacchetti disponibili per questo evento.
              </p>
            </div>
            {loading && <span style={{ color: '#94a3b8' }}>Caricamento…</span>}
          </div>

          <form
            onSubmit={handleCreateSubmit}
            style={{
              border: '1px solid rgba(148,163,184,0.25)',
              borderRadius: 16,
              padding: '1.5rem',
              display: 'grid',
              gap: '1rem',
              backgroundColor: '#111827',
            }}
          >
            <h3 style={{ margin: 0, fontSize: '1.15rem' }}>Nuovo pacchetto</h3>
            <label style={{ display: 'grid', gap: '0.35rem' }}>
              <span>Etichetta *</span>
              <input
                type="text"
                value={createForm.label}
                onChange={(eventObj) => handleCreateFieldChange('label', eventObj.target.value)}
                style={{
                  padding: '0.6rem 0.8rem',
                  borderRadius: 10,
                  border: '1px solid rgba(148,163,184,0.35)',
                  backgroundColor: '#0f172a',
                  color: '#f8fafc',
                }}
              />
            </label>
            <label style={{ display: 'grid', gap: '0.35rem' }}>
              <span>Descrizione</span>
              <textarea
                value={createForm.description}
                onChange={(eventObj) => handleCreateFieldChange('description', eventObj.target.value)}
                rows={3}
                style={{
                  padding: '0.6rem 0.8rem',
                  borderRadius: 10,
                  border: '1px solid rgba(148,163,184,0.35)',
                  backgroundColor: '#0f172a',
                  color: '#f8fafc',
                  resize: 'vertical',
                }}
              />
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem' }}>
              <label style={{ display: 'grid', gap: '0.35rem' }}>
                <span>Prezzo (EUR)</span>
                <input
                  type="text"
                  value={createForm.price}
                  placeholder="0,00"
                  onChange={(eventObj) => handleCreateFieldChange('price', eventObj.target.value)}
                  style={{
                    padding: '0.6rem 0.8rem',
                    borderRadius: 10,
                    border: '1px solid rgba(148,163,184,0.35)',
                    backgroundColor: '#0f172a',
                    color: '#f8fafc',
                  }}
                />
              </label>
              <label style={{ display: 'grid', gap: '0.35rem' }}>
                <span>Ordine</span>
                <input
                  type="number"
                  value={createForm.order}
                  onChange={(eventObj) => handleCreateFieldChange('order', eventObj.target.value)}
                  style={{
                    padding: '0.6rem 0.8rem',
                    borderRadius: 10,
                    border: '1px solid rgba(148,163,184,0.35)',
                    backgroundColor: '#0f172a',
                    color: '#f8fafc',
                  }}
                />
              </label>
            </div>
            <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.6rem', fontSize: '0.95rem' }}>
              <input
                type="checkbox"
                checked={createForm.active}
                onChange={(eventObj) => handleCreateFieldChange('active', eventObj.target.checked)}
              />
              <span>Attivo</span>
            </label>
            <button
              type="submit"
              disabled={creating}
              style={{
                justifySelf: 'start',
                padding: '0.75rem 1.5rem',
                borderRadius: 12,
                border: 'none',
                background: creating
                  ? 'linear-gradient(135deg, #475569, #334155)'
                  : 'linear-gradient(135deg, #22c55e, #16a34a)',
                color: '#0f172a',
                fontWeight: 600,
                cursor: creating ? 'not-allowed' : 'pointer',
              }}
            >
              {creating ? 'Creazione…' : 'Aggiungi pacchetto'}
            </button>
          </form>

          <div
            style={{
              border: '1px solid rgba(148,163,184,0.25)',
              borderRadius: 16,
              overflow: 'hidden',
            }}
          >
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead style={{ backgroundColor: '#111827' }}>
                <tr>
                  <th style={{ textAlign: 'left', padding: '0.75rem', color: '#94a3b8', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                    Etichetta
                  </th>
                  <th style={{ textAlign: 'left', padding: '0.75rem', color: '#94a3b8', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                    Descrizione
                  </th>
                  <th style={{ textAlign: 'left', padding: '0.75rem', color: '#94a3b8', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                    Prezzo
                  </th>
                  <th style={{ textAlign: 'left', padding: '0.75rem', color: '#94a3b8', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                    Ordine
                  </th>
                  <th style={{ textAlign: 'center', padding: '0.75rem', color: '#94a3b8', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                    Attivo
                  </th>
                  <th style={{ textAlign: 'right', padding: '0.75rem', color: '#94a3b8', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                    Azioni
                  </th>
                </tr>
              </thead>
              <tbody>
                {tiers.map((tier) => {
                  const draft = drafts[tier.id] ?? {
                    label: tier.label,
                    description: tier.description ?? '',
                    price: formatPriceInput(tier.priceCents),
                    order: String(tier.order),
                  };
                  return (
                    <tr key={tier.id} style={{ backgroundColor: '#0f172a' }}>
                      <td style={{ padding: '0.75rem', verticalAlign: 'top' }}>
                        <input
                          type="text"
                          value={draft.label}
                          onChange={(eventObj) => handleDraftChange(tier.id, 'label', eventObj.target.value)}
                          style={{
                            width: '100%',
                            padding: '0.5rem 0.65rem',
                            borderRadius: 8,
                            border: '1px solid rgba(148,163,184,0.3)',
                            backgroundColor: '#0b1220',
                            color: '#f8fafc',
                          }}
                        />
                      </td>
                      <td style={{ padding: '0.75rem', verticalAlign: 'top' }}>
                        <textarea
                          value={draft.description}
                          onChange={(eventObj) => handleDraftChange(tier.id, 'description', eventObj.target.value)}
                          rows={3}
                          style={{
                            width: '100%',
                            padding: '0.5rem 0.65rem',
                            borderRadius: 8,
                            border: '1px solid rgba(148,163,184,0.3)',
                            backgroundColor: '#0b1220',
                            color: '#f8fafc',
                            resize: 'vertical',
                          }}
                        />
                      </td>
                      <td style={{ padding: '0.75rem', verticalAlign: 'top', width: 160 }}>
                        <div style={{ display: 'grid', gap: '0.35rem' }}>
                          <input
                            type="text"
                            value={draft.price}
                            onChange={(eventObj) => handleDraftChange(tier.id, 'price', eventObj.target.value)}
                            style={{
                              width: '100%',
                              padding: '0.5rem 0.65rem',
                              borderRadius: 8,
                              border: '1px solid rgba(148,163,184,0.3)',
                              backgroundColor: '#0b1220',
                              color: '#f8fafc',
                            }}
                          />
                          <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>{formatMoney(tier.priceCents)}</span>
                        </div>
                      </td>
                      <td style={{ padding: '0.75rem', verticalAlign: 'top', width: 120 }}>
                        <input
                          type="number"
                          value={draft.order}
                          onChange={(eventObj) => handleDraftChange(tier.id, 'order', eventObj.target.value)}
                          style={{
                            width: '100%',
                            padding: '0.5rem 0.65rem',
                            borderRadius: 8,
                            border: '1px solid rgba(148,163,184,0.3)',
                            backgroundColor: '#0b1220',
                            color: '#f8fafc',
                          }}
                        />
                      </td>
                      <td style={{ padding: '0.75rem', verticalAlign: 'middle', textAlign: 'center' }}>
                        <button
                          type="button"
                          onClick={() => handleToggleActive(tier)}
                          disabled={togglingId === tier.id}
                          style={{
                            padding: '0.45rem 0.85rem',
                            borderRadius: 999,
                            border: '1px solid rgba(148,163,184,0.35)',
                            background: tier.active
                              ? 'linear-gradient(135deg, #34d399, #059669)'
                              : 'linear-gradient(135deg, #64748b, #475569)',
                            color: '#0f172a',
                            fontWeight: 600,
                            cursor: togglingId === tier.id ? 'not-allowed' : 'pointer',
                          }}
                        >
                          {tier.active ? 'Attivo' : 'Off'}
                        </button>
                      </td>
                      <td style={{ padding: '0.75rem', verticalAlign: 'middle', textAlign: 'right' }}>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                          <button
                            type="button"
                            onClick={() => handleSave(tier)}
                            disabled={savingId === tier.id}
                            style={{
                              padding: '0.55rem 1rem',
                              borderRadius: 10,
                              border: '1px solid rgba(148,163,184,0.35)',
                              background: 'linear-gradient(135deg, #60a5fa, #2563eb)',
                              color: '#0f172a',
                              fontWeight: 600,
                              cursor: savingId === tier.id ? 'not-allowed' : 'pointer',
                            }}
                          >
                            {savingId === tier.id ? 'Salvataggio…' : 'Salva'}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(tier)}
                            disabled={deletingId === tier.id}
                            style={{
                              padding: '0.55rem 1rem',
                              borderRadius: 10,
                              border: '1px solid rgba(239,68,68,0.5)',
                              background: 'transparent',
                              color: '#fca5a5',
                              fontWeight: 600,
                              cursor: deletingId === tier.id ? 'not-allowed' : 'pointer',
                            }}
                          >
                            {deletingId === tier.id ? 'Eliminazione…' : 'Elimina'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {tiers.length === 0 && (
                  <tr>
                    <td colSpan={6} style={{ padding: '1.5rem', textAlign: 'center', color: '#94a3b8', backgroundColor: '#0f172a' }}>
                      Nessun pacchetto configurato per questo evento.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
}
