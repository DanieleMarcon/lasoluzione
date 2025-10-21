'use client';

import { useEffect, useMemo, useState } from 'react';
import type { ChangeEvent, FormEvent } from 'react';

import { ToastProvider, useToast } from '@/components/admin/ui/toast';
import EditContactModal from './EditContactModal';
import MergeContactsDialog from './MergeContactsDialog';
import type { ContactDTO } from '@/types/admin/contacts';

const PAGE_SIZE = 20;

type ContactRow = {
  id: string | number;
  name?: string | null;
  email?: string | null;
  phone?: string | null;
  lastContactAt?: string | null;
  last_contact_at?: string | null;
  createdAt?: string | null;
  created_at?: string | null;
  privacy?: boolean | null;
  newsletter?: boolean | null;
  bookingsCount?: number | null;
  totalBookings?: number | null;
  total_bookings?: number | null;
};

type ContactsApiAny =
  | { items: any[]; total: number; page: number; pageSize: number; error?: 'temporary_failure' }
  | { data: any[]; total: number; page: number; pageSize: number; error?: 'temporary_failure' };

type LoadContactsResult = {
  items: ContactRow[];
  total: number;
  page: number;
  pageSize: number;
  error: boolean;
  temporaryFailure: boolean;
};

export async function loadContacts(
  params: URLSearchParams,
  options: { signal?: AbortSignal } = {},
): Promise<LoadContactsResult> {
  try {
    const res = await fetch(`/api/admin/contacts?${params.toString()}`, {
      cache: 'no-store',
      credentials: 'include',
      signal: options.signal,
    });

    if (!res.ok) {
      return { items: [], total: 0, page: 1, pageSize: PAGE_SIZE, error: true as const, temporaryFailure: true };
    }

    const payload: ContactsApiAny = await res.json();
    const raw = ('items' in payload ? payload.items : payload.data) ?? [];
    const total = payload.total ?? (Array.isArray(raw) ? raw.length : 0);
    const requestedPage = Number.parseInt(params.get('page') ?? '1', 10);
    const requestedPageSize = Number.parseInt(params.get('pageSize') ?? String(PAGE_SIZE), 10);
    const page = payload.page ?? (Number.isNaN(requestedPage) ? 1 : requestedPage);
    const pageSize = payload.pageSize ?? (Number.isNaN(requestedPageSize) ? PAGE_SIZE : requestedPageSize);

    const items: ContactRow[] = Array.isArray(raw)
      ? raw.map((r: any) => {
          const row: ContactRow = {
            id: r.id ?? r.contact_id ?? r.user_id,
            name: r.name ?? r.full_name ?? null,
            email: r.email ?? null,
            phone: r.phone ?? r.phone_number ?? null,
            lastContactAt: r.lastContactAt ?? r.last_contact_at ?? null,
            last_contact_at: r.last_contact_at ?? null,
            createdAt: r.createdAt ?? r.created_at ?? null,
            created_at: r.created_at ?? null,
            privacy: typeof r.privacy === 'boolean' ? r.privacy : typeof r.agreePrivacy === 'boolean' ? r.agreePrivacy : null,
            newsletter:
              typeof r.newsletter === 'boolean'
                ? r.newsletter
                : typeof r.agreeNewsletter === 'boolean'
                  ? r.agreeNewsletter
                  : null,
            bookingsCount:
              typeof r.bookingsCount === 'number'
                ? r.bookingsCount
                : typeof r.bookingsCount === 'bigint'
                  ? Number(r.bookingsCount)
                  : typeof r.bookings_count === 'bigint'
                    ? Number(r.bookings_count)
                    : typeof r.bookings_count === 'number'
                      ? r.bookings_count
                      : null,
            totalBookings:
              typeof r.totalBookings === 'number'
                ? r.totalBookings
                : typeof r.totalBookings === 'bigint'
                  ? Number(r.totalBookings)
                  : typeof r.total_bookings === 'bigint'
                    ? Number(r.total_bookings)
                    : typeof r.total_bookings === 'number'
                      ? r.total_bookings
                      : null,
            total_bookings:
              typeof r.total_bookings === 'bigint'
                ? Number(r.total_bookings)
                : typeof r.total_bookings === 'number'
                  ? r.total_bookings
                  : null,
          };

          row.bookingsCount = row.bookingsCount ?? row.totalBookings ?? 0;
          row.lastContactAt = row.lastContactAt ?? row.last_contact_at ?? null;
          row.createdAt = row.createdAt ?? row.lastContactAt ?? null;
          row.totalBookings = row.totalBookings ?? row.bookingsCount ?? 0;

          return row;
        })
      : [];

    return {
      items,
      total,
      page,
      pageSize,
      error: false as const,
      temporaryFailure: payload.error === 'temporary_failure',
    };
  } catch {
    return { items: [], total: 0, page: 1, pageSize: PAGE_SIZE, error: true as const, temporaryFailure: true };
  }
}

