'use client';

import { useFormContext } from 'react-hook-form';

import type { BookingConfigDTO } from '@/types/bookingConfig';

type Step4ReviewProps = {
  config: BookingConfigDTO;
};

type LunchOrderItem = {
  dishId: number;
  qty: number;
};

function formatMoney(cents: number) {
  return (cents / 100).toLocaleString('it-IT', { style: 'currency', currency: 'EUR' });
}

export default function Step4Review({ config }: Step4ReviewProps) {
  const {
    getValues,
    register,
    formState: { errors },
  } = useFormContext();

  const values = getValues() as {
    date: string;
    time: string;
    people: number;
    type: string;
    name: string;
    email: string;
    phone: string;
    lunchOrder?: LunchOrderItem[];
    tier?: { id: string; label: string; priceCents: number } | null;
    tierLabel?: string | null;
    tierPriceCents?: number | null;
  };

  const typeLabel = config.typeLabels[values.type] ?? values.type;
  const requiresPrepay =
    config.prepayTypes.includes(values.type) ||
    (values.type === 'pranzo' && config.menu.lunchRequirePrepay) ||
    (values.type === 'cena' && config.menu.dinnerRequirePrepay);

  const selectedTier = values.tier && typeof values.tier === 'object' ? values.tier : null;
  const tierLabel = values.tierLabel ?? selectedTier?.label ?? null;
  const tierPriceCents = values.tierPriceCents ?? selectedTier?.priceCents ?? null;

  let lunchSummary: null | {
    items: Array<{ name: string; qty: number; priceCents: number }>;
    subtotalCents: number;
    coverTotalCents: number;
    coverCents: number;
    totalCents: number;
  } = null;

  let dinnerSummary: null | {
    items: Array<{ name: string; qty: number; priceCents: number }>;
    subtotalCents: number;
    coverTotalCents: number;
    coverCents: number;
    totalCents: number;
  } = null;

  if (values.type === 'pranzo') {
    const order = (values.lunchOrder ?? []).filter((item) => item.qty > 0);
    const dishMap = new Map(config.menu.dishes.map((dish) => [dish.id, dish] as const));
    const items = order
      .map((item) => {
        const dish = dishMap.get(item.dishId);
        if (!dish) return null;
        return {
          name: dish.name,
          qty: item.qty,
          priceCents: dish.priceCents,
        };
      })
      .filter((item): item is { name: string; qty: number; priceCents: number } => Boolean(item));

    const subtotalCents = items.reduce((acc, item) => acc + item.priceCents * item.qty, 0);
    const coverCents = config.menu.coverCents;
    const coverTotalCents = coverCents * (Number(values.people) || 0);
    lunchSummary = {
      items,
      subtotalCents,
      coverCents,
      coverTotalCents,
      totalCents: subtotalCents + coverTotalCents,
    };
  }

  if (values.type === 'cena') {
    const order = (values.lunchOrder ?? []).filter((item) => item.qty > 0);
    const dishMap = new Map(config.menu.dishes.map((dish) => [dish.id, dish] as const));
    const items = order
      .map((item) => {
        const dish = dishMap.get(item.dishId);
        if (!dish) return null;
        if (!(dish.visibleAt === 'dinner' || dish.visibleAt === 'both')) return null;
        return {
          name: dish.name,
          qty: item.qty,
          priceCents: dish.priceCents,
        };
      })
      .filter((item): item is { name: string; qty: number; priceCents: number } => Boolean(item));

    const subtotalCents = items.reduce((acc, item) => acc + item.priceCents * item.qty, 0);
    const coverCents = config.menu.dinnerCoverCents;
    const coverTotalCents = coverCents * (Number(values.people) || 0);
    dinnerSummary = {
      items,
      subtotalCents,
      coverCents,
      coverTotalCents,
      totalCents: subtotalCents + coverTotalCents,
    };
  }

  return (
    <section>
      <h3>Riepilogo</h3>
      <ul>
        <li>
          Data: <strong>{values.date}</strong>
        </li>
        <li>
          Orario: <strong>{values.time}</strong>
        </li>
        <li>
          Persone: <strong>{values.people}</strong>
        </li>
        <li>
          Tipo: <strong>{typeLabel}</strong>
        </li>
        {(values.type === 'evento' || values.type === 'aperitivo') && tierLabel && tierPriceCents != null && (
          <li>
            Opzione: <strong>{tierLabel}</strong>{' '}
            <span style={{ color: '#6b7280' }}>({formatMoney(tierPriceCents)})</span>
          </li>
        )}
        <li>
          Nome: <strong>{values.name}</strong>
        </li>
        <li>
          Email: <strong>{values.email}</strong>
        </li>
        <li>
          Telefono: <strong>{values.phone}</strong>
        </li>
      </ul>

      {lunchSummary && (
        <div style={{ marginTop: '1rem', border: '1px solid #e5e7eb', borderRadius: 12, padding: '1rem' }}>
          <h4 style={{ marginTop: 0 }}>Dettaglio pranzo</h4>
          {lunchSummary.items.length > 0 && (
            <ul>
              {lunchSummary.items.map((item) => (
                <li key={`${item.name}-${item.qty}`}>
                  {item.qty} × {item.name} — {formatMoney(item.priceCents)} cad. (Tot {formatMoney(item.priceCents * item.qty)})
                </li>
              ))}
            </ul>
          )}
          <p style={{ margin: '.5rem 0 0' }}>
            Subtotale: <strong>{formatMoney(lunchSummary.subtotalCents)}</strong>
          </p>
          {lunchSummary.coverCents > 0 && (
            <p style={{ margin: '.25rem 0 0' }}>
              Coperto: <strong>{formatMoney(lunchSummary.coverCents)}</strong> × {values.people} ={' '}
              <strong>{formatMoney(lunchSummary.coverTotalCents)}</strong>
            </p>
          )}
          <p style={{ margin: '.25rem 0 0', fontSize: '1.05rem' }}>
            Totale pranzo: <strong>{formatMoney(lunchSummary.totalCents)}</strong>
          </p>
        </div>
      )}

      {requiresPrepay && (
        <p style={{ marginTop: '1rem', color: 'var(--color-warning, #a15f00)' }}>
          Questa tipologia richiede il pagamento anticipato per completare la prenotazione.
        </p>
      )}

      {dinnerSummary && (
        <div style={{ marginTop: '1rem', border: '1px solid #e5e7eb', borderRadius: 12, padding: '1rem' }}>
          <h4 style={{ marginTop: 0 }}>Dettaglio cena</h4>
          {dinnerSummary.items.length > 0 && (
            <ul>
              {dinnerSummary.items.map((item) => (
                <li key={`${item.name}-${item.qty}`}>
                  {item.qty} × {item.name} — {formatMoney(item.priceCents)} cad. (Tot {formatMoney(item.priceCents * item.qty)})
                </li>
              ))}
            </ul>
          )}
          <p style={{ margin: '.5rem 0 0' }}>
            Subtotale: <strong>{formatMoney(dinnerSummary.subtotalCents)}</strong>
          </p>
          {dinnerSummary.coverCents > 0 && (
            <p style={{ margin: '.25rem 0 0' }}>
              Coperto: <strong>{formatMoney(dinnerSummary.coverCents)}</strong> × {values.people} ={' '}
              <strong>{formatMoney(dinnerSummary.coverTotalCents)}</strong>
            </p>
          )}
          <p style={{ margin: '.25rem 0 0', fontSize: '1.05rem' }}>
            Totale cena: <strong>{formatMoney(dinnerSummary.totalCents)}</strong>
          </p>
        </div>
      )}
      <div>
        <input
          id="agreePrivacy"
          type="checkbox"
          {...register('agreePrivacy')}
          aria-invalid={!!errors.agreePrivacy}
          aria-describedby="err-privacy"
        />
        <label htmlFor="agreePrivacy">
          Ho letto e accetto la <a href="/privacy">Privacy</a>.
        </label>
        <br />
        <span id="err-privacy" role="alert">{(errors.agreePrivacy as any)?.message}</span>
      </div>
      <div>
        <input id="agreeMarketing" type="checkbox" {...register('agreeMarketing')} />
        <label htmlFor="agreeMarketing">Acconsento a comunicazioni promozionali (facoltativo).</label>
      </div>
    </section>
  );
}
