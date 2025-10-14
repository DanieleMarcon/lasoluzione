"use client";

import { useCallback, useMemo, useState, type CSSProperties } from 'react';

import { useToast } from '@/components/admin/ui/toast';

type AssignmentRow = {
  eventId: string;
  order: number;
  featured: boolean;
  showInHome: boolean;
  title: string;
  slug: string;
  startAt: string;
  endAt: string | null;
  priceCents: number;
  emailOnly: boolean;
  active: boolean;
};

type SearchResult = {
  id: string;
  title: string;
  slug: string;
  startAt: string;
  endAt: string | null;
  priceCents: number;
  emailOnly: boolean;
  active: boolean;
};

type DraftState = {
  order: string;
  featured: boolean;
  showInHome: boolean;
};

export type SectionEventAssignment = AssignmentRow;

type Props = {
  sectionKey: string;
  sectionTitle: string;
  initialAssignments: AssignmentRow[];
};

export type SectionEventsClientProps = Props;

export default function SectionEventsClient({ sectionKey, sectionTitle, initialAssignments }: Props) {
  const toast = useToast();

  const [assignments, setAssignments] = useState<AssignmentRow[]>(() =>
    [...initialAssignments].sort((a, b) => (a.order !== b.order ? a.order - b.order : a.title.localeCompare(b.title, 'it'))),
  );
  const [drafts, setDrafts] = useState<Record<string, DraftState>>(() => {
    const next: Record<string, DraftState> = {};
    for (const assignment of initialAssignments) {
      next[assignment.eventId] = {
        order: String(assignment.order),
        featured: assignment.featured,
        showInHome: assignment.showInHome,
      };
    }
    return next;
  });
  const [savingMap, setSavingMap] = useState<Record<string, boolean>>({});
  const [removingId, setRemovingId] = useState<string | null>(null);

  const [searchTerm, setSearchTerm] = useState('');
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [assigning, setAssigning] = useState(false);

  const assignedIds = useMemo(() => new Set(assignments.map((item) => item.eventId)), [assignments]);

  const formatDateRange = (startIso: string, endIso: string | null) => {
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
  };

  const formatPrice = (cents: number) => (cents / 100).toLocaleString('it-IT', { style: 'currency', currency: 'EUR' });

  const updateDraft = (eventId: string, patch: Partial<DraftState>) => {
    setDrafts((prev) => {
      const current = prev[eventId] ?? { order: '0', featured: false, showInHome: false };
      return { ...prev, [eventId]: { ...current, ...patch } };
    });
  };

  const hasChanges = (eventId: string) => {
    const assignment = assignments.find((item) => item.eventId === eventId);
    const draft = drafts[eventId];
    if (!assignment || !draft) return false;
    const orderValue = Number.parseInt(draft.order, 10);
    return (
      (Number.isFinite(orderValue) ? orderValue : assignment.order) !== assignment.order ||
      draft.featured !== assignment.featured ||
      draft.showInHome !== assignment.showInHome
    );
  };

  const searchEvents = useCallback(async () => {
    if (!searchTerm.trim()) {
      setSearchResults([]);
      setSelectedEventId(null);
      return;
    }
    setSearchLoading(true);
    try {
      const params = new URLSearchParams({ search: searchTerm.trim(), size: '20' });
      const res = await fetch(`/api/admin/events?${params.toString()}`, { cache: 'no-store' });
      const body = await res.json().catch(() => null);
      if (!res.ok || !body?.ok) {
        toast.error('Impossibile cercare gli eventi');
        return;
      }
      const data = (body.data as any[]).map((item) => ({
        id: item.id as string,
        title: item.title as string,
        slug: item.slug as string,
        startAt: item.startAt as string,
        endAt: item.endAt as string | null,
        priceCents: item.priceCents as number,
        emailOnly: item.emailOnly as boolean,
        active: item.active as boolean,
      }));
      const filtered = data.filter((item) => !assignedIds.has(item.id));
      setSearchResults(filtered);
      setSelectedEventId(filtered.length ? filtered[0].id : null);
    } catch (error) {
      console.error('[admin][sections][eventi] search error', error);
      toast.error('Errore durante la ricerca');
    } finally {
      setSearchLoading(false);
    }
  }, [assignedIds, searchTerm, toast]);

  const assignEvent = async () => {
    if (!selectedEventId) {
      toast.error('Seleziona un evento da assegnare');
      return;
    }
    if (assignedIds.has(selectedEventId)) {
      toast.error('Evento già presente nella sezione');
      return;
    }

    const defaultOrder = assignments.length ? Math.max(...assignments.map((a) => a.order)) + 10 : 0;

    setAssigning(true);
    try {
      const res = await fetch(`/api/admin/sections/${sectionKey}/events`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ eventId: selectedEventId, order: defaultOrder }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok || !body?.ok) {
        toast.error('Impossibile assegnare l\'evento');
        return;
      }
      const payload = body.data as {
        order: number;
        featured: boolean;
        showInHome: boolean;
        event: {
          id: string;
          title: string;
          slug: string;
          startAt: string;
          endAt: string | null;
          priceCents: number;
          emailOnly: boolean;
          active: boolean;
        };
      };

      const nextAssignment: AssignmentRow = {
        eventId: payload.event.id,
        order: payload.order,
        featured: payload.featured,
        showInHome: payload.showInHome,
        title: payload.event.title,
        slug: payload.event.slug,
        startAt: payload.event.startAt,
        endAt: payload.event.endAt,
        priceCents: payload.event.priceCents,
        emailOnly: payload.event.emailOnly,
        active: payload.event.active,
      };

      setAssignments((prev) => [...prev, nextAssignment].sort((a, b) => (a.order !== b.order ? a.order - b.order : a.title.localeCompare(b.title, 'it'))));
      setDrafts((prev) => ({
        ...prev,
        [nextAssignment.eventId]: {
          order: String(nextAssignment.order),
          featured: nextAssignment.featured,
          showInHome: nextAssignment.showInHome,
        },
      }));
      toast.success('Evento assegnato');
      setSearchResults((prev) => prev.filter((item) => item.id !== nextAssignment.eventId));
      setSelectedEventId(null);
    } catch (error) {
      console.error('[admin][sections][eventi] assign error', error);
      toast.error('Errore durante l\'assegnazione');
    } finally {
      setAssigning(false);
    }
  };

  const saveAssignment = async (eventId: string) => {
    const draft = drafts[eventId];
    const assignment = assignments.find((item) => item.eventId === eventId);
    if (!draft || !assignment) return;

    const orderValue = Number.parseInt(draft.order, 10);
    if (!Number.isFinite(orderValue) || orderValue < 0) {
      toast.error('Ordine non valido');
      return;
    }

    setSavingMap((prev) => ({ ...prev, [eventId]: true }));
    try {
      const payload = {
        eventId,
        order: orderValue,
        featured: draft.featured,
        showInHome: draft.showInHome,
      };
      const res = await fetch(`/api/admin/sections/${sectionKey}/events`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok || !body?.ok) {
        toast.error('Impossibile aggiornare l\'assegnazione');
        return;
      }

      setAssignments((prev) =>
        prev
          .map((item) =>
            item.eventId === eventId
              ? { ...item, order: payload.order, featured: payload.featured, showInHome: payload.showInHome }
              : item,
          )
          .sort((a, b) => (a.order !== b.order ? a.order - b.order : a.title.localeCompare(b.title, 'it'))),
      );
      toast.success('Assegnazione aggiornata');
    } catch (error) {
      console.error('[admin][sections][eventi] save error', error);
      toast.error('Errore durante il salvataggio');
    } finally {
      setSavingMap((prev) => ({ ...prev, [eventId]: false }));
    }
  };

  const removeAssignment = async (eventId: string) => {
    if (!window.confirm('Rimuovere questo evento dalla sezione?')) return;
    setRemovingId(eventId);
    try {
      const res = await fetch(`/api/admin/sections/${sectionKey}/events/${eventId}`, {
        method: 'DELETE',
      });
      const body = await res.json().catch(() => null);
      if (!res.ok || !body?.ok) {
        toast.error('Impossibile rimuovere l\'evento');
        return;
      }
      setAssignments((prev) => prev.filter((item) => item.eventId !== eventId));
      setDrafts((prev) => {
        const next = { ...prev };
        delete next[eventId];
        return next;
      });
      toast.success('Evento rimosso');
    } catch (error) {
      console.error('[admin][sections][eventi] remove error', error);
      toast.error('Errore durante la rimozione');
    } finally {
      setRemovingId(null);
    }
  };

  return (
    <div style={containerStyle}>
      <h1 style={{ margin: 0, fontSize: '1.75rem', fontWeight: 600 }}>Sezione “{sectionTitle}”</h1>

      <section style={cardStyle}>
        <h2 style={cardTitleStyle}>Eventi assegnati</h2>
        {assignments.length === 0 ? (
          <p style={helperTextStyle}>Nessun evento assegnato alla sezione.</p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={tableStyle}>
              <thead>
                <tr>
                  <th style={thStyle}>Evento</th>
                  <th style={thStyle}>Data</th>
                  <th style={thStyle}>Prezzo</th>
                  <th style={thStyle}>Modalità</th>
                  <th style={thStyle}>Ordine</th>
                  <th style={thStyle}>In evidenza</th>
                  <th style={thStyle}>In home</th>
                  <th style={thStyle}>Azioni</th>
                </tr>
              </thead>
              <tbody>
                {assignments.map((assignment) => {
                  const draft = drafts[assignment.eventId] ?? {
                    order: String(assignment.order),
                    featured: assignment.featured,
                    showInHome: assignment.showInHome,
                  };
                  const loading = savingMap[assignment.eventId] ?? false;
                  const dirty = hasChanges(assignment.eventId);

                  return (
                    <tr key={assignment.eventId}>
                      <td style={tdStyle}>
                        <div style={{ display: 'grid', gap: '0.25rem' }}>
                          <strong>{assignment.title}</strong>
                          <span style={{ fontSize: '0.85rem', color: '#6b7280' }}>{assignment.slug}</span>
                          {!assignment.active ? (
                            <span style={{ fontSize: '0.75rem', color: '#f87171' }}>Evento non attivo</span>
                          ) : null}
                        </div>
                      </td>
                      <td style={tdStyle}>{formatDateRange(assignment.startAt, assignment.endAt)}</td>
                      <td style={tdStyle}>{formatPrice(assignment.priceCents)}</td>
                      <td style={tdStyle}>{assignment.emailOnly ? 'Email' : 'Checkout'}</td>
                      <td style={tdStyle}>
                        <input
                          type="number"
                          min={0}
                          value={draft.order}
                          onChange={(event) => updateDraft(assignment.eventId, { order: event.target.value })}
                          style={smallInputStyle}
                        />
                      </td>
                      <td style={tdStyle}>
                        <label style={checkboxLabel}>
                          <input
                            type="checkbox"
                            checked={draft.featured}
                            onChange={(event) => updateDraft(assignment.eventId, { featured: event.target.checked })}
                          />
                          <span>Sì</span>
                        </label>
                      </td>
                      <td style={tdStyle}>
                        <label style={checkboxLabel}>
                          <input
                            type="checkbox"
                            checked={draft.showInHome}
                            onChange={(event) => updateDraft(assignment.eventId, { showInHome: event.target.checked })}
                          />
                          <span>In home</span>
                        </label>
                      </td>
                      <td style={tdStyle}>
                        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                          <button
                            type="button"
                            onClick={() => saveAssignment(assignment.eventId)}
                            disabled={loading || !dirty}
                            style={linkButtonStyle}
                          >
                            {loading ? 'Salvataggio…' : 'Salva'}
                          </button>
                          <button
                            type="button"
                            onClick={() => removeAssignment(assignment.eventId)}
                            disabled={removingId === assignment.eventId}
                            style={dangerButtonStyle}
                          >
                            {removingId === assignment.eventId ? 'Rimozione…' : 'Rimuovi'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section style={cardStyle}>
        <div style={{ display: 'grid', gap: '0.5rem' }}>
          <h2 style={cardTitleStyle}>Aggiungi evento</h2>
          <p style={helperTextStyle}>Cerca un evento e assegnalo alla sezione.</p>
        </div>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void searchEvents();
          }}
          style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}
        >
          <input
            type="text"
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            placeholder="Titolo o slug evento"
            style={inputStyle}
          />
          <button type="submit" style={secondaryButtonStyle} disabled={searchLoading}>
            {searchLoading ? 'Ricerca…' : 'Cerca'}
          </button>
        </form>
        {searchResults.length > 0 ? (
          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
            <select
              value={selectedEventId ?? ''}
              onChange={(event) => setSelectedEventId(event.target.value || null)}
              style={{ ...inputStyle, minWidth: 260 }}
            >
              <option value="">Seleziona un evento</option>
              {searchResults.map((result) => (
                <option key={result.id} value={result.id}>
                  {result.title} — {formatPrice(result.priceCents)}
                </option>
              ))}
            </select>
            <button type="button" onClick={() => void assignEvent()} disabled={assigning || !selectedEventId} style={primaryButtonStyle}>
              {assigning ? 'Assegnazione…' : 'Assegna'}
            </button>
          </div>
        ) : searchTerm.trim() && !searchLoading ? (
          <p style={helperTextStyle}>Nessun evento trovato.</p>
        ) : null}
      </section>
    </div>
  );
}

const containerStyle: CSSProperties = {
  display: 'grid',
  gap: '2rem',
  padding: '2rem 3rem',
  maxWidth: 1100,
  margin: '0 auto',
};

const cardStyle: CSSProperties = {
  backgroundColor: '#ffffff',
  borderRadius: 16,
  padding: '1.75rem',
  boxShadow: '0 12px 30px rgba(15,23,42,0.12)',
  display: 'grid',
  gap: '1.5rem',
};

const cardTitleStyle: CSSProperties = {
  margin: 0,
  fontSize: '1.25rem',
  fontWeight: 600,
  color: '#111827',
};

const helperTextStyle: CSSProperties = {
  margin: 0,
  color: '#6b7280',
  fontSize: '0.95rem',
};

const tableStyle: CSSProperties = {
  width: '100%',
  borderCollapse: 'collapse',
};

const thStyle: CSSProperties = {
  textAlign: 'left',
  padding: '0.75rem',
  backgroundColor: '#f9fafb',
  borderBottom: '1px solid #e5e7eb',
  fontSize: '0.85rem',
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
  color: '#6b7280',
};

const tdStyle: CSSProperties = {
  padding: '0.75rem',
  borderBottom: '1px solid #e5e7eb',
  verticalAlign: 'top',
  fontSize: '0.95rem',
};

const checkboxLabel: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '0.5rem',
  fontSize: '0.9rem',
};

const linkButtonStyle: CSSProperties = {
  border: 'none',
  background: 'none',
  color: '#2563eb',
  padding: 0,
  cursor: 'pointer',
  fontWeight: 600,
};

const dangerButtonStyle: CSSProperties = {
  ...linkButtonStyle,
  color: '#b91c1c',
};

const primaryButtonStyle: CSSProperties = {
  padding: '0.65rem 1.1rem',
  borderRadius: 10,
  border: 'none',
  backgroundColor: '#2563eb',
  color: '#fff',
  fontWeight: 600,
  cursor: 'pointer',
};

const secondaryButtonStyle: CSSProperties = {
  padding: '0.65rem 1.1rem',
  borderRadius: 10,
  border: '1px solid #d1d5db',
  backgroundColor: '#fff',
  color: '#1f2937',
  fontWeight: 500,
  cursor: 'pointer',
};

const smallInputStyle: CSSProperties = {
  width: 80,
  borderRadius: 10,
  border: '1px solid #d1d5db',
  padding: '0.4rem 0.6rem',
  fontSize: '0.9rem',
};

const inputStyle: CSSProperties = {
  borderRadius: 10,
  border: '1px solid #d1d5db',
  padding: '0.6rem 0.75rem',
  fontSize: '0.95rem',
  flex: '1 1 auto',
};
