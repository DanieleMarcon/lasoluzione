// src/app/admin/bookings/print/page.tsx
import { assertAdmin } from '@/lib/admin/session';
import { prisma } from '@/lib/prisma';
import { fetchAdminSettingsDTO } from '@/lib/admin/settings-dto';
import { buildAdminBookingQuery, ADMIN_BOOKINGS_MAX_PAGE_SIZE } from '@/lib/admin/booking-query';
import { normalizeStoredLunchItems, normalizeStoredDinnerItems } from '@/lib/lunchOrder';
import PrintTrigger from '@/components/admin/bookings/PrintTrigger';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const euro = new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' });

function toURLSearchParams(searchParams: Record<string, string | string[] | undefined>) {
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

function formatDate(value: Date) {
  return value.toLocaleDateString('it-IT', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

function formatTime(value: Date) {
  return value.toLocaleTimeString('it-IT', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

function summarizeFilters(params: URLSearchParams, typeLabels: Record<string, string>) {
  const parts: string[] = [];

  const from = params.get('from');
  const to = params.get('to');
  if (from) parts.push(`dal ${formatDate(new Date(from))}`);
  if (to) parts.push(`al ${formatDate(new Date(to))}`);

  const type = params.get('type');
  if (type) {
    parts.push(`tipo: ${typeLabels[type] ?? type}`);
  }

  const status = params.get('status');
  if (status) {
    parts.push(`stato: ${status}`);
  }

  const query = params.get('q');
  if (query) {
    parts.push(`ricerca: “${query}”`);
  }

  return parts.length > 0 ? parts.join(' · ') : 'Nessun filtro attivo';
}

export default async function AdminBookingsPrintPage({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  await assertAdmin();

  const params = toURLSearchParams(searchParams);
  if (!params.has('pageSize')) {
    params.set('pageSize', String(ADMIN_BOOKINGS_MAX_PAGE_SIZE));
  }

  const { page, pageSize, skip, where } = buildAdminBookingQuery(params);
  const [settings, bookings] = await Promise.all([
    fetchAdminSettingsDTO(),
    prisma.booking.findMany({
      where,
      orderBy: { date: 'desc' },
      skip,
      take: pageSize,
      select: {
        id: true,
        date: true,
        type: true,
        name: true,
        people: true,
        phone: true,
        email: true,
        lunchItemsJson: true,
        dinnerItemsJson: true,
        tierLabel: true,
        tierPriceCents: true,
      },
    }),
  ]);

  const filterSummary = summarizeFilters(params, settings.typeLabels);

  const lines = bookings.map((booking) => {
    const date = new Date(booking.date);
    const lunchItems = normalizeStoredLunchItems(booking.lunchItemsJson);
    const dinnerItems = normalizeStoredDinnerItems(booking.dinnerItemsJson);
    const isLunch = booking.type === 'pranzo';
    const isDinner = booking.type === 'cena';

    return {
      ...booking,
      date,
      typeLabel: settings.typeLabels[booking.type] ?? booking.type,
      lunchItems,
      dinnerItems,
      isLunch,
      isDinner,
    };
  });

  return (
    <div style={{ display: 'grid', gap: '1.5rem' }}>
      <style>{`
        body {
          background: #fff !important;
          color: #111827;
        }
        body > div:first-of-type {
          display: block !important;
        }
        body > div:first-of-type > aside,
        body > div:first-of-type > div > header {
          display: none !important;
        }
        body > div:first-of-type > div {
          width: 100%;
        }
        body > div:first-of-type > div > main {
          padding: 2rem !important;
          max-width: 1000px;
          margin: 0 auto;
          background: #fff;
        }
        @media print {
          body > div:first-of-type > div > main {
            padding: 0 !important;
          }
          .print-actions {
            display: none !important;
          }
          table {
            page-break-inside: avoid;
          }
        }
        table {
          width: 100%;
          border-collapse: collapse;
        }
        thead tr {
          background: #f3f4f6;
        }
        th, td {
          border: 1px solid #e5e7eb;
          padding: 0.5rem 0.75rem;
          text-align: left;
          font-size: 0.95rem;
        }
        th {
          font-size: 0.85rem;
          text-transform: uppercase;
          letter-spacing: 0.04em;
          color: #374151;
        }
        tbody tr:nth-child(even) {
          background: #f9fafb;
        }
      `}</style>

      <div className="print-actions" style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <PrintTrigger />
      </div>

      <header style={{ display: 'grid', gap: '0.35rem' }}>
        <h1 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 700 }}>Bar La Soluzione – Prenotazioni</h1>
        <p style={{ margin: 0, color: '#4b5563' }}>{filterSummary}</p>
        <p style={{ margin: 0, color: '#6b7280', fontSize: '0.9rem' }}>
          Risultati pagina {page} (max {pageSize} elementi)
        </p>
      </header>

      <table>
        <thead>
          <tr>
            <th>Data</th>
            <th>Ora</th>
            <th>Tipo</th>
            <th>Nome</th>
            <th>Persone</th>
            <th>Telefono</th>
            <th>Email</th>
            <th>Dettagli</th>
          </tr>
        </thead>
        <tbody>
          {lines.length === 0 ? (
            <tr>
              <td colSpan={8} style={{ textAlign: 'center', padding: '1.5rem', color: '#6b7280' }}>
                Nessuna prenotazione trovata per i filtri selezionati.
              </td>
            </tr>
          ) : (
            lines.map((booking) => {
              let details: string;
              if (booking.isLunch) {
                details = booking.lunchItems.length
                  ? booking.lunchItems.map((item) => `${item.qty} × ${item.name}`).join(' · ')
                  : '—';
              } else if (booking.isDinner) {
                details = booking.dinnerItems.length
                  ? booking.dinnerItems.map((item) => `${item.qty} × ${item.name}`).join(' · ')
                  : '—';
              } else if (booking.tierLabel) {
                const price = booking.tierPriceCents != null ? euro.format(booking.tierPriceCents / 100) : '';
                details = price ? `${booking.tierLabel} – ${price}` : booking.tierLabel;
              } else {
                details = '—';
              }

              return (
                <tr key={booking.id}>
                  <td>{formatDate(booking.date)}</td>
                  <td>{formatTime(booking.date)}</td>
                  <td>{booking.typeLabel}</td>
                  <td>{booking.name}</td>
                  <td>{booking.people}</td>
                  <td>{booking.phone}</td>
                  <td>{booking.email}</td>
                  <td>{details}</td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}
