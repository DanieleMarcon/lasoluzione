'use client';

import { useEffect, useMemo, useState } from 'react';
import type { ChangeEvent, CSSProperties, FormEvent } from 'react';

import { formatEuroFromCents } from '@/lib/format';
import type { AdminBooking, AdminSettingsDTO, BookingListResponse } from '@/types/admin';

const STATUSES = ['pending', 'pending_payment', 'confirmed', 'cancelled', 'failed', 'expired'];
const PAGE_SIZE = 20;

type Props = {
  settings: AdminSettingsDTO;
};

type Filters = {
  search: string;
  type: string;
  status: string;
  from: string;
  to: string;
};

type AlertState = {
  kind: 'success' | 'error';
  message: string;
};

type AdminBookingWithConsents = AdminBooking & {
  agreePrivacy: boolean;
  agreeMarketing: boolean;
  display: {
    typeLabel: string;
    itemsSummary: string;
    totalCents: number;
  };
};

type BookingListResponseWithConsents = BookingListResponse & {
  data: AdminBookingWithConsents[];
};

const defaultFilters: Filters = {
  search: '',
  type: '',
  status: '',
  from: '',
  to: '',
};

export default function BookingsView({ settings }: Props) {
  const [draftFilters, setDraftFilters] = useState<Filters>({ ...defaultFilters });
  const [filters, setFilters] = useState<Filters>({ ...defaultFilters });
  const [page, setPage] = useState(1);
  const [reloadToken, setReloadToken] = useState(0);
  const [bookings, setBookings] = useState<AdminBookingWithConsents[]>([]);
  const [meta, setMeta] = useState<BookingListResponse['meta']>({
    page: 1,
    pageSize: PAGE_SIZE,
    total: 0,
    totalPages: 1,
    hasNextPage: false,
    hasPreviousPage: false,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [alert, setAlert] = useState<AlertState | null>(null);
  const [editing, setEditing] = useState<AdminBookingWithConsents | null>(null);
  const [editForm, setEditForm] = useState({
    name: '',
    people: 1,
    phone: '',
    notes: '',
    type: '',
    date: '',
    time: '',
  });
  const [actionBookingId, setActionBookingId] = useState<number | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);

  useEffect(() => {
    if (!editing) return;
    const bookingDate = new Date(editing.date);
    setEditForm({
      name: editing.name,
      people: editing.people,
      phone: editing.phone,
      notes: editing.notes ?? '',
      type: editing.type,
      date: bookingDate.toISOString().slice(0, 10),
      time: bookingDate.toISOString().slice(11, 16),
    });
  }, [editing]);

  useEffect(() => {
    const abort = new AbortController();
    async function fetchData() {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('pageSize', String(PAGE_SIZE));
      if (filters.search) params.set('q', filters.search);
      if (filters.type) params.set('type', filters.type);
      if (filters.status) params.set('status', filters.status);
      if (filters.from) params.set('from', filters.from);
      if (filters.to) params.set('to', filters.to);

      try {
        const res = await fetch(`/api/admin/bookings?${params.toString()}`, {
          method: 'GET',
          credentials: 'include',
          signal: abort.signal,
          cache: 'no-store',
        });

        if (!res.ok) {
          const payload = await res.json().catch(() => ({ error: 'Errore sconosciuto' }));
          throw new Error(payload.error || 'Errore durante il caricamento');
        }

        const payload = (await res.json()) as BookingListResponseWithConsents;
        if (page > payload.meta.totalPages && payload.meta.totalPages >= 1) {
          setPage(payload.meta.totalPages);
          return;
        }
        setBookings(payload.data);
        setMeta(payload.meta);
      } catch (err: any) {
        if (err?.name === 'AbortError') return;
        console.error('[BookingsView] fetch error', err);
        setError(err?.message ?? 'Impossibile caricare le prenotazioni');
      } finally {
        setLoading(false);
      }
    }

    fetchData();
    return () => abort.abort();
  }, [filters, page, reloadToken]);

  const typeOptions = useMemo(() => {
    return settings.enabledTypes.map((type) => ({
      value: type,
      label: settings.typeLabels[type] ?? type,
    }));
  }, [settings]);

  function onFilterChange(event: ChangeEvent<HTMLInputElement | HTMLSelectElement>) {
    const { name, value } = event.target;
    setDraftFilters((prev) => ({ ...prev, [name]: value }));
  }

  function applyFilters(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFilters({ ...draftFilters });
    setPage(1);
  }

  function resetFilters() {
    setDraftFilters({ ...defaultFilters });
    setFilters({ ...defaultFilters });
    setPage(1);
  }

  function handlePrint() {
    const params = new URLSearchParams();
    params.set('page', String(page));
    params.set('pageSize', String(PAGE_SIZE));
    if (filters.search) params.set('q', filters.search);
    if (filters.type) params.set('type', filters.type);
    if (filters.status) params.set('status', filters.status);
    if (filters.from) params.set('from', filters.from);
    if (filters.to) params.set('to', filters.to);
    window.open(`/admin/bookings/print?${params.toString()}`, '_blank');
  }

  function handleExportCsv() {
    const params = new URLSearchParams();
    if (filters.search) params.set('q', filters.search);
    if (filters.type) params.set('type', filters.type);
    if (filters.status) params.set('status', filters.status);
    if (filters.from) params.set('from', filters.from);
    if (filters.to) params.set('to', filters.to);
    const queryString = params.toString();
    const url = queryString ? `/api/admin/bookings/export?${queryString}` : '/api/admin/bookings/export';
    window.open(url, '_blank');
  }

  async function triggerAction(
    bookingId: number,
    endpoint: string,
    method: 'POST' | 'PATCH' | 'DELETE',
    successMessage: string,
    body?: Record<string, unknown>
  ) {
    setActionBookingId(bookingId);
    setAlert(null);
    try {
      const res = await fetch(endpoint, {
        method,
        credentials: 'include',
        headers: body ? { 'Content-Type': 'application/json' } : undefined,
        body: body ? JSON.stringify(body) : undefined,
      });

      if (!res.ok) {
        const payload = await res.json().catch(() => ({ error: 'Errore sconosciuto' }));
        throw new Error(payload.error || 'Operazione non riuscita');
      }

      setAlert({ kind: 'success', message: successMessage });
      setReloadToken((token) => token + 1);
    } catch (error: any) {
      console.error('[BookingsView] action error', error);
      setAlert({ kind: 'error', message: error?.message ?? 'Operazione non riuscita' });
    } finally {
      setActionBookingId(null);
    }
  }

  async function submitEdit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editing) return;
    setSavingEdit(true);
    setAlert(null);

    const payload: Record<string, unknown> = {
      name: editForm.name,
      people: editForm.people,
      phone: editForm.phone,
      notes: editForm.notes.trim() ? editForm.notes.trim() : null,
      type: editForm.type,
    };

    if (settings.enableDateTimeStep) {
      payload.date = editForm.date;
      payload.time = editForm.time;
    }

    try {
      const res = await fetch(`/api/admin/bookings/${editing.id}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: 'Errore' }));
        throw new Error(body.error || 'Impossibile aggiornare la prenotazione');
      }

      setAlert({ kind: 'success', message: 'Prenotazione aggiornata correttamente' });
      setEditing(null);
      setReloadToken((token) => token + 1);
    } catch (error: any) {
      console.error('[BookingsView] edit error', error);
      setAlert({ kind: 'error', message: error?.message ?? 'Impossibile aggiornare' });
    } finally {
      setSavingEdit(false);
    }
  }

  function formatDateTime(value: string) {
    return new Date(value).toLocaleString('it-IT', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  return (
    <div style={{ display: 'grid', gap: '1.5rem' }}>
      <form
        onSubmit={applyFilters}
        style={{
          display: 'grid',
          gap: '1rem',
          padding: '1.5rem',
          backgroundColor: '#fff',
          borderRadius: 16,
          boxShadow: '0 10px 30px rgba(15, 23, 42, 0.06)',
        }}
      >
        <h2 style={{ margin: 0, fontSize: '1.25rem' }}>Filtri</h2>
        <div style={{ display: 'grid', gap: '1rem', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
          <label style={labelStyle}>
            <span>Ricerca</span>
            <input
              name="search"
              type="search"
              value={draftFilters.search}
              onChange={onFilterChange}
              placeholder="Nome, email o telefono"
              style={inputStyle}
            />
          </label>
          <label style={labelStyle}>
            <span>Tipologia</span>
            <select name="type" value={draftFilters.type} onChange={onFilterChange} style={inputStyle}>
              <option value="">Tutte</option>
              {typeOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label style={labelStyle}>
            <span>Stato</span>
            <select name="status" value={draftFilters.status} onChange={onFilterChange} style={inputStyle}>
              <option value="">Tutti</option>
              {STATUSES.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
          </label>
          <label style={labelStyle}>
            <span>Dal</span>
            <input name="from" type="date" value={draftFilters.from} onChange={onFilterChange} style={inputStyle} />
          </label>
          <label style={labelStyle}>
            <span>Al</span>
            <input name="to" type="date" value={draftFilters.to} onChange={onFilterChange} style={inputStyle} />
          </label>
        </div>
        <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
          <button type="button" onClick={handleExportCsv} style={secondaryButtonStyle}>
            Esporta CSV
          </button>
          <button type="button" onClick={handlePrint} style={secondaryButtonStyle}>
            Stampa elenco
          </button>
          <button type="button" onClick={resetFilters} style={secondaryButtonStyle}>
            Reset
          </button>
          <button type="submit" style={primaryButtonStyle}>
            Applica filtri
          </button>
        </div>
      </form>

      {alert && (
        <div
          role="alert"
          style={{
            padding: '1rem 1.25rem',
            borderRadius: 12,
            backgroundColor: alert.kind === 'success' ? '#ecfdf5' : '#fef2f2',
            color: alert.kind === 'success' ? '#047857' : '#b91c1c',
            fontWeight: 500,
          }}
        >
          {alert.message}
        </div>
      )}

      <div
        style={{
          backgroundColor: '#fff',
          borderRadius: 16,
          boxShadow: '0 10px 30px rgba(15, 23, 42, 0.06)',
          overflowX: 'auto',
        }}
      >
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 960 }}>
          <thead>
            <tr style={{ textAlign: 'left', backgroundColor: '#f9fafb', fontSize: '0.85rem', color: '#6b7280' }}>
              <th style={thStyle}>Data</th>
              <th style={thStyle}>Tipo</th>
              <th style={thStyle}>Nome</th>
              <th style={thStyle}>Persone</th>
              <th style={thStyle}>Dettaglio</th>
              <th style={thStyle}>Email</th>
              <th style={thStyle}>Telefono</th>
              <th style={consentThStyle}>Privacy</th>
              <th style={consentThStyle}>News</th>
              <th style={thStyle}>Totale (€)</th>
              <th style={thStyle}>Stato</th>
              <th style={thStyle}>Creato</th>
              <th style={thStyle}>Azioni</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={13} style={{ padding: '1.5rem', textAlign: 'center', color: '#6b7280' }}>
                  Caricamento…
                </td>
              </tr>
            ) : error ? (
              <tr>
                <td colSpan={13} style={{ padding: '1.5rem', textAlign: 'center', color: '#b91c1c' }}>
                  {error}
                </td>
              </tr>
            ) : bookings.length === 0 ? (
              <tr>
                <td colSpan={13} style={{ padding: '1.5rem', textAlign: 'center', color: '#6b7280' }}>
                  Nessuna prenotazione trovata.
                </td>
              </tr>
            ) : (
              bookings.map((booking) => {
                const actionsDisabled = actionBookingId === booking.id;
                const hasPrivacyConsent = booking.agreePrivacy === true;
                const hasMarketingConsent = booking.agreeMarketing === true;
                const summaryText = booking.display.itemsSummary;
                const summaryPreview =
                  summaryText.length > 60 ? `${summaryText.slice(0, 60)}…` : summaryText;
                return (
                  <tr key={booking.id} style={{ borderTop: '1px solid #f1f5f9' }}>
                    <td style={tdStyle}>{formatDateTime(booking.date)}</td>
                    <td style={tdStyle}>{booking.display.typeLabel}</td>
                    <td style={tdStyle}>{booking.name}</td>
                    <td style={tdStyle}>{booking.people}</td>
                    <td style={tdStyle}>
                      <span title={summaryText}>{summaryPreview}</span>
                    </td>
                    <td style={tdStyle}>{booking.email}</td>
                    <td style={tdStyle}>{booking.phone}</td>
                    <td
                      style={consentTdStyle}
                      aria-label={hasPrivacyConsent ? 'Consenso privacy confermato' : 'Consenso privacy assente'}
                      title={hasPrivacyConsent ? 'Consenso privacy confermato' : 'Consenso privacy assente'}
                    >
                      {hasPrivacyConsent ? '✅' : '—'}
                    </td>
                    <td
                      style={consentTdStyle}
                      aria-label={hasMarketingConsent ? 'Iscrizione newsletter confermata' : 'Iscrizione newsletter assente'}
                      title={hasMarketingConsent ? 'Iscrizione newsletter confermata' : 'Iscrizione newsletter assente'}
                    >
                      {hasMarketingConsent ? '✅' : '—'}
                    </td>
                    <td style={tdStyle}>{formatEuroFromCents(booking.display.totalCents)}</td>
                    <td style={tdStyle}>{booking.status}</td>
                    <td style={tdStyle}>{new Date(booking.createdAt).toLocaleDateString('it-IT')}</td>
                    <td style={{ ...tdStyle, display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                      <button
                        type="button"
                        onClick={() => setEditing(booking)}
                        style={linkButtonStyle}
                        disabled={actionsDisabled}
                      >
                        Modifica
                      </button>
                      <button
                        type="button"
                        onClick={() => triggerAction(booking.id, `/api/admin/bookings/${booking.id}/confirm`, 'POST', 'Prenotazione confermata')}
                        style={linkButtonStyle}
                        disabled={actionsDisabled}
                      >
                        Conferma
                      </button>
                      <button
                        type="button"
                        onClick={() => triggerAction(booking.id, `/api/admin/bookings/${booking.id}/cancel`, 'POST', 'Prenotazione annullata')}
                        style={linkButtonStyle}
                        disabled={actionsDisabled}
                      >
                        Annulla
                      </button>
                      <button
                        type="button"
                        onClick={() => triggerAction(booking.id, `/api/admin/bookings/${booking.id}/resend`, 'POST', 'Email reinviate')}
                        style={linkButtonStyle}
                        disabled={actionsDisabled}
                      >
                        Reinvia email
                      </button>
                      <button
                        type="button"
                        onClick={() => triggerAction(booking.id, `/api/admin/bookings/${booking.id}`, 'DELETE', 'Prenotazione eliminata')}
                        style={{ ...linkButtonStyle, color: '#b91c1c' }}
                        disabled={actionsDisabled}
                      >
                        Elimina
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <p style={{ margin: 0, color: '#6b7280', fontSize: '0.95rem' }}>
          Totale risultati: {meta.total}
        </p>
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          <button
            type="button"
            onClick={() => setPage((value) => Math.max(1, value - 1))}
            style={secondaryButtonStyle}
            disabled={!meta.hasPreviousPage}
          >
            ← Prec.
          </button>
          <span style={{ fontWeight: 600 }}>
            Pagina {meta.page} di {meta.totalPages}
          </span>
          <button
            type="button"
            onClick={() => setPage((value) => value + 1)}
            style={secondaryButtonStyle}
            disabled={!meta.hasNextPage}
          >
            Succ. →
          </button>
        </div>
      </div>

      {editing && (
        <div style={modalOverlayStyle} role="dialog" aria-modal="true">
          <div style={modalStyle}>
            <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3 style={{ margin: 0 }}>Modifica prenotazione #{editing.id}</h3>
                <p style={{ margin: 0, color: '#6b7280', fontSize: '0.9rem' }}>
                  Ultimo aggiornamento {formatDateTime(editing.updatedAt)}
                </p>
              </div>
              <button type="button" onClick={() => setEditing(null)} style={secondaryButtonStyle}>
                Chiudi
              </button>
            </header>
            <form onSubmit={submitEdit} style={{ marginTop: '1.25rem', display: 'grid', gap: '1rem' }}>
              <div style={{ display: 'grid', gap: '1rem', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
                <label style={labelStyle}>
                  <span>Nome</span>
                  <input
                    type="text"
                    value={editForm.name}
                    onChange={(event) => setEditForm((prev) => ({ ...prev, name: event.target.value }))}
                    required
                    style={inputStyle}
                  />
                </label>
                <label style={labelStyle}>
                  <span>Persone</span>
                  <input
                    type="number"
                    min={1}
                    value={editForm.people}
                    onChange={(event) =>
                      setEditForm((prev) => ({ ...prev, people: Number.parseInt(event.target.value, 10) || 1 }))
                    }
                    required
                    style={inputStyle}
                  />
                </label>
                <label style={labelStyle}>
                  <span>Telefono</span>
                  <input
                    type="tel"
                    value={editForm.phone}
                    onChange={(event) => setEditForm((prev) => ({ ...prev, phone: event.target.value }))}
                    required
                    style={inputStyle}
                  />
                </label>
                <label style={labelStyle}>
                  <span>Tipologia</span>
                  <select
                    value={editForm.type}
                    onChange={(event) => setEditForm((prev) => ({ ...prev, type: event.target.value }))}
                    required
                    style={inputStyle}
                  >
                    {typeOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              {settings.enableDateTimeStep ? (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem' }}>
                  <label style={labelStyle}>
                    <span>Data</span>
                    <input
                      type="date"
                      value={editForm.date}
                      onChange={(event) => setEditForm((prev) => ({ ...prev, date: event.target.value }))}
                      required
                      style={inputStyle}
                    />
                  </label>
                  <label style={labelStyle}>
                    <span>Ora</span>
                    <input
                      type="time"
                      value={editForm.time}
                      onChange={(event) => setEditForm((prev) => ({ ...prev, time: event.target.value }))}
                      required
                      style={inputStyle}
                    />
                  </label>
                </div>
              ) : (
                <p style={{ margin: 0, color: '#6b7280', fontSize: '0.9rem' }}>
                  La modifica di data e ora è disabilitata dalle impostazioni.
                </p>
              )}

              <label style={labelStyle}>
                <span>Note</span>
                <textarea
                  value={editForm.notes}
                  onChange={(event) => setEditForm((prev) => ({ ...prev, notes: event.target.value }))}
                  rows={3}
                  style={{ ...inputStyle, resize: 'vertical' }}
                />
              </label>

              <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
                <button type="button" onClick={() => setEditing(null)} style={secondaryButtonStyle}>
                  Annulla
                </button>
                <button type="submit" style={primaryButtonStyle} disabled={savingEdit}>
                  {savingEdit ? 'Salvataggio…' : 'Salva modifiche'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

const labelStyle: CSSProperties = {
  display: 'grid',
  gap: '0.4rem',
  fontSize: '0.9rem',
  color: '#374151',
};

const inputStyle: CSSProperties = {
  padding: '0.65rem 0.85rem',
  borderRadius: 10,
  border: '1px solid #d1d5db',
  fontSize: '0.95rem',
};

const primaryButtonStyle: CSSProperties = {
  padding: '0.65rem 1.25rem',
  borderRadius: 10,
  border: 'none',
  backgroundColor: '#2563eb',
  color: '#fff',
  fontWeight: 600,
  cursor: 'pointer',
};

const secondaryButtonStyle: CSSProperties = {
  padding: '0.6rem 1.1rem',
  borderRadius: 10,
  border: '1px solid #d1d5db',
  backgroundColor: '#fff',
  color: '#111827',
  fontWeight: 500,
  cursor: 'pointer',
};

const linkButtonStyle: CSSProperties = {
  ...secondaryButtonStyle,
  padding: '0.4rem 0.8rem',
  fontSize: '0.85rem',
};

const thStyle: CSSProperties = {
  padding: '0.75rem 1rem',
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
};

const consentThStyle: CSSProperties = {
  ...thStyle,
  width: '3.25rem',
  textAlign: 'center',
};

const tdStyle: CSSProperties = {
  padding: '0.85rem 1rem',
  fontSize: '0.95rem',
};

const consentTdStyle: CSSProperties = {
  ...tdStyle,
  textAlign: 'center',
  whiteSpace: 'nowrap',
};

const modalOverlayStyle: CSSProperties = {
  position: 'fixed',
  inset: 0,
  backgroundColor: 'rgba(15, 23, 42, 0.45)',
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'center',
  padding: '2rem',
  zIndex: 50,
};

const modalStyle: CSSProperties = {
  backgroundColor: '#fff',
  borderRadius: 16,
  padding: '1.75rem',
  width: 'min(720px, 100%)',
  maxHeight: '90vh',
  overflowY: 'auto',
  display: 'grid',
  gap: '1rem',
  boxShadow: '0 20px 45px rgba(15, 23, 42, 0.15)',
};
