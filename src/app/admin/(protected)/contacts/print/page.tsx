import PrintTrigger from '@/components/admin/bookings/PrintTrigger';
import { assertAdmin } from '@/lib/admin/session';
import {
  buildContactsFilters,
  fetchContactsData,
  resolveContactsPagination,
} from '@/lib/admin/contacts-query';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const PRINT_MAX_PAGE_SIZE = 1000;

type SearchParams = Record<string, string | string[] | undefined>;

type ContactPrintRow = {
  name: string;
  email: string;
  phone: string;
  createdAt: Date;
  agreePrivacy: boolean;
  agreeMarketing: boolean;
  totalBookings: number;
};

function toURLSearchParams(searchParams: SearchParams) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(searchParams)) {
    if (value == null) continue;
    if (Array.isArray(value)) {
      value.forEach((entry) => {
        if (entry != null) params.append(key, entry);
      });
    } else {
      params.set(key, value);
    }
  }
  return params;
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('it-IT', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

function formatDateTime(value: Date) {
  if (Number.isNaN(value.getTime())) return '—';
  return value.toLocaleString('it-IT', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function summarizeFilters(params: URLSearchParams) {
  const parts: string[] = [];

  const search = params.get('q') ?? params.get('search');
  if (search) parts.push(`ricerca: “${search}”`);

  const newsletter = params.get('newsletter');
  if (newsletter === 'true') parts.push('newsletter: sì');
  else if (newsletter === 'false') parts.push('newsletter: no');

  const privacy = params.get('privacy');
  if (privacy === 'true') parts.push('privacy: sì');
  else if (privacy === 'false') parts.push('privacy: no');

  const from = params.get('from');
  if (from) parts.push(`dal ${formatDate(from)}`);
  const to = params.get('to');
  if (to) parts.push(`al ${formatDate(to)}`);

  return parts.length > 0 ? parts.join(' · ') : 'Nessun filtro attivo';
}

function normalizeRows(data: Awaited<ReturnType<typeof fetchContactsData>>): ContactPrintRow[] {
  return data.map((contact) => ({
    name: contact.name,
    email: contact.email,
    phone: contact.phone,
    createdAt: new Date(contact.createdAt),
    agreePrivacy: contact.agreePrivacy,
    agreeMarketing: contact.agreeMarketing,
    totalBookings: contact.totalBookings,
  }));
}

export default async function AdminContactsPrintPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  await assertAdmin();

  const params = toURLSearchParams(searchParams);
  const filters = buildContactsFilters(params);
  const { page, pageSize, skip } = resolveContactsPagination(params, {
    defaultPageSize: PRINT_MAX_PAGE_SIZE,
    maxPageSize: PRINT_MAX_PAGE_SIZE,
  });

  const contacts: ContactPrintRow[] = normalizeRows(
    await fetchContactsData({
      whereClause: filters.whereClause,
      limit: pageSize,
      offset: skip,
    })
  );

  const filterSummary = summarizeFilters(params);

  return (
    <div style={{ display: 'grid', gap: '1.5rem' }}>
      <style>{`
        body { background: #fff !important; color: #111827; }
        body > div:first-of-type { display: block !important; }
        body > div:first-of-type > aside,
        body > div:first-of-type > div > header { display: none !important; }
        body > div:first-of-type > div { width: 100%; }
        body > div:first-of-type > div > main {
          padding: 2rem !important; max-width: 960px; margin: 0 auto; background: #fff;
        }
        @media print {
          body > div:first-of-type > div > main { padding: 0 !important; }
          .print-actions { display: none !important; }
          table { page-break-inside: avoid; }
        }
        table { width: 100%; border-collapse: collapse; }
        thead tr { background: #f3f4f6; }
        th, td {
          border: 1px solid #e5e7eb; padding: 0.55rem 0.75rem; text-align: left; font-size: 0.95rem;
        }
        th {
          font-size: 0.8rem; text-transform: uppercase; letter-spacing: 0.04em; color: #374151;
        }
        tbody tr:nth-child(even) { background: #f9fafb; }
      `}</style>

      <div className="print-actions" style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <PrintTrigger />
      </div>

      <header style={{ display: 'grid', gap: '0.35rem' }}>
        <h1 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 700 }}>
          Bar La Soluzione – Contatti
        </h1>
        <p style={{ margin: 0, color: '#4b5563' }}>{filterSummary}</p>
        <p style={{ margin: 0, color: '#6b7280', fontSize: '0.9rem' }}>
          Risultati pagina {page} (max {pageSize} elementi) · Contatti mostrati: {contacts.length}
        </p>
      </header>

      <table>
        <thead>
          <tr>
            <th>Nome</th>
            <th>Email</th>
            <th>Telefono</th>
            <th>Ultimo contatto</th>
            <th>Privacy</th>
            <th>Newsletter</th>
            <th>Prenotazioni</th>
          </tr>
        </thead>
        <tbody>
          {contacts.length === 0 ? (
            <tr>
              <td colSpan={7} style={{ textAlign: 'center', padding: '1.5rem', color: '#6b7280' }}>
                Nessun contatto disponibile con i filtri selezionati.
              </td>
            </tr>
          ) : (
            contacts.map((contact: ContactPrintRow) => (
              <tr key={`${contact.email}-${contact.createdAt.toISOString()}`}>
                <td style={{ fontWeight: 600, color: '#111827' }}>{contact.name || '—'}</td>
                <td style={{ color: '#1d4ed8' }}>{contact.email || '—'}</td>
                <td>{contact.phone || '—'}</td>
                <td>{formatDateTime(contact.createdAt)}</td>
                <td>{contact.agreePrivacy ? 'Sì' : 'No'}</td>
                <td>{contact.agreeMarketing ? 'Sì' : 'No'}</td>
                <td style={{ textAlign: 'right', fontWeight: 600 }}>{contact.totalBookings}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
