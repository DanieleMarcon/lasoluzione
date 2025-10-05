'use client';

import { useCallback, useMemo, useState } from 'react';

import { ToastProvider, useToast } from '@/components/admin/ui/toast';

export type AdminTierRow = {
  id: string;
  type: 'evento' | 'aperitivo';
  label: string;
  priceCents: number;
  order: number;
  active: boolean;
  createdAt: string;
  updatedAt: string;
};

export type TiersMeta = {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

type Props = {
  initialTiers: AdminTierRow[];
  initialMeta: TiersMeta;
};

type TierDraft = {
  label: string;
  priceCents: number;
  order: number;
};

type CreateFormState = {
  type: 'evento' | 'aperitivo';
  label: string;
  priceCents: number;
  order: number;
};

const DEFAULT_CREATE_FORM: CreateFormState = {
  type: 'evento',
  label: '',
  priceCents: 0,
  order: 0,
};

function toDraftMap(rows: AdminTierRow[]): Record<string, TierDraft> {
  return rows.reduce<Record<string, TierDraft>>((acc, row) => {
    acc[row.id] = {
      label: row.label,
      priceCents: row.priceCents,
      order: row.order,
    };
    return acc;
  }, {});
}

function formatMoney(cents: number) {
  return (cents / 100).toLocaleString('it-IT', { style: 'currency', currency: 'EUR' });
}

function TiersManagerInner({ initialTiers, initialMeta }: Props) {
  const toast = useToast();
  const [tiers, setTiers] = useState<AdminTierRow[]>(initialTiers);
  const [meta, setMeta] = useState<TiersMeta>(initialMeta);
  const [pageSize, setPageSize] = useState(initialMeta.pageSize ?? 20);
  const [drafts, setDrafts] = useState<Record<string, TierDraft>>(() => toDraftMap(initialTiers));
  const [filters, setFilters] = useState<{ type: 'all' | 'evento' | 'aperitivo'; q: string }>(
    () => ({ type: 'all', q: '' })
  );
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createForm, setCreateForm] = useState<CreateFormState>({ ...DEFAULT_CREATE_FORM });

  const loadTiers = useCallback(
    async (options?: { page?: number; pageSize?: number }) => {
      const targetPage = options?.page ?? meta.page;
      const targetPageSize = options?.pageSize ?? pageSize;

      setLoading(true);
      const params = new URLSearchParams();
      params.set('page', String(targetPage));
      params.set('pageSize', String(targetPageSize));
      params.set('type', filters.type);
      if (filters.q.trim()) {
        params.set('q', filters.q.trim());
      }

      try {
        const res = await fetch(`/api/admin/tiers?${params.toString()}`, { cache: 'no-store' });
        const body = await res.json().catch(() => ({}));
        if (!res.ok || !body?.ok) {
          toast.error(body?.error || 'Impossibile caricare i pacchetti');
          return;
        }

        const data = (body.data ?? []) as AdminTierRow[];
        const responseMeta = body.meta ?? {};
        const nextMeta: TiersMeta = {
          page: responseMeta.page ?? targetPage,
          pageSize: responseMeta.pageSize ?? targetPageSize,
          total: responseMeta.total ?? data.length,
          totalPages: responseMeta.totalPages ?? Math.max(1, Math.ceil((responseMeta.total ?? data.length) / targetPageSize)),
        };

        setTiers(data);
        setDrafts(toDraftMap(data));
        setMeta(nextMeta);
        setPageSize(nextMeta.pageSize);
      } catch (error) {
        console.error('[admin][tiers] load error', error);
        toast.error('Errore di rete durante il caricamento');
      } finally {
        setLoading(false);
      }
    },
    [filters.q, filters.type, meta.page, pageSize, toast]
  );

  const handleCreate = useCallback(async () => {
    if (!createForm.label.trim() || createForm.label.trim().length < 2) {
      toast.error("Inserisci un'etichetta valida");
      return;
    }

    if (!Number.isFinite(createForm.priceCents) || createForm.priceCents < 0) {
      toast.error('Prezzo non valido');
      return;
    }

    setCreating(true);
    try {
      const res = await fetch('/api/admin/tiers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: createForm.type,
          label: createForm.label.trim(),
          priceCents: Math.round(createForm.priceCents),
          order: Math.max(0, Math.round(createForm.order)),
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok || !body?.ok) {
        toast.error(body?.error === 'id_conflict' ? 'ID già esistente' : body?.error || 'Errore durante la creazione');
        return;
      }
      toast.success('Pacchetto creato');
      setCreateForm({ ...DEFAULT_CREATE_FORM });
      await loadTiers({ page: 1 });
    } catch (error) {
      console.error('[admin][tiers] create error', error);
      toast.error('Errore di rete durante la creazione');
    } finally {
      setCreating(false);
    }
  }, [createForm, loadTiers, toast]);

  const handleDraftChange = useCallback(
    (id: string, field: keyof TierDraft, value: string) => {
      setDrafts((current) => {
        const currentDraft = current[id] ?? { label: '', priceCents: 0, order: 0 };
        if (field === 'label') {
          return { ...current, [id]: { ...currentDraft, label: value } };
        }
        const numeric = Number.parseInt(value, 10);
        return { ...current, [id]: { ...currentDraft, [field]: Number.isFinite(numeric) ? numeric : 0 } };
      });
    },
    []
  );

  const handleSaveDraft = useCallback(
    async (tier: AdminTierRow) => {
      const draft = drafts[tier.id] ?? { label: tier.label, priceCents: tier.priceCents, order: tier.order };
      const trimmedLabel = draft.label.trim();
      if (!trimmedLabel || trimmedLabel.length < 2) {
        toast.error("L'etichetta deve avere almeno 2 caratteri");
        return;
      }

      if (!Number.isFinite(draft.priceCents) || draft.priceCents < 0) {
        toast.error('Prezzo non valido');
        return;
      }

      if (!Number.isFinite(draft.order) || draft.order < 0) {
        toast.error('Ordine non valido');
        return;
      }

      const changes: Record<string, unknown> = {};
      if (trimmedLabel !== tier.label) changes.label = trimmedLabel;
      if (draft.priceCents !== tier.priceCents) changes.priceCents = Math.round(draft.priceCents);
      if (draft.order !== tier.order) changes.order = Math.round(draft.order);

      if (Object.keys(changes).length === 0) {
        toast.show('info', 'Nessuna modifica da salvare');
        return;
      }

      setLoading(true);
      try {
        const res = await fetch(`/api/admin/tiers/${encodeURIComponent(tier.id)}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(changes),
        });
        const body = await res.json().catch(() => ({}));
        if (!res.ok || !body?.ok) {
          toast.error(body?.error || "Errore durante l'aggiornamento");
          return;
        }
        toast.success('Pacchetto aggiornato');
        await loadTiers();
      } catch (error) {
        console.error('[admin][tiers] save error', error);
        toast.error("Errore di rete durante l'aggiornamento");
      } finally {
        setLoading(false);
      }
    },
    [drafts, loadTiers, toast]
  );

  const handleToggleActive = useCallback(
    async (tier: AdminTierRow) => {
      setLoading(true);
      try {
        const res = await fetch(`/api/admin/tiers/${encodeURIComponent(tier.id)}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ active: !tier.active }),
        });
        const body = await res.json().catch(() => ({}));
        if (!res.ok || !body?.ok) {
          toast.error(body?.error || "Errore durante l'aggiornamento");
          return;
        }
        toast.success(`Pacchetto ${tier.active ? 'disattivato' : 'attivato'}`);
        await loadTiers();
      } catch (error) {
        console.error('[admin][tiers] toggle error', error);
        toast.error('Errore di rete');
      } finally {
        setLoading(false);
      }
    },
    [loadTiers, toast]
  );

  const handleDelete = useCallback(
    async (tier: AdminTierRow) => {
      if (!window.confirm(`Disattivare il pacchetto “${tier.label}”?`)) return;
      setLoading(true);
      try {
        const res = await fetch(`/api/admin/tiers/${encodeURIComponent(tier.id)}`, {
          method: 'DELETE',
        });
        const body = await res.json().catch(() => ({}));
        if (!res.ok || !body?.ok) {
          toast.error(body?.error || 'Errore durante la disattivazione');
          return;
        }
        toast.success('Pacchetto disattivato');
        await loadTiers();
      } catch (error) {
        console.error('[admin][tiers] delete error', error);
        toast.error('Errore di rete durante la disattivazione');
      } finally {
        setLoading(false);
      }
    },
    [loadTiers, toast]
  );

  const applyFilters = () => {
    loadTiers({ page: 1 });
  };

  const canGoPrev = meta.page > 1;
  const canGoNext = meta.page < meta.totalPages;

  const totalActive = useMemo(() => tiers.filter((tier) => tier.active).length, [tiers]);

  return (
    <section style={{ display: 'grid', gap: '1.5rem' }}>
      <header>
        <h1 style={{ fontSize: '1.75rem', margin: 0 }}>Pacchetti e formule</h1>
        <p style={{ color: '#6b7280', margin: '0.25rem 0 0' }}>
          Gestisci i pacchetti evento e aperitivo disponibili per le prenotazioni.
        </p>
      </header>

      <div
        style={{
          border: '1px solid #e5e7eb',
          borderRadius: 16,
          padding: '1.5rem',
          boxShadow: '0 10px 30px rgba(15,23,42,0.05)',
          display: 'grid',
          gap: '1rem',
          maxWidth: 520,
        }}
      >
        <h2 style={{ margin: 0 }}>Nuovo pacchetto</h2>
        <div style={{ display: 'grid', gap: '0.75rem' }}>
          <label style={{ display: 'grid', gap: '0.25rem' }}>
            <span>Tipo</span>
            <select
              value={createForm.type}
              onChange={(event) =>
                setCreateForm((prev) => ({ ...prev, type: event.target.value as 'evento' | 'aperitivo' }))
              }
            >
              <option value="evento">Evento</option>
              <option value="aperitivo">Aperitivo</option>
            </select>
          </label>
          <label style={{ display: 'grid', gap: '0.25rem' }}>
            <span>Etichetta *</span>
            <input
              type="text"
              value={createForm.label}
              onChange={(event) => setCreateForm((prev) => ({ ...prev, label: event.target.value }))}
            />
          </label>
          <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
            <label style={{ display: 'grid', gap: '0.25rem', flex: 1, minWidth: 160 }}>
              <span>Prezzo (centesimi)</span>
              <input
                type="number"
                min={0}
                value={createForm.priceCents}
                onChange={(event) =>
                  setCreateForm((prev) => ({ ...prev, priceCents: Number.parseInt(event.target.value, 10) || 0 }))
                }
              />
            </label>
            <label style={{ display: 'grid', gap: '0.25rem', width: 120 }}>
              <span>Ordine</span>
              <input
                type="number"
                min={0}
                value={createForm.order}
                onChange={(event) =>
                  setCreateForm((prev) => ({ ...prev, order: Number.parseInt(event.target.value, 10) || 0 }))
                }
              />
            </label>
          </div>
          <button type="button" className="btn" onClick={handleCreate} disabled={creating}>
            {creating ? 'Creazione…' : 'Crea pacchetto'}
          </button>
        </div>
      </div>

      <div
        style={{
          border: '1px solid #e5e7eb',
          borderRadius: 16,
          padding: '1.5rem',
          boxShadow: '0 10px 30px rgba(15,23,42,0.05)',
          display: 'grid',
          gap: '1rem',
        }}
      >
        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <label style={{ display: 'grid', gap: '0.25rem' }}>
            <span>Tipo</span>
            <select
              value={filters.type}
              onChange={(event) => setFilters((prev) => ({ ...prev, type: event.target.value as typeof prev.type }))}
            >
              <option value="all">Tutti</option>
              <option value="evento">Solo evento</option>
              <option value="aperitivo">Solo aperitivo</option>
            </select>
          </label>
          <label style={{ display: 'grid', gap: '0.25rem', flex: 1, minWidth: 220 }}>
            <span>Ricerca</span>
            <input
              type="text"
              value={filters.q}
              onChange={(event) => setFilters((prev) => ({ ...prev, q: event.target.value }))}
              placeholder="Cerca per etichetta"
            />
          </label>
          <label style={{ display: 'grid', gap: '0.25rem', width: 140 }}>
            <span>Elementi/pagina</span>
            <select
              value={pageSize}
              onChange={(event) => {
                const value = Number.parseInt(event.target.value, 10) || 20;
                setPageSize(value);
                loadTiers({ page: 1, pageSize: value });
              }}
            >
              <option value={10}>10</option>
              <option value={20}>20</option>
              <option value={50}>50</option>
            </select>
          </label>
          <button type="button" className="btn" onClick={applyFilters} disabled={loading}>
            Applica filtri
          </button>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ textAlign: 'left', backgroundColor: '#f9fafb' }}>
                <th style={{ padding: '0.75rem' }}>Etichetta</th>
                <th style={{ padding: '0.75rem' }}>Tipo</th>
                <th style={{ padding: '0.75rem' }}>Prezzo</th>
                <th style={{ padding: '0.75rem' }}>Ordine</th>
                <th style={{ padding: '0.75rem' }}>Stato</th>
                <th style={{ padding: '0.75rem' }}>Azioni</th>
              </tr>
            </thead>
            <tbody>
              {tiers.map((tier) => {
                const draft = drafts[tier.id] ?? { label: tier.label, priceCents: tier.priceCents, order: tier.order };
                return (
                  <tr key={tier.id} style={{ borderTop: '1px solid #e5e7eb' }}>
                    <td style={{ padding: '0.75rem', minWidth: 220 }}>
                      <input
                        type="text"
                        value={draft.label}
                        onChange={(event) => handleDraftChange(tier.id, 'label', event.target.value)}
                        style={{ width: '100%' }}
                      />
                      <div style={{ color: '#6b7280', fontSize: '0.85rem', marginTop: '0.25rem' }}>
                        ID: {tier.id}
                      </div>
                    </td>
                    <td style={{ padding: '0.75rem', textTransform: 'capitalize' }}>{tier.type}</td>
                    <td style={{ padding: '0.75rem', minWidth: 160 }}>
                      <div style={{ display: 'grid', gap: '0.35rem' }}>
                        <input
                          type="number"
                          value={draft.priceCents}
                          min={0}
                          onChange={(event) => handleDraftChange(tier.id, 'priceCents', event.target.value)}
                        />
                        <small style={{ color: '#6b7280' }}>{formatMoney(draft.priceCents)}</small>
                      </div>
                    </td>
                    <td style={{ padding: '0.75rem', width: 120 }}>
                      <input
                        type="number"
                        min={0}
                        value={draft.order}
                        onChange={(event) => handleDraftChange(tier.id, 'order', event.target.value)}
                      />
                    </td>
                    <td style={{ padding: '0.75rem' }}>
                      <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                        <input
                          type="checkbox"
                          checked={tier.active}
                          onChange={() => handleToggleActive(tier)}
                          disabled={loading}
                        />
                        {tier.active ? 'Attivo' : 'Off'}
                      </label>
                    </td>
                    <td style={{ padding: '0.75rem' }}>
                      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                        <button
                          type="button"
                          className="btn"
                          onClick={() => handleSaveDraft(tier)}
                          disabled={loading}
                        >
                          Salva
                        </button>
                        <button
                          type="button"
                          className="btn"
                          onClick={() => handleDelete(tier)}
                          disabled={loading}
                          style={{ backgroundColor: '#fee2e2', color: '#b91c1c' }}
                        >
                          Disattiva
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {tiers.length === 0 && (
                <tr>
                  <td colSpan={6} style={{ padding: '1.5rem', textAlign: 'center', color: '#6b7280' }}>
                    Nessun pacchetto trovato.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <footer
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '0.75rem',
          }}
        >
          <div style={{ color: '#6b7280' }}>
            Totale: {meta.total} · Attivi: {totalActive}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <button
              type="button"
              className="btn"
              onClick={() => loadTiers({ page: meta.page - 1 })}
              disabled={loading || !canGoPrev}
            >
              ← Prec.
            </button>
            <span>
              Pagina {meta.page} di {meta.totalPages}
            </span>
            <button
              type="button"
              className="btn"
              onClick={() => loadTiers({ page: meta.page + 1 })}
              disabled={loading || !canGoNext}
            >
              Succ. →
            </button>
          </div>
        </footer>
      </div>
    </section>
  );
}

export default function TiersManager(props: Props) {
  return (
    <ToastProvider>
      <TiersManagerInner {...props} />
    </ToastProvider>
  );
}
