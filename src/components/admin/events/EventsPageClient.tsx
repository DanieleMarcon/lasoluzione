"use client";

import { Fragment, useCallback, useMemo, useRef, useState, type FormEvent } from 'react';

import EventForm, { type EventFormState } from '@/components/admin/events/EventForm';
import { useToast } from '@/components/admin/ui/toast';

export type AdminEvent = {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  startAt: string;
  endAt: string | null;
  active: boolean;
  showOnHome: boolean;
  emailOnly: boolean;
  capacity: number | null;
  priceCents: number;
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

type Props = {
  initialEvents: AdminEvent[];
  initialMeta: PaginationMeta;
  initialQuery: QueryState;
};

const containerStyle = {
  padding: '2rem 3rem',
  display: 'grid',
  gap: '2rem',
  maxWidth: 1200,
  margin: '0 auto',
} as const;

const sectionStyle = {
  backgroundColor: '#1f2937',
  borderRadius: 18,
  padding: '1.75rem',
  color: '#f9fafb',
  boxShadow: '0 14px 34px rgba(15,23,42,0.3)',
  display: 'grid',
  gap: '1.5rem',
} as const;

const sectionTitleStyle = {
  margin: 0,
  fontSize: '1.35rem',
  fontWeight: 600,
} as const;

const inputStyle = {
  padding: '0.6rem 0.75rem',
  borderRadius: 10,
  border: '1px solid rgba(148,163,184,0.35)',
  backgroundColor: '#111827',
  color: '#f9fafb',
} as const;

const actionButtonStyle = {
  padding: '0.5rem 0.9rem',
  borderRadius: 10,
  border: '1px solid rgba(148,163,184,0.4)',
  backgroundColor: 'transparent',
  color: '#f8fafc',
  cursor: 'pointer',
  fontWeight: 600,
  fontSize: '0.9rem',
} as const;

const primaryButtonStyle = {
  ...actionButtonStyle,
  backgroundColor: '#2563eb',
  borderColor: '#2563eb',
} as const;

const dangerButtonStyle = {
  ...actionButtonStyle,
  borderColor: 'rgba(239,68,68,0.5)',
  color: '#fca5a5',
} as const;

const tableStyle = {
  width: '100%',
  borderCollapse: 'collapse',
} as const;

const thStyle = {
  textAlign: 'left',
  padding: '0.75rem',
  borderBottom: '1px solid rgba(148,163,184,0.3)',
  fontSize: '0.85rem',
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
  color: '#94a3b8',
} as const;

const tdStyle = {
  padding: '0.75rem',
  borderBottom: '1px solid rgba(148,163,184,0.1)',
  verticalAlign: 'top',
  fontSize: '0.95rem',
  color: '#e2e8f0',
} as const;

const DEFAULT_FORM_STATE: EventFormState = {
  title: '',
  slug: '',
  startAt: '',
  endAt: '',
  priceEuro: '0,00',
  description: '',
  capacity: '',
  active: true,
  showOnHome: false,
  emailOnly: false,
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

function formatDateTimeDisplay(startIso: string, endIso: string | null) {
  const start = new Date(startIso);
  if (Number.isNaN(start.getTime())) return '—';
  const startLabel = start.toLocaleString('it-IT', { dateStyle: 'short', timeStyle: 'short' });
  if (!endIso) return startLabel;
  const end = new Date(endIso);
  if (Number.isNaN(end.getTime())) return startLabel;
  const sameDay =
    start.getFullYear() === end.getFullYear() &&
    start.getMonth() === end.getMonth() &&
    start.getDate() === end.getDate();
  const endLabel = end.toLocaleString('it-IT', { dateStyle: sameDay ? undefined : 'short', timeStyle: 'short' });
  return sameDay ? `${startLabel} → ${end.toLocaleTimeString('it-IT', { timeStyle: 'short' })}` : `${startLabel} → ${endLabel}`;
}

function formatMoney(cents: number) {
  return (cents / 100).toLocaleString('it-IT', { style: 'currency', currency: 'EUR' });
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

function buildFormState(event: AdminEvent): EventFormState {
  return {
    title: event.title,
    slug: event.slug,
    startAt: formatDateTimeForInput(event.startAt),
    endAt: formatDateTimeForInput(event.endAt),
    priceEuro: formatPriceInput(event.priceCents),
    description: event.description ?? '',
    capacity: event.capacity != null ? String(event.capacity) : '',
    active: event.active,
    showOnHome: event.showOnHome,
    emailOnly: event.emailOnly,
  };
}

export default function EventsPageClient({ initialEvents, initialMeta, initialQuery }: Props) {
  const toast = useToast();

  const [events, setEvents] = useState<AdminEvent[]>(initialEvents);
  const [meta, setMeta] = useState<PaginationMeta>(initialMeta);
  const [query, setQuery] = useState<QueryState>(initialQuery);
  const queryRef = useRef<QueryState>(initialQuery);
  const [searchInput, setSearchInput] = useState(initialQuery.search);
  const [loading, setLoading] = useState(false);

  const [createForm, setCreateForm] = useState<EventFormState>(DEFAULT_FORM_STATE);
  const [createSlugEdited, setCreateSlugEdited] = useState(false);
  const [creating, setCreating] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, EventFormState>>({});
  const [rowSaving, setRowSaving] = useState<Record<string, boolean>>({});
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchEvents = useCallback(
    async (params: QueryState) => {
      setLoading(true);
      try {
        const searchParams = new URLSearchParams();
        if (params.search.trim()) searchParams.set('search', params.search.trim());
        if (params.active !== 'all') searchParams.set('active', params.active);
        searchParams.set('page', String(params.page));
        searchParams.set('size', String(meta.pageSize));

        const res = await fetch(`/api/admin/events?${searchParams.toString()}`, { cache: 'no-store' });
        const body = await res.json().catch(() => null);
        if (!res.ok || !body?.ok) {
          toast.error('Impossibile caricare gli eventi');
          return;
        }
        setEvents(body.data as AdminEvent[]);
        setMeta(body.meta as PaginationMeta);
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

  const resetCreateForm = () => {
    setCreateForm(DEFAULT_FORM_STATE);
    setCreateSlugEdited(false);
  };

  const handleCreateChange = <K extends keyof EventFormState>(field: K, value: EventFormState[K]) => {
    setCreateForm((prev) => {
      if (field === 'title') {
        const typedValue = String(value);
        const next = { ...prev, title: typedValue };
        if (!createSlugEdited) {
          next.slug = slugify(typedValue);
        }
        return next;
      }
      if (field === 'slug') {
        const typedValue = String(value);
        setCreateSlugEdited(Boolean(typedValue.trim()));
        return { ...prev, slug: typedValue };
      }
      return { ...prev, [field]: value };
    });
  };

  const handleCreateSlugBlur = () => {
    setCreateForm((prev) => ({ ...prev, slug: prev.slug.trim() || slugify(prev.title) }));
  };

  const handleCreateSubmit = async (eventObj: FormEvent<HTMLFormElement>) => {
    eventObj.preventDefault();
    if (creating) return;

    const title = createForm.title.trim();
    const slug = createForm.slug.trim();
    const description = createForm.description.trim();

    if (title.length < 3) {
      toast.error('Il titolo deve contenere almeno 3 caratteri');
      return;
    }
    if (slug.length < 3) {
      toast.error('Slug troppo corto');
      return;
    }

    const startAtIso = parseDateTimeInput(createForm.startAt);
    if (!startAtIso) {
      toast.error('Specifica una data di inizio valida');
      return;
    }

    const endAtIso = parseDateTimeInput(createForm.endAt);
    if (createForm.endAt && !endAtIso) {
      toast.error('Specifica una data di fine valida');
      return;
    }

    const priceCents = parsePriceInput(createForm.priceEuro);
    if (priceCents == null) {
      toast.error('Prezzo non valido');
      return;
    }

    let capacity: number | null = null;
    if (createForm.capacity.trim()) {
      const parsedCapacity = Number.parseInt(createForm.capacity, 10);
      if (!Number.isFinite(parsedCapacity) || parsedCapacity < 1) {
        toast.error('Capacità non valida');
        return;
      }
      capacity = parsedCapacity;
    }

    const payload = {
      title,
      slug,
      description: description || null,
      startAt: startAtIso,
      endAt: endAtIso ?? undefined,
      active: createForm.active,
      showOnHome: createForm.showOnHome,
      emailOnly: createForm.emailOnly,
      capacity,
      priceCents,
    };

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
        toast.error(body?.message ?? "Impossibile creare l'evento");
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
    setDrafts((prev) => ({ ...prev, [event.id]: buildFormState(event) }));
  };

  const cancelEditing = (eventId: string) => {
    setEditingId((prev) => (prev === eventId ? null : prev));
    setDrafts((prev) => {
      const next = { ...prev };
      delete next[eventId];
      return next;
    });
  };

  const updateDraft = <K extends keyof EventFormState>(eventId: string, field: K, value: EventFormState[K]) => {
    setDrafts((prev) => {
      const base = prev[eventId] ?? (() => {
        const event = events.find((item) => item.id === eventId);
        return event ? buildFormState(event) : DEFAULT_FORM_STATE;
      })();
      let next: EventFormState = base;
      if (field === 'title') {
        next = { ...base, title: String(value) };
      } else if (field === 'slug') {
        next = { ...base, slug: String(value) };
      } else {
        next = { ...base, [field]: value };
      }
      return { ...prev, [eventId]: next };
    });
  };

  const handleDraftSlugBlur = (eventId: string) => {
    setDrafts((prev) => {
      const current = prev[eventId];
      if (!current) return prev;
      return { ...prev, [eventId]: { ...current, slug: current.slug.trim() || slugify(current.title) } };
    });
  };

  const saveDraft = async (eventId: string) => {
    const draft = drafts[eventId];
    const event = events.find((item) => item.id === eventId);
    if (!draft || !event) return;

    const title = draft.title.trim();
    const slug = draft.slug.trim();
    const description = draft.description.trim();

    if (title.length < 3) {
      toast.error('Il titolo deve contenere almeno 3 caratteri');
      return;
    }
    if (slug.length < 3) {
      toast.error('Slug troppo corto');
      return;
    }

    const startAtIso = parseDateTimeInput(draft.startAt);
    if (!startAtIso) {
      toast.error('Specifica una data di inizio valida');
      return;
    }

    const endAtIso = parseDateTimeInput(draft.endAt);
    if (draft.endAt && !endAtIso) {
      toast.error('Specifica una data di fine valida');
      return;
    }

    const priceCents = parsePriceInput(draft.priceEuro);
    if (priceCents == null) {
      toast.error('Prezzo non valido');
      return;
    }

    let capacity: number | null = null;
    if (draft.capacity.trim()) {
      const parsedCapacity = Number.parseInt(draft.capacity, 10);
      if (!Number.isFinite(parsedCapacity) || parsedCapacity < 1) {
        toast.error('Capacità non valida');
        return;
      }
      capacity = parsedCapacity;
    }

    const payload = {
      title,
      slug,
      description: description || null,
      startAt: startAtIso,
      endAt: draft.endAt ? endAtIso : null,
      active: draft.active,
      showOnHome: draft.showOnHome,
      emailOnly: draft.emailOnly,
      capacity,
      priceCents,
    };

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
        toast.error(body?.message ?? "Impossibile aggiornare l'evento");
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

  const deleteEvent = async (eventId: string) => {
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
        toast.error(body?.message ?? "Impossibile eliminare l'evento");
        return;
      }
      toast.success('Evento eliminato');
      await refresh();
    } catch (error) {
      console.error('[admin][events] delete error', error);
      toast.error("Errore di rete durante l'eliminazione");
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
    const draft = drafts[event.id] ?? (isEditing ? buildFormState(event) : undefined);

    return (
      <Fragment key={event.id}>
        <tr>
          <td style={tdStyle}>
            <div style={{ display: 'grid', gap: '0.25rem' }}>
              <strong style={{ fontSize: '1rem' }}>{event.title}</strong>
              <span style={{ fontSize: '0.85rem', color: '#94a3b8' }}>{event.slug}</span>
              {event.description ? (
                <span style={{ fontSize: '0.85rem', color: '#cbd5f5' }}>{event.description}</span>
              ) : null}
            </div>
          </td>
          <td style={tdStyle}>{formatDateTimeDisplay(event.startAt, event.endAt)}</td>
          <td style={tdStyle}>{formatMoney(event.priceCents)}</td>
          <td style={tdStyle}>{event.emailOnly ? 'Email' : 'Checkout'}</td>
          <td style={tdStyle}>{event.active ? 'Sì' : 'No'}</td>
          <td style={tdStyle}>{event.showOnHome ? 'Sì' : 'No'}</td>
          <td style={tdStyle}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
              {isEditing ? (
                <>
                  <button
                    type="button"
                    style={primaryButtonStyle}
                    onClick={() => saveDraft(event.id)}
                    disabled={rowSaving[event.id]}
                  >
                    {rowSaving[event.id] ? 'Salvataggio…' : 'Salva'}
                  </button>
                  <button type="button" style={actionButtonStyle} onClick={() => cancelEditing(event.id)}>
                    Annulla
                  </button>
                </>
              ) : (
                <button type="button" style={actionButtonStyle} onClick={() => startEditing(event)}>
                  Modifica
                </button>
              )}
              <button
                type="button"
                style={dangerButtonStyle}
                onClick={() => deleteEvent(event.id)}
                disabled={deletingId === event.id}
              >
                {deletingId === event.id ? 'Eliminazione…' : 'Elimina'}
              </button>
            </div>
          </td>
        </tr>
        {isEditing && draft ? (
          <tr>
            <td style={{ ...tdStyle, backgroundColor: '#111827' }} colSpan={7}>
              <EventForm
                values={draft}
                onFieldChange={(field, value) => updateDraft(event.id, field, value)}
                onSubmit={(e) => {
                  e.preventDefault();
                  void saveDraft(event.id);
                }}
                submitLabel="Salva modifiche"
                busyLabel="Salvataggio…"
                busy={rowSaving[event.id]}
                onSlugBlur={() => handleDraftSlugBlur(event.id)}
              />
            </td>
          </tr>
        ) : null}
      </Fragment>
    );
  };

  return (
    <div style={containerStyle}>
      <section style={sectionStyle}>
        <h2 style={sectionTitleStyle}>Crea nuovo evento</h2>
        <EventForm
          values={createForm}
          onFieldChange={handleCreateChange}
          onSubmit={handleCreateSubmit}
          submitLabel="Crea evento"
          busyLabel="Creazione…"
          busy={creating}
          onSlugBlur={handleCreateSlugBlur}
        />
      </section>

      <section style={sectionStyle}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', alignItems: 'center' }}>
          <h2 style={sectionTitleStyle}>Eventi</h2>
          <span style={{ color: '#94a3b8', fontSize: '0.9rem' }}>{pageLabel}</span>
        </div>

        <form
          onSubmit={(eventObj) => {
            eventObj.preventDefault();
            void applyQuery({ search: searchInput, page: 1 });
          }}
          style={{ display: 'flex', gap: '1rem', marginBottom: '1.25rem', flexWrap: 'wrap' }}
        >
          <input
            type="text"
            placeholder="Cerca per titolo o slug"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            style={{ ...inputStyle, minWidth: 220 }}
          />
          <select
            value={query.active}
            onChange={(e) => void applyQuery({ active: e.target.value as QueryState['active'], page: 1 })}
            style={inputStyle}
          >
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
                <th style={thStyle}>Prezzo</th>
                <th style={thStyle}>Modalità</th>
                <th style={thStyle}>Attivo</th>
                <th style={thStyle}>Home</th>
                <th style={thStyle}>Azioni</th>
              </tr>
            </thead>
            <tbody>{events.map(renderRow)}</tbody>
          </table>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'flex-end' }}>
          <button
            type="button"
            style={actionButtonStyle}
            disabled={!meta.hasPreviousPage || loading}
            onClick={() => void applyQuery({ page: Math.max(1, meta.page - 1) })}
          >
            Precedente
          </button>
          <button
            type="button"
            style={actionButtonStyle}
            disabled={!meta.hasNextPage || loading}
            onClick={() => void applyQuery({ page: meta.page + 1 })}
          >
            Successiva
          </button>
        </div>
      </section>
    </div>
  );
}
