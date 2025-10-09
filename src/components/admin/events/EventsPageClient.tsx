'use client';

import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ChangeEvent, CSSProperties, FormEvent } from 'react';

import { ToastProvider, useToast } from '@/components/admin/ui/toast';

export type AdminEvent = {
  id: number;
  slug: string;
  title: string;
  description: string | null;
  startAt: string;
  endAt: string | null;
  active: boolean;
  showOnHome: boolean;
  allowEmailOnlyBooking: boolean;
  capacity: number | null;
  createdAt: string;
  updatedAt: string;
};

export type PaginationMeta = {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
};

type QueryState = {
  search: string;
  active: 'all' | 'true' | 'false';
  page: number;
};

type EventDraft = {
  title: string;
  slug: string;
  description: string;
  startAt: string;
  endAt: string;
  active: boolean;
  showOnHome: boolean;
  allowEmailOnlyBooking: boolean;
  capacity: string;
};

type Props = {
  initialEvents: AdminEvent[];
  initialMeta: PaginationMeta;
  initialQuery: QueryState;
};

const containerStyle: CSSProperties = {
  padding: '2rem 3rem',
  display: 'grid',
  gap: '2rem',
  maxWidth: 1200,
};

const sectionStyle: CSSProperties = {
  backgroundColor: '#1f2937',
  borderRadius: 16,
  padding: '1.5rem',
  color: '#f9fafb',
  boxShadow: '0 12px 30px rgba(15,23,42,0.25)',
};

const sectionTitleStyle: CSSProperties = {
  margin: '0 0 1rem',
  fontSize: '1.25rem',
  fontWeight: 600,
};

const labelStyle: CSSProperties = {
  display: 'grid',
  gap: '0.35rem',
  fontSize: '0.95rem',
};

const inputStyle: CSSProperties = {
  padding: '0.6rem 0.75rem',
  borderRadius: 10,
  border: '1px solid rgba(148,163,184,0.35)',
  backgroundColor: '#111827',
  color: '#f9fafb',
};

const tableStyle: CSSProperties = {
  width: '100%',
  borderCollapse: 'collapse',
};

const thStyle: CSSProperties = {
  textAlign: 'left',
  padding: '0.75rem',
  borderBottom: '1px solid rgba(148,163,184,0.3)',
  fontSize: '0.85rem',
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
  color: '#94a3b8',
};

const tdStyle: CSSProperties = {
  padding: '0.75rem',
  borderBottom: '1px solid rgba(148,163,184,0.1)',
  verticalAlign: 'top',
  fontSize: '0.95rem',
  color: '#e2e8f0',
};

const actionButtonStyle: CSSProperties = {
  padding: '0.5rem 0.75rem',
  borderRadius: 10,
  border: '1px solid rgba(148,163,184,0.4)',
  backgroundColor: 'transparent',
  color: '#f8fafc',
  cursor: 'pointer',
  fontWeight: 600,
  fontSize: '0.9rem',
};

const dangerButtonStyle: CSSProperties = {
  ...actionButtonStyle,
  borderColor: 'rgba(239,68,68,0.5)',
  color: '#fca5a5',
};

const primaryButtonStyle: CSSProperties = {
  ...actionButtonStyle,
  backgroundColor: '#2563eb',
  borderColor: '#2563eb',
};

function slugify(value: string) {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-');
}