type Filters = {
  search: string;
  newsletter: 'all' | 'yes' | 'no';
  privacy: 'all' | 'yes' | 'no';
  from: string;
  to: string;
};

const defaultFilters: Filters = {
  search: '',
  newsletter: 'all',
  privacy: 'all',
  from: '',
  to: '',
};

function formatDateSafe(iso?: string | null) {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isNaN(d.valueOf())
    ? '—'
    : d.toLocaleDateString('it-IT', { day: '2-digit', month: 'short', year: 'numeric' });
}

function BooleanBadge({ value }: { value: boolean }) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        minWidth: 56,
        padding: '0.2rem 0.6rem',
        borderRadius: 999,
        fontSize: '0.8rem',
        fontWeight: 600,
        backgroundColor: value ? 'rgba(22,163,74,0.12)' : 'rgba(156,163,175,0.15)',
        color: value ? '#15803d' : '#4b5563',
      }}
    >
      {value ? 'Sì' : 'No'}
    </span>
  );
}

function ContactsPageInner() {
  const toast = useToast();
  const [draftFilters, setDraftFilters] = useState<Filters>({ ...defaultFilters });
  const [filters, setFilters] = useState<Filters>({ ...defaultFilters });
  const [contacts, setContacts] = useState<ContactDTO[] | null>(null);
  const [pagination, setPagination] = useState<{ page: number; pageSize: number; total: number }>(
    {
      page: 1,
      pageSize: PAGE_SIZE,
      total: 0,
    },
  );
  const [page, setPage] = useState(1);
  const [refreshToken, setRefreshToken] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [temporaryFailure, setTemporaryFailure] = useState(false);
  const [editingContact, setEditingContact] = useState<ContactDTO | null>(null);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isMergeOpen, setIsMergeOpen] = useState(false);
  const [pendingHideEmail, setPendingHideEmail] = useState<string | null>(null);

  useEffect(() => {
    const abort = new AbortController();

    async function fetchContacts() {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('pageSize', String(PAGE_SIZE));
      if (filters.search.trim()) params.set('q', filters.search.trim());
      if (filters.newsletter !== 'all') params.set('newsletter', filters.newsletter);
      if (filters.privacy !== 'all') params.set('privacy', filters.privacy);
      if (filters.from) params.set('from', filters.from);
      if (filters.to) params.set('to', filters.to);

      try {
        const {
          items,
          total,
          page: payloadPage,
          pageSize: payloadPageSize,
          temporaryFailure: tmpFailure,
          error: loadError,
        } = await loadContacts(params, { signal: abort.signal });

        if (loadError) {
          setContacts([]);
          setTemporaryFailure(tmpFailure || loadError);
          setPagination({ page: 1, pageSize: PAGE_SIZE, total: 0 });
          setError('Dati temporaneamente non disponibili.');
          return;
        }

        const nextPageSize = payloadPageSize ?? PAGE_SIZE;
        const nextPage = payloadPage ?? page;
        const computedTotalPages = total > 0 ? Math.ceil(total / nextPageSize) : 0;

        if (computedTotalPages > 0 && page > computedTotalPages) {
          setPage(computedTotalPages);
          return;
        }

        if (computedTotalPages === 0 && page !== 1) {
          setPage(1);
          return;
        }

        const normalizedItems: ContactDTO[] = items.map((row) => ({
          name: row.name ?? null,
          email: row.email ?? '',
          phone: row.phone ?? null,
          createdAt: row.createdAt ?? null,
          lastContactAt: row.lastContactAt ?? null,
          privacy: typeof row.privacy === 'boolean' ? row.privacy : null,
          newsletter: typeof row.newsletter === 'boolean' ? row.newsletter : null,
          bookingsCount: typeof row.bookingsCount === 'number' ? row.bookingsCount : 0,
          totalBookings:
            typeof row.totalBookings === 'number'
              ? row.totalBookings
              : typeof row.bookingsCount === 'number'
                ? row.bookingsCount
                : 0,
        }));

        setContacts(normalizedItems);
        setTemporaryFailure(tmpFailure || false);
        setError(null);
        setPagination({
          page: nextPage,
          pageSize: nextPageSize,
          total,
        });
      } catch (err: any) {
        if (err?.name === 'AbortError') return;
        const message = err?.message ?? 'Impossibile caricare i contatti';
        setError(message);
        toast.error(message);
      } finally {
        setLoading(false);
      }
    }

    fetchContacts();
    return () => abort.abort();
  }, [filters, page, toast, refreshToken]);

  function refreshContacts() {
    setRefreshToken((prev) => prev + 1);
  }

  const totalLabel = useMemo(() => {
    if (pagination.total === 0) return 'Nessun contatto trovato';
    if (pagination.total === 1) return '1 contatto trovato';
    return `${pagination.total} contatti totali`;
  }, [pagination.total]);

  const totalPages = useMemo(() => {
    return pagination.total > 0 ? Math.ceil(pagination.total / pagination.pageSize) : 0;
  }, [pagination.total, pagination.pageSize]);

  const contactItems = Array.isArray(contacts) ? contacts : [];
  const contactsCount = contactItems.length;

  const rangeStart = pagination.total === 0 || contactsCount === 0 ? 0 : (pagination.page - 1) * pagination.pageSize + 1;
  const rangeEnd = pagination.total === 0 || contactsCount === 0 ? 0 : rangeStart + contactsCount - 1;

  const hasPreviousPage = pagination.total > 0 && pagination.page > 1;
  const hasNextPage = pagination.total > 0 && pagination.page < totalPages;
  const totalPagesLabel = totalPages > 0 ? totalPages : 1;

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
    if (filters.search.trim()) params.set('q', filters.search.trim());
    if (filters.newsletter !== 'all') params.set('newsletter', filters.newsletter);
    if (filters.privacy !== 'all') params.set('privacy', filters.privacy);
    if (filters.from) params.set('from', filters.from);
    if (filters.to) params.set('to', filters.to);
    window.open(`/admin/contacts/print?${params.toString()}`, '_blank');
  }

  function handleExportCsv() {
    const params = new URLSearchParams();
    if (filters.search.trim()) params.set('q', filters.search.trim());
    if (filters.newsletter !== 'all') params.set('newsletter', filters.newsletter);
    if (filters.privacy !== 'all') params.set('privacy', filters.privacy);
    if (filters.from) params.set('from', filters.from);
    if (filters.to) params.set('to', filters.to);
    const query = params.toString();
    const url = query ? `/api/admin/contacts/export?${query}` : '/api/admin/contacts/export';
    window.open(url, '_blank');
  }

  function handleOpenEdit(contact: ContactDTO) {
    setEditingContact(contact);
    setIsEditOpen(true);
  }

  function handleCloseEdit() {
    setIsEditOpen(false);
    setEditingContact(null);
  }

  async function handleHide(contact: ContactDTO) {
    if (!contact.email) return;
    const confirmed = window.confirm(`Nascondere ${contact.email}? Verrà escluso da lista ed export.`);
    if (!confirmed) return;

    try {
      setPendingHideEmail(contact.email);
      const res = await fetch(`/api/admin/contacts/${encodeURIComponent(contact.email)}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      if (!res.ok) {
        throw new Error('Impossibile nascondere il contatto.');
      }

      toast.success('Contatto nascosto.');
      refreshContacts();
    } catch (err: any) {
      const message = err?.message ?? 'Impossibile nascondere il contatto.';
      toast.error(message);
    } finally {
      setPendingHideEmail(null);
    }
  }

  return (
    <div style={{ display: 'grid', gap: '1.75rem' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem' }}>
        <div style={{ display: 'grid', gap: '0.3rem' }}>
          <h1 style={{ margin: 0, fontSize: '1.6rem', fontWeight: 700 }}>Contatti</h1>
          <p style={{ margin: 0, color: '#6b7280' }}>
            Elenco deduplicato delle prenotazioni. Include ultimo consenso privacy/newsletter e totale prenotazioni.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={() => setIsMergeOpen(true)}
            style={{
              padding: '0.65rem 1.4rem',
              borderRadius: 999,
              border: '1px solid #1d4ed8',
              backgroundColor: '#1d4ed8',
              color: '#f9fafb',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Unisci contatti
          </button>
          <button
            type="button"
            onClick={handlePrint}
            style={{
              padding: '0.65rem 1.4rem',
              borderRadius: 999,
              border: '1px solid #1f2937',
              backgroundColor: '#fff',
              color: '#111827',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Stampa
          </button>
          <button
            type="button"
            onClick={handleExportCsv}
            style={{
              padding: '0.65rem 1.4rem',
              borderRadius: 999,
              border: '1px solid #111827',
              backgroundColor: '#111827',
              color: '#f9fafb',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Esporta CSV
          </button>
        </div>
      </header>

      {temporaryFailure ? (
        <div
          role="status"
          style={{
            padding: '0.85rem 1rem',
            borderRadius: '0.75rem',
            backgroundColor: 'rgba(234,179,8,0.15)',
            color: '#92400e',
            border: '1px solid rgba(234,179,8,0.3)',
            fontSize: '0.9rem',
          }}
        >
          Dati temporaneamente non disponibili.
        </div>
      ) : null}

      <form
        onSubmit={applyFilters}
        style={{
          display: 'grid',
          gap: '1rem',
          background: '#f9fafb',
          padding: '1.25rem',
          borderRadius: 16,
          border: '1px solid #e5e7eb',
        }}
      >
        <div style={{ display: 'grid', gap: '1rem', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
          <label style={{ display: 'grid', gap: '0.35rem' }}>
            <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#374151' }}>Ricerca</span>
            <input
              name="search"
              value={draftFilters.search}
              onChange={onFilterChange}
              placeholder="Nome, email o telefono"
              style={{
                padding: '0.6rem 0.75rem',
                borderRadius: 10,
                border: '1px solid #d1d5db',
                fontSize: '0.95rem',
              }}
            />
          </label>

          <label style={{ display: 'grid', gap: '0.35rem' }}>
            <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#374151' }}>Newsletter</span>
            <select
              name="newsletter"
              value={draftFilters.newsletter}
              onChange={onFilterChange}
              style={{
                padding: '0.6rem 0.75rem',
                borderRadius: 10,
                border: '1px solid #d1d5db',
                fontSize: '0.95rem',
                background: '#fff',
              }}
            >
              <option value="all">Tutti</option>
              <option value="yes">Solo iscritti</option>
              <option value="no">Solo non iscritti</option>
            </select>
          </label>

          <label style={{ display: 'grid', gap: '0.35rem' }}>
            <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#374151' }}>Privacy</span>
            <select
              name="privacy"
              value={draftFilters.privacy}
              onChange={onFilterChange}
              style={{
                padding: '0.6rem 0.75rem',
                borderRadius: 10,
                border: '1px solid #d1d5db',
                fontSize: '0.95rem',
                background: '#fff',
              }}
            >
              <option value="all">Tutti</option>
              <option value="yes">Solo consensi</option>
              <option value="no">Solo senza consenso</option>
            </select>
          </label>

          <label style={{ display: 'grid', gap: '0.35rem' }}>
            <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#374151' }}>Data da</span>
            <input
              type="date"
              name="from"
              value={draftFilters.from}
              onChange={onFilterChange}
              style={{
                padding: '0.6rem 0.75rem',
                borderRadius: 10,
                border: '1px solid #d1d5db',
                fontSize: '0.95rem',
              }}
            />
          </label>

          <label style={{ display: 'grid', gap: '0.35rem' }}>
            <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#374151' }}>Data a</span>
            <input
              type="date"
              name="to"
              value={draftFilters.to}
              onChange={onFilterChange}
              style={{
                padding: '0.6rem 0.75rem',
                borderRadius: 10,
                border: '1px solid #d1d5db',
                fontSize: '0.95rem',
              }}
            />
          </label>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={resetFilters}
            style={{
              padding: '0.55rem 1.2rem',
              borderRadius: 999,
              border: '1px solid #d1d5db',
              backgroundColor: '#fff',
              color: '#374151',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Azzera filtri
          </button>
          <button
            type="submit"
            style={{
              padding: '0.55rem 1.6rem',
              borderRadius: 999,
              border: 'none',
              backgroundColor: '#111827',
              color: '#f9fafb',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Applica filtri
          </button>
        </div>
      </form>

      <section style={{ display: 'grid', gap: '0.75rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: '#4b5563' }}>
          <p style={{ margin: 0, fontWeight: 600 }}>{totalLabel}</p>
          <p style={{ margin: 0, fontSize: '0.9rem' }}>
            Pagina {pagination.page} di {totalPagesLabel}
          </p>
        </div>

        <div style={{ borderRadius: 16, border: '1px solid #e5e7eb', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#f3f4f6', color: '#374151', textTransform: 'uppercase', fontSize: '0.75rem', letterSpacing: '0.05em' }}>
                <th style={{ padding: '0.65rem 0.75rem', textAlign: 'left' }}>Nome</th>
                <th style={{ padding: '0.65rem 0.75rem', textAlign: 'left' }}>Email</th>
                <th style={{ padding: '0.65rem 0.75rem', textAlign: 'left' }}>Telefono</th>
                <th style={{ padding: '0.65rem 0.75rem', textAlign: 'left' }}>Ultimo contatto</th>
                <th style={{ padding: '0.65rem 0.75rem', textAlign: 'center' }}>Privacy</th>
                <th style={{ padding: '0.65rem 0.75rem', textAlign: 'center' }}>Newsletter</th>
                <th style={{ padding: '0.65rem 0.75rem', textAlign: 'right' }}>Prenotazioni</th>
                <th style={{ padding: '0.65rem 0.75rem', textAlign: 'left' }}>Azioni</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={8} style={{ padding: '1.5rem', textAlign: 'center', color: '#6b7280' }}>
                    Caricamento in corso…
                  </td>
                </tr>
              ) : contactsCount === 0 ? (
                <tr>
                  <td colSpan={8} style={{ padding: '1.5rem', textAlign: 'center', color: '#6b7280' }}>
                    {temporaryFailure
                      ? 'Dati temporaneamente non disponibili.'
                      : 'Nessun contatto trovato con i filtri selezionati.'}
                  </td>
                </tr>
              ) : (
                contactItems.map((contact, index) => (
                  <tr
                    key={`${contact.email}-${contact.createdAt ?? contact.lastContactAt ?? index}`}
                    style={{ borderTop: '1px solid #e5e7eb' }}
                  >
                    <td style={{ padding: '0.75rem', fontWeight: 600, color: '#111827' }}>{contact.name || '—'}</td>
                    <td style={{ padding: '0.75rem', color: '#1d4ed8' }}>{contact.email || '—'}</td>
                    <td style={{ padding: '0.75rem', color: '#111827' }}>{contact.phone || '—'}</td>
                    <td style={{ padding: '0.75rem', color: '#374151' }}>
                      {formatDateSafe(contact.lastContactAt ?? contact.createdAt)}
                    </td>
                    <td style={{ padding: '0.75rem', textAlign: 'center' }}>
                      <BooleanBadge value={Boolean(contact.privacy)} />
                    </td>
                    <td style={{ padding: '0.75rem', textAlign: 'center' }}>
                      <BooleanBadge value={Boolean(contact.newsletter)} />
                    </td>
                    <td style={{ padding: '0.75rem', textAlign: 'right', fontWeight: 600 }}>
                      {contact.bookingsCount ?? contact.totalBookings ?? 0}
                    </td>
                    <td style={{ padding: '0.75rem' }}>
                      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                        <button
                          type="button"
                          onClick={() => handleOpenEdit(contact)}
                          style={{
                            padding: '0.45rem 1rem',
                            borderRadius: 999,
                            border: '1px solid #d1d5db',
                            backgroundColor: '#fff',
                            color: '#111827',
                            fontWeight: 600,
                            cursor: 'pointer',
                          }}
                        >
                          Modifica
                        </button>
                        <button
                          type="button"
                          onClick={() => handleHide(contact)}
                          disabled={pendingHideEmail === contact.email}
                          style={{
                            padding: '0.45rem 1rem',
                            borderRadius: 999,
                            border: '1px solid #b91c1c',
                            backgroundColor: '#b91c1c',
                            color: '#fef2f2',
                            fontWeight: 600,
                            cursor: pendingHideEmail === contact.email ? 'wait' : 'pointer',
                            opacity: pendingHideEmail === contact.email ? 0.7 : 1,
                          }}
                        >
                          Nascondi
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {error ? (
          <p style={{ margin: 0, color: '#b91c1c', fontWeight: 600 }}>{error}</p>
        ) : null}

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
          <button
            type="button"
            onClick={() => setPage((prev) => Math.max(1, prev - 1))}
            disabled={!hasPreviousPage || loading}
            style={{
              padding: '0.55rem 1.2rem',
              borderRadius: 999,
              border: '1px solid #d1d5db',
              backgroundColor: '#fff',
              color: '#374151',
              fontWeight: 600,
              cursor: hasPreviousPage && !loading ? 'pointer' : 'not-allowed',
              opacity: hasPreviousPage && !loading ? 1 : 0.6,
            }}
          >
            ← Precedente
          </button>
          <div style={{ fontSize: '0.9rem', color: '#4b5563' }}>
            Mostra da {rangeStart} a {rangeEnd}
          </div>
          <button
            type="button"
            onClick={() => setPage((prev) => prev + 1)}
            disabled={!hasNextPage || loading}
            style={{
              padding: '0.55rem 1.2rem',
              borderRadius: 999,
              border: '1px solid #111827',
              backgroundColor: '#111827',
              color: '#f9fafb',
              fontWeight: 600,
              cursor: hasNextPage && !loading ? 'pointer' : 'not-allowed',
              opacity: hasNextPage && !loading ? 1 : 0.6,
            }}
          >
            Successiva →
          </button>
        </div>
      </section>

      <EditContactModal
        open={isEditOpen && Boolean(editingContact)}
        contact={editingContact}
        onClose={handleCloseEdit}
        onSuccess={() => {
          refreshContacts();
          handleCloseEdit();
        }}
      />
      <MergeContactsDialog
        open={isMergeOpen}
        contacts={contactItems}
        onClose={() => setIsMergeOpen(false)}
        onMerged={() => {
          refreshContacts();
          setIsMergeOpen(false);
        }}
      />
    </div>
  );
}

export default function ContactsPageClient() {
  return (
    <ToastProvider>
      <ContactsPageInner />
    </ToastProvider>
  );
}
