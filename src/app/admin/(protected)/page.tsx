// src/app/admin/page.tsx
import type { CSSProperties } from 'react';
import type { BookingStatus } from '@prisma/client';

import { prisma } from '@/lib/prisma';
import { toAdminBookingDTO } from '@/lib/admin/booking-dto';
import { formatCurrency } from '@/lib/formatCurrency';

function startOfDay(date: Date) {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

function endOfDay(date: Date) {
  const next = new Date(date);
  next.setHours(23, 59, 59, 999);
  return next;
}

function addDays(base: Date, days: number) {
  const next = new Date(base);
  next.setDate(next.getDate() + days);
  return next;
}

function formatDate(value: string) {
  const date = new Date(value);
  return date.toLocaleString('it-IT', {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default async function AdminDashboardPage() {
  const now = new Date();
  const todayStart = startOfDay(now);
  const todayEnd = endOfDay(now);
  const tomorrowStart = addDays(todayStart, 1);
  const sevenDays = addDays(todayStart, 7);

  const activeStatuses: BookingStatus[] = ['pending', 'pending_payment', 'confirmed'];

  const [todayCount, nextSevenCount, pendingPayment, pendingConfirmation, cancelledCount, upcoming, latest] =
    await Promise.all([
      prisma.booking.count({
        where: {
          status: { in: activeStatuses },
          date: { gte: todayStart, lte: todayEnd },
        },
      }),
      prisma.booking.count({
        where: {
          status: { in: activeStatuses },
          date: { gte: tomorrowStart, lte: sevenDays },
        },
      }),
      prisma.booking.count({ where: { status: 'pending_payment' } }),
      prisma.booking.count({ where: { status: 'pending' } }),
      prisma.booking.count({ where: { status: 'cancelled' } }),
      prisma.booking.findMany({
        where: {
          status: { in: activeStatuses },
          date: { gte: now },
        },
        orderBy: { date: 'asc' },
        take: 10,
      }),
      prisma.booking.findMany({
        orderBy: { createdAt: 'desc' },
        take: 10,
      }),
    ]);

  const upcomingRows = upcoming.map(toAdminBookingDTO);
  const latestRows = latest.map(toAdminBookingDTO);

  return (
    <div style={{ display: 'grid', gap: '2rem' }}>
      <section
        style={{
          display: 'grid',
          gap: '1.5rem',
        }}
      >
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: '1.5rem',
          }}
        >
          <div style={cardStyle}>
            <h2 style={cardTitleStyle}>Prenotazioni imminenti</h2>
            <p style={countStyle}>{todayCount}</p>
            <p style={cardHintStyle}>Oggi</p>
            <div style={{ marginTop: '1rem', color: '#6b7280', fontSize: '0.95rem' }}>
              Prossimi 7 giorni: <strong>{nextSevenCount}</strong>
            </div>
          </div>
          <div style={cardStyle}>
            <h2 style={cardTitleStyle}>In attesa pagamento</h2>
            <p style={countStyle}>{pendingPayment}</p>
            <p style={cardHintStyle}>Clienti con pagamento da completare</p>
          </div>
          <div style={cardStyle}>
            <h2 style={cardTitleStyle}>Da confermare</h2>
            <p style={countStyle}>{pendingConfirmation}</p>
            <p style={cardHintStyle}>Richieste in stato &quot;pending&quot;</p>
          </div>
          <div style={cardStyle}>
            <h2 style={cardTitleStyle}>Annullate</h2>
            <p style={countStyle}>{cancelledCount}</p>
            <p style={cardHintStyle}>Totale prenotazioni cancellate</p>
          </div>
        </div>
      </section>

      <section>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 600 }}>Prossime prenotazioni</h2>
          <a href="/admin/bookings" style={{ color: '#2563eb', textDecoration: 'none', fontWeight: 600 }}>
            Vedi tutte →
          </a>
        </div>
        <div style={{ overflowX: 'auto', backgroundColor: '#fff', borderRadius: 16, boxShadow: '0 10px 30px rgba(15, 23, 42, 0.08)' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 720 }}>
            <thead>
              <tr style={{ textAlign: 'left', backgroundColor: '#f9fafb', fontSize: '0.85rem', color: '#6b7280' }}>
                <th style={thStyle}>Data</th>
                <th style={thStyle}>Tipo</th>
                <th style={thStyle}>Nome</th>
                <th style={thStyle}>Persone</th>
                <th style={thStyle}>Stato</th>
              </tr>
            </thead>
            <tbody>
              {upcomingRows.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ padding: '1.5rem', textAlign: 'center', color: '#6b7280' }}>
                    Nessuna prenotazione imminente.
                  </td>
                </tr>
              ) : (
                upcomingRows.map((booking) => (
                  <tr key={booking.id} style={{ borderTop: '1px solid #f1f5f9' }}>
                    <td style={tdStyle}>{formatDate(booking.date)}</td>
                    <td style={tdStyle}>{booking.type}</td>
                    <td style={tdStyle}>{booking.name}</td>
                    <td style={tdStyle}>{booking.people}</td>
                    <td style={tdStyle}>{booking.status}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h2 style={{ margin: '2rem 0 1rem', fontSize: '1.25rem', fontWeight: 600 }}>Ultime prenotazioni</h2>
        <div style={{ backgroundColor: '#fff', borderRadius: 16, boxShadow: '0 10px 30px rgba(15, 23, 42, 0.08)', padding: '1.5rem' }}>
          {latestRows.length === 0 ? (
            <p style={{ margin: 0, color: '#6b7280' }}>Non ci sono prenotazioni recenti.</p>
          ) : (
            <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: '0.75rem' }}>
              {latestRows.map((booking) => (
                <li
                  key={booking.id}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    borderBottom: '1px solid #f1f5f9',
                    paddingBottom: '0.75rem',
                  }}
                >
                  <div style={{ textAlign: 'left' }}>
                    <strong style={{ display: 'block', color: '#0f172a' }}>#{booking.id} — {booking.name}</strong>
                    <span style={{ color: '#64748b', fontSize: '0.9rem' }}>
                      Creato il {formatDate(booking.createdAt)}
                    </span>
                  </div>
                  <span style={{ color: '#0f172a', fontWeight: 600 }}>
                    {formatCurrency(booking.totalCents ?? 0)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </div>
  );
}

const cardStyle: CSSProperties = {
  backgroundColor: '#fff',
  borderRadius: 16,
  padding: '1.75rem',
  boxShadow: '0 10px 30px rgba(15, 23, 42, 0.08)',
  display: 'grid',
  gap: '0.5rem',
};

const cardTitleStyle: CSSProperties = {
  margin: 0,
  fontSize: '1rem',
  fontWeight: 600,
  color: '#111827',
};

const cardHintStyle: CSSProperties = {
  margin: 0,
  fontSize: '0.9rem',
  color: '#6b7280',
};

const countStyle: CSSProperties = {
  margin: 0,
  fontSize: '2.25rem',
  fontWeight: 700,
  color: '#111827',
};

const thStyle: CSSProperties = {
  padding: '0.85rem 1.25rem',
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
};

const tdStyle: CSSProperties = {
  padding: '1rem 1.25rem',
  fontSize: '0.95rem',
};