function formatDateTimeForInput(iso: string | null): string {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

function parseDateTimeInput(value: string): string | null {
  if (!value) return null;
  const [datePart, timePart] = value.split('T');
  if (!datePart || !timePart) return null;
  const [year, month, day] = datePart.split('-').map((x) => Number.parseInt(x, 10));
  const [hour, minute] = timePart.split(':').map((x) => Number.parseInt(x, 10));
  if (
    !Number.isFinite(year) ||
    !Number.isFinite(month) ||
    !Number.isFinite(day) ||
    !Number.isFinite(hour) ||
    !Number.isFinite(minute)
  ) {
    return null;
  }
  const date = new Date(year, month - 1, day, hour, minute);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

function formatDateTimeDisplay(iso: string | null) {
  if (!iso) return '—';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString('it-IT', {
    dateStyle: 'short',
    timeStyle: 'short',
  });
}

function buildDraft(event: AdminEvent): EventDraft {
  return {
    title: event.title,
    slug: event.slug,
    description: event.description ?? '',
    startAt: formatDateTimeForInput(event.startAt),
    endAt: formatDateTimeForInput(event.endAt),
    active: event.active,
    showOnHome: event.showOnHome,
    allowEmailOnlyBooking: event.allowEmailOnlyBooking,
    capacity: event.capacity != null ? String(event.capacity) : '',
  };
}

function EventsPageInner({ initialEvents, initialMeta, initialQuery }: Props) {
  const toast = useToast();

  const [events, setEvents] = useState<AdminEvent[]>(initialEvents);
  const [meta, setMeta] = useState<PaginationMeta>(initialMeta);
  const [query, setQuery] = useState<QueryState>(initialQuery);
  const queryRef = useRef<QueryState>(initialQuery);
  useEffect(() => {
    queryRef.current = query;
  }, [query]);

  const [loading, setLoading] = useState(false);

  const [searchInput, setSearchInput] = useState(initialQuery.search);

  const [createForm, setCreateForm] = useState<EventDraft>(() => ({
    title: '',
    slug: '',
    description: '',
    startAt: '',
    endAt: '',
    active: true,
    showOnHome: false,
    allowEmailOnlyBooking: false,
    capacity: '',
  }));
  const [createSlugEdited, setCreateSlugEdited] = useState(false);
  const [creating, setCreating] = useState(false);

  const [editingId, setEditingId] = useState<number | null>(null);
  const [drafts, setDrafts] = useState<Record<number, EventDraft>>({});
  const [rowSaving, setRowSaving] = useState<Record<number, boolean>>({});
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const fetchEvents = useCallback(
    async (params: QueryState) => {
      setLoading(true);
      try {
        const searchParams = new URLSearchParams();
        if (params.search.trim()) searchParams.set('search', params.search.trim());
        if (params.active !== 'all') searchParams.set('active', params.active);
        searchParams.set('page', String(params.page));
        searchParams.set('size', String(meta.pageSize));

        const res = await fetch(`/api/admin/events?${searchParams.toString()}`, {
          cache: 'no-store',
        });
        const body = await res.json().catch(() => null);
        if (!res.ok || !body?.ok) {
          toast.error('Impossibile caricare gli eventi');
          return;
        }
        setEvents(body.data);
        setMeta(body.meta);
      } catch (error) {
        console.error('[admin][events] fetch error', error);
        toast.error('Errore di rete durante il caricamento');
      } finally {
        setLoading(false);
      }
    },
    [meta.pageSize, toast],
  );

  const applyQuery = useCallback(
    async (patch: Partial<QueryState>) => {
      const next = { ...queryRef.current, ...patch };
      setQuery(next);
      queryRef.current = next;
      await fetchEvents(next);
    },
    [fetchEvents],
  );

  const refresh = useCallback(async () => {
    await fetchEvents(queryRef.current);
  }, [fetchEvents]);

  const handleSearchSubmit = async (event: FormEvent) => {
    event.preventDefault();
    await applyQuery({ search: searchInput, page: 1 });
  };

  const handleActiveFilterChange = async (event: ChangeEvent<HTMLSelectElement>) => {
    const value = event.target.value as QueryState['active'];
    await applyQuery({ active: value, page: 1 });
  };

  const handlePageChange = async (nextPage: number) => {
    await applyQuery({ page: nextPage });
  };

  const handleCreateFieldChange = (field: keyof EventDraft, value: string | boolean) => {
    setCreateForm((prev) => {
      if (field === 'active' || field === 'showOnHome' || field === 'allowEmailOnlyBooking') {
        return { ...prev, [field]: Boolean(value) } as EventDraft;
      }
      return { ...prev, [field]: value as string } as EventDraft;
    });
  };

  const handleCreateTitleChange = (event: ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value;
    setCreateForm((prev) => {
      const next = { ...prev, title: value };
      if (!createSlugEdited) {
        next.slug = slugify(value);
      }
      return next;
    });
  };

  const handleCreateSlugChange = (event: ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value;
    setCreateForm((prev) => ({ ...prev, slug: value }));
    setCreateSlugEdited(Boolean(value.trim()));
  };

  const resetCreateForm = () => {
    setCreateForm({
      title: '',
      slug: '',
      description: '',
      startAt: '',
      endAt: '',
      active: true,
      showOnHome: false,
      allowEmailOnlyBooking: false,
      capacity: '',
    });
    setCreateSlugEdited(false);
  };

  const handleCreateSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (creating) return;

    const payload: Record<string, unknown> = {
      title: createForm.title.trim(),
      slug: createForm.slug.trim(),
      description: createForm.description.trim() || null,
      active: createForm.active,
      showOnHome: createForm.showOnHome,
      allowEmailOnlyBooking: createForm.allowEmailOnlyBooking,
    };

    const startAtIso = parseDateTimeInput(createForm.startAt);
    if (!startAtIso) {
      toast.error('Specifica una data di inizio valida');
      return;
    }
    payload.startAt = startAtIso;

    const endAtIso = parseDateTimeInput(createForm.endAt);
    if (createForm.endAt && !endAtIso) {
      toast.error('Specifica una data di fine valida');
      return;
    }
    if (endAtIso) payload.endAt = endAtIso;

    if (createForm.capacity.trim()) {
      const parsedCapacity = Number.parseInt(createForm.capacity, 10);
      if (!Number.isFinite(parsedCapacity) || parsedCapacity < 1) {
        toast.error('Capacità non valida');
        return;
      }
      payload.capacity = parsedCapacity;
    } else {
      payload.capacity = null;
    }

    setCreating(true);
    try {
      const res = await fetch('/api/admin/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        cache: 'no-store',
      });
      const body = await res.json().catch(() => null);
      if (!res.ok || !body?.ok) {
        toast.error(body?.message ?? 'Impossibile creare l\'evento');
        return;
      }
      toast.success('Evento creato');
      resetCreateForm();
      await refresh();
    } catch (error) {
      console.error('[admin][events] create error', error);
      toast.error('Errore di rete durante la creazione');
    } finally {
      setCreating(false);
    }
  };

  const startEditing = (event: AdminEvent) => {
    setEditingId(event.id);
    setDrafts((prev) => ({ ...prev, [event.id]: buildDraft(event) }));
  };

  const cancelEditing = (eventId: number) => {
    setEditingId((prev) => (prev === eventId ? null : prev));
    setDrafts((prev) => {
      const next = { ...prev };
      delete next[eventId];
      return next;
    });
  };

  const updateDraft = (eventId: number, patch: Partial<EventDraft>) => {
    setDrafts((prev) => {
      const base = prev[eventId] ?? (() => {
        const event = events.find((e) => e.id === eventId);
        return event ? buildDraft(event) : null;
      })();
      if (!base) return prev;
      return { ...prev, [eventId]: { ...base, ...patch } };
    });
  };

  const saveDraft = async (eventId: number) => {
    const draft = drafts[eventId];
    if (!draft) return;

    const payload: Record<string, unknown> = {
      title: draft.title.trim(),
      slug: draft.slug.trim(),
      description: draft.description.trim() || null,
      active: draft.active,
      showOnHome: draft.showOnHome,
      allowEmailOnlyBooking: draft.allowEmailOnlyBooking,
    };

    const startAtIso = parseDateTimeInput(draft.startAt);
    if (!startAtIso) {
      toast.error('Specifica una data di inizio valida');
      return;
    }
    payload.startAt = startAtIso;

    if (draft.endAt) {
      const endAtIso = parseDateTimeInput(draft.endAt);
      if (!endAtIso) {
        toast.error('Specifica una data di fine valida');
        return;
      }
      payload.endAt = endAtIso;
    } else {
      payload.endAt = null;
    }

    if (draft.capacity.trim()) {
      const parsedCapacity = Number.parseInt(draft.capacity, 10);
      if (!Number.isFinite(parsedCapacity) || parsedCapacity < 1) {
        toast.error('Capacità non valida');
        return;
      }
      payload.capacity = parsedCapacity;
    } else {
      payload.capacity = null;
    }

    setRowSaving((prev) => ({ ...prev, [eventId]: true }));
    try {
      const res = await fetch(`/api/admin/events/${eventId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        cache: 'no-store',
      });
      const body = await res.json().catch(() => null);
      if (!res.ok || !body?.ok) {
        toast.error(body?.message ?? 'Impossibile aggiornare l\'evento');
        return;
      }
      toast.success('Evento aggiornato');
      await refresh();
      cancelEditing(eventId);
    } catch (error) {
      console.error('[admin][events] update error', error);
      toast.error('Errore di rete durante il salvataggio');
    } finally {
      setRowSaving((prev) => ({ ...prev, [eventId]: false }));
    }
  };

  const deleteEvent = async (eventId: number) => {
    if (!window.confirm('Eliminare definitivamente questo evento?')) {
      return;
    }
    setDeletingId(eventId);
    try {
      const res = await fetch(`/api/admin/events/${eventId}`, {
        method: 'DELETE',
        cache: 'no-store',
      });
      const body = await res.json().catch(() => null);
      if (!res.ok || !body?.ok) {
        toast.error(body?.message ?? 'Impossibile eliminare l\'evento');
        return;
      }
      if (body.softDeleted) {
        toast.success('Evento disattivato');
      } else {
        toast.success('Evento eliminato');
      }
      await refresh();
    } catch (error) {
      console.error('[admin][events] delete error', error);
      toast.error('Errore di rete durante l\'eliminazione');
    } finally {
      setDeletingId(null);
    }
  };

  const pageLabel = useMemo(() => {
    if (!meta.total) return 'Nessun evento';
    return `Pagina ${meta.page} di ${meta.totalPages}`;
  }, [meta.page, meta.total, meta.totalPages]);

  const renderRow = (event: AdminEvent) => {
    const isEditing = editingId === event.id;
    const draft = isEditing ? drafts[event.id] : null;
    return (
      <>
        <tr key={event.id}>
          <td style={tdStyle}>
            <strong>{event.title}</strong>
            {event.description ? (
              <p style={{ margin: '0.35rem 0 0', fontSize: '0.85rem', color: '#cbd5f5' }}>{event.description}</p>
            ) : null}
          </td>
          <td style={tdStyle}>{formatDateTimeDisplay(event.startAt)}</td>
          <td style={tdStyle}>
            <code>{event.slug}</code>
          </td>
          <td style={tdStyle}>{event.active ? '✅' : '⛔️'}</td>
          <td style={tdStyle}>{event.showOnHome ? '✅' : '—'}</td>
          <td style={tdStyle}>{event.allowEmailOnlyBooking ? '✅' : '—'}</td>
          <td style={{ ...tdStyle, display: 'flex', gap: '0.5rem' }}>
            {isEditing ? (
              <>
                <button
                  type="button"
                  onClick={() => saveDraft(event.id)}
                  style={primaryButtonStyle}
                  disabled={rowSaving[event.id]}
                >
                  {rowSaving[event.id] ? 'Salvataggio…' : 'Salva'}
                </button>
                <button type="button" onClick={() => cancelEditing(event.id)} style={actionButtonStyle}>
                  Annulla
                </button>
              </>
            ) : (
              <>
                <button type="button" onClick={() => startEditing(event)} style={actionButtonStyle}>
                  Modifica
                </button>
                <button
                  type="button"
                  onClick={() => deleteEvent(event.id)}
                  style={dangerButtonStyle}
                  disabled={deletingId === event.id}
                >
                  {deletingId === event.id ? 'Eliminazione…' : 'Elimina'}
                </button>
              </>
            )}
          </td>
        </tr>
        {isEditing && draft ? (
          <tr key={`${event.id}-editor`}>
            <td style={{ ...tdStyle, backgroundColor: '#111827' }} colSpan={7}>
              <div style={{ display: 'grid', gap: '1rem' }}>
                <div style={{ display: 'grid', gap: '0.75rem', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
                  <label style={labelStyle}>
                    Titolo
                    <input
                      type="text"
                      value={draft.title}
                      onChange={(e) => updateDraft(event.id, { title: e.target.value })}
                      style={inputStyle}
                    />
                  </label>
                  <label style={labelStyle}>
                    Slug
                    <input
                      type="text"
                      value={draft.slug}
                      onChange={(e) => updateDraft(event.id, { slug: e.target.value })}
                      style={inputStyle}
                    />
                  </label>
                  <label style={labelStyle}>
                    Inizio
                    <input
                      type="datetime-local"
                      value={draft.startAt}
                      onChange={(e) => updateDraft(event.id, { startAt: e.target.value })}
                      style={inputStyle}
                    />
                  </label>
                  <label style={labelStyle}>
                    Fine
                    <input
                      type="datetime-local"
                      value={draft.endAt}
                      onChange={(e) => updateDraft(event.id, { endAt: e.target.value })}
                      style={inputStyle}
                    />
                  </label>
                  <label style={labelStyle}>
                    Capacità
                    <input
                      type="number"
                      min={1}
                      value={draft.capacity}
                      onChange={(e) => updateDraft(event.id, { capacity: e.target.value })}
                      style={inputStyle}
                    />
                  </label>
                </div>
                <label style={labelStyle}>
                  Descrizione
                  <textarea
                    value={draft.description}
                    onChange={(e) => updateDraft(event.id, { description: e.target.value })}
                    style={{ ...inputStyle, minHeight: 120, resize: 'vertical' }}
                  />
                </label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1.5rem' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <input
                      type="checkbox"
                      checked={draft.active}
                      onChange={(e) => updateDraft(event.id, { active: e.target.checked })}
                    />
                    Attivo
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <input
                      type="checkbox"
                      checked={draft.showOnHome}
                      onChange={(e) => updateDraft(event.id, { showOnHome: e.target.checked })}
                    />
                    Mostra in home
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <input
                      type="checkbox"
                      checked={draft.allowEmailOnlyBooking}
                      onChange={(e) => updateDraft(event.id, { allowEmailOnlyBooking: e.target.checked })}
                    />
                    Prenotazione email-only
                  </label>
                </div>
              </div>
            </td>
          </tr>
        ) : null}
      </>
    );
  };

  return (
    <div style={containerStyle}>
      <section style={sectionStyle}>
        <h1 style={sectionTitleStyle}>Nuovo evento</h1>
        <form onSubmit={handleCreateSubmit} style={{ display: 'grid', gap: '1rem' }}>
          <div style={{ display: 'grid', gap: '0.75rem', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
            <label style={labelStyle}>
              Titolo
              <input type="text" value={createForm.title} onChange={handleCreateTitleChange} style={inputStyle} required />
            </label>
            <label style={labelStyle}>
              Slug
              <input
                type="text"
                value={createForm.slug}
                onChange={handleCreateSlugChange}
                onBlur={() => {
                  setCreateForm((prev) => ({ ...prev, slug: prev.slug.trim() || slugify(prev.title) }));
                }}
                style={inputStyle}
                required
              />
            </label>
            <label style={labelStyle}>
              Inizio
              <input
                type="datetime-local"
                value={createForm.startAt}
                onChange={(e) => handleCreateFieldChange('startAt', e.target.value)}
                style={inputStyle}
                required
              />
            </label>
            <label style={labelStyle}>
              Fine
              <input
                type="datetime-local"
                value={createForm.endAt}
                onChange={(e) => handleCreateFieldChange('endAt', e.target.value)}
                style={inputStyle}
              />
            </label>
            <label style={labelStyle}>
              Capacità
              <input
                type="number"
                min={1}
                value={createForm.capacity}
                onChange={(e) => handleCreateFieldChange('capacity', e.target.value)}
                style={inputStyle}
              />
            </label>
          </div>
          <label style={labelStyle}>
            Descrizione
            <textarea
              value={createForm.description}
              onChange={(e) => handleCreateFieldChange('description', e.target.value)}
              style={{ ...inputStyle, minHeight: 120, resize: 'vertical' }}
              maxLength={2000}
            />
          </label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1.5rem' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <input
                type="checkbox"
                checked={createForm.active}
                onChange={(e) => handleCreateFieldChange('active', e.target.checked)}
              />
              Attivo
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <input
                type="checkbox"
                checked={createForm.showOnHome}
                onChange={(e) => handleCreateFieldChange('showOnHome', e.target.checked)}
              />
              Mostra in home
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <input
                type="checkbox"
                checked={createForm.allowEmailOnlyBooking}
                onChange={(e) => handleCreateFieldChange('allowEmailOnlyBooking', e.target.checked)}
              />
              Prenotazione email-only
            </label>
          </div>
          <div>
            <button type="submit" style={primaryButtonStyle} disabled={creating}>
              {creating ? 'Creazione…' : 'Crea evento'}
            </button>
          </div>
        </form>
      </section>

      <section style={sectionStyle}>
        <h2 style={sectionTitleStyle}>Eventi</h2>
        <form onSubmit={handleSearchSubmit} style={{ display: 'flex', gap: '1rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
          <input
            type="text"
            placeholder="Cerca per titolo o slug"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            style={{ ...inputStyle, minWidth: 220 }}
          />
          <select value={query.active} onChange={handleActiveFilterChange} style={inputStyle}>
            <option value="all">Tutti</option>
            <option value="true">Solo attivi</option>
            <option value="false">Solo sospesi</option>
          </select>
          <button type="submit" style={actionButtonStyle} disabled={loading}>
            {loading ? 'Ricerca…' : 'Filtra'}
          </button>
          <button
            type="button"
            style={actionButtonStyle}
            onClick={() => {
              setSearchInput('');
              void applyQuery({ search: '', page: 1 });
            }}
          >
            Reset
          </button>
        </form>

        <div style={{ overflowX: 'auto' }}>
          <table style={tableStyle}>
            <thead>
              <tr>
                <th style={thStyle}>Titolo</th>
                <th style={thStyle}>Data</th>
                <th style={thStyle}>Slug</th>
                <th style={thStyle}>Attivo</th>
                <th style={thStyle}>Home</th>
                <th style={thStyle}>Email-only</th>
                <th style={thStyle}>Azioni</th>
              </tr>
            </thead>
            <tbody>
              {events.length ? (
                events.map((event) => <Fragment key={event.id}>{renderRow(event)}</Fragment>)
              ) : (
                <tr>
                  <td style={{ ...tdStyle, textAlign: 'center' }} colSpan={7}>
                    {loading ? 'Caricamento…' : 'Nessun evento trovato'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '1rem', alignItems: 'center' }}>
          <span style={{ color: '#cbd5f5', fontSize: '0.9rem' }}>{pageLabel}</span>
          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <button
              type="button"
              style={actionButtonStyle}
              onClick={() => handlePageChange(Math.max(1, meta.page - 1))}
              disabled={!meta.hasPreviousPage || loading}
            >
              ← Precedente
            </button>
            <button
              type="button"
              style={actionButtonStyle}
              onClick={() => handlePageChange(Math.min(meta.totalPages, meta.page + 1))}
              disabled={!meta.hasNextPage || loading}
            >
              Successiva →
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}

export default function EventsPageClient(props: Props) {
  return (
    <ToastProvider>
      <EventsPageInner {...props} />
    </ToastProvider>
  );
}
