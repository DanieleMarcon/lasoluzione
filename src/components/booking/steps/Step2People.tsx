'use client';
import { useEffect, useMemo } from 'react';
import { useFormContext } from 'react-hook-form';
import type { BookingMenuDTO, BookingTiersDTO, BookingTierDTO } from '@/types/bookingConfig';

type Step2PeopleProps = {
  typeOptions: Array<{ value: string; label: string; requiresPrepay?: boolean }>;
  prepayAmountCents?: number;
  menu: BookingMenuDTO;
  tiers: BookingTiersDTO;
};

type LunchOrderItem = {
  dishId: number;
  qty: number;
};

type TierValue = {
  id: string;
  label: string;
  priceCents: number;
  type: 'evento' | 'aperitivo';
  order: number;
};

function formatMoney(cents: number) {
  return (cents / 100).toLocaleString('it-IT', { style: 'currency', currency: 'EUR' });
}

function toTierValue(tier: BookingTierDTO): TierValue {
  return {
    id: tier.id,
    label: tier.label,
    priceCents: tier.priceCents,
    type: tier.type,
    order: tier.order,
  };
}

export default function Step2People({ typeOptions, prepayAmountCents, menu, tiers }: Step2PeopleProps) {
  const {
    register,
    formState: { errors },
    setValue,
    watch,
  } = useFormContext();

  useEffect(() => {
    register('lunchOrder');
  }, [register]);

  useEffect(() => {
    register('tier');
    register('tierId');
    register('tierType');
    register('tierLabel');
    register('tierPriceCents');
  }, [register]);

  const people = watch('people') as number;
  const selectedType = watch('type') as string;
  const lunchOrder = (watch('lunchOrder') as LunchOrderItem[] | undefined) ?? [];
  const selectedTier = watch('tier') as TierValue | undefined;

  useEffect(() => {
    if (typeOptions.length === 0) return;
    if (!typeOptions.some(option => option.value === selectedType)) {
      const fallback = typeOptions[0];
      setValue('type', fallback.value as any, { shouldValidate: true });
    }
  }, [selectedType, setValue, typeOptions]);

  useEffect(() => {
    if (selectedType !== 'pranzo' && selectedType !== 'cena') {
      setValue('lunchOrder', [], { shouldValidate: true });
    }
  }, [selectedType, setValue]);

  const isTierType = selectedType === 'evento' || selectedType === 'aperitivo';
  const isLunch = selectedType === 'pranzo';
  const isDinner = selectedType === 'cena';
  const isMealWithMenu = isLunch || isDinner;

  const tierOptions = useMemo(() => {
    if (!isTierType) return [] as TierValue[];
    const key = selectedType as 'evento' | 'aperitivo';
    return [...(tiers[key] ?? [])]
      .filter((tier) => tier.active)
      .sort((a, b) => {
        if (a.order !== b.order) return a.order - b.order;
        return a.label.localeCompare(b.label);
      })
      .map(toTierValue);
  }, [isTierType, selectedType, tiers]);

  useEffect(() => {
    if (!isTierType) {
      if (selectedTier) {
        setValue('tier', undefined, { shouldValidate: true });
      }
      setValue('tierId', undefined, { shouldValidate: true });
      setValue('tierType', undefined, { shouldValidate: true });
      setValue('tierLabel', undefined, { shouldValidate: true });
      setValue('tierPriceCents', undefined, { shouldValidate: true });
      return;
    }

    if (tierOptions.length === 0) {
      setValue('tier', undefined, { shouldValidate: true });
      setValue('tierId', undefined, { shouldValidate: true });
      setValue('tierType', undefined, { shouldValidate: true });
      setValue('tierLabel', undefined, { shouldValidate: true });
      setValue('tierPriceCents', undefined, { shouldValidate: true });
      return;
    }

    const exists = selectedTier && tierOptions.some((tier) => tier.id === selectedTier.id);
    if (!exists) {
      const first = tierOptions[0];
      setValue('tier', first, { shouldValidate: true });
      setValue('tierId', first.id, { shouldValidate: true });
      setValue('tierType', selectedType as 'evento' | 'aperitivo', { shouldValidate: true });
      setValue('tierLabel', first.label, { shouldValidate: true });
      setValue('tierPriceCents', first.priceCents, { shouldValidate: true });
    } else if (selectedTier) {
      setValue('tierId', selectedTier.id, { shouldValidate: true });
      setValue('tierType', selectedType as 'evento' | 'aperitivo', { shouldValidate: true });
      setValue('tierLabel', selectedTier.label, { shouldValidate: true });
      setValue('tierPriceCents', selectedTier.priceCents, { shouldValidate: true });
    }
  }, [isTierType, tierOptions, selectedTier, setValue]);

  const filteredDishes = useMemo(() => {
    if (isLunch) {
      return menu.dishes.filter((dish) => dish.visibleAt === 'lunch' || dish.visibleAt === 'both');
    }
    if (isDinner) {
      return menu.dishes.filter((dish) => dish.visibleAt === 'dinner' || dish.visibleAt === 'both');
    }
    return [];
  }, [isLunch, isDinner, menu.dishes]);

  const orderMap = useMemo(() => {
    const map = new Map<number, number>();
    for (const item of lunchOrder) {
      map.set(item.dishId, item.qty);
    }
    return map;
  }, [lunchOrder]);

  const updateQty = (dishId: number, qty: number) => {
    const nextQty = Number.isFinite(qty) && qty > 0 ? Math.floor(qty) : 0;
    const next = lunchOrder.filter(item => item.dishId !== dishId);
    if (nextQty > 0) {
      next.push({ dishId, qty: nextQty });
    }
    setValue('lunchOrder', next, { shouldValidate: true, shouldDirty: true });
  };

  const groups = useMemo(() => {
    const map = new Map<string, typeof filteredDishes>();
    filteredDishes.forEach(dish => {
      const key = dish.category ?? '';
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(dish);
    });
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [filteredDishes]);

  const peopleCount = Number.isFinite(people) ? Number(people) : 0;
  const mealCoverCents = isLunch
    ? menu.coverCents
    : isDinner
      ? menu.dinnerCoverCents
      : 0;
  const subtotalCents = isMealWithMenu
    ? filteredDishes.reduce((acc, dish) => acc + dish.priceCents * (orderMap.get(dish.id) ?? 0), 0)
    : 0;
  const coverTotalCents = isMealWithMenu ? mealCoverCents * peopleCount : 0;
  const totalCents = isMealWithMenu ? subtotalCents + coverTotalCents : 0;

  const lunchError = errors.lunchOrder as any;
  const tierErrorSources = [
    errors.tier as { message?: string } | undefined,
    errors.tierId as { message?: string } | undefined,
    errors.tierType as { message?: string } | undefined,
    errors.tierLabel as { message?: string } | undefined,
    errors.tierPriceCents as { message?: string } | undefined,
  ];
  const tierErrorMessage = tierErrorSources.find((err) => err?.message)?.message;

  return (
    <fieldset>
      <legend>Persone &amp; tipologia</legend>
      <label htmlFor="people">Numero persone</label>
      <br />
      <input
        id="people"
        type="number"
        min={1}
        max={50}
        {...register('people', { valueAsNumber: true })}
        aria-invalid={!!errors.people}
        aria-describedby="err-people"
      />
      <br />
      <span id="err-people" role="alert">
        {(errors.people as any)?.message}
      </span>
      <div style={{ marginTop: '.75rem' }}>
        <span id="type-label">Tipologia</span>
        <br />
        <div role="radiogroup" aria-labelledby="type-label" style={{ display: 'flex', gap: '.5rem', flexWrap: 'wrap' }}>
          {typeOptions.length === 0 ? (
            <p>Nessuna tipologia disponibile al momento.</p>
          ) : (
            typeOptions.map(option => {
              const requiresPrepay = option.requiresPrepay;
              const isLunchOption = option.value === 'pranzo';
              const isDinnerOption = option.value === 'cena';
              const prepayLabel = (() => {
                if (!requiresPrepay && !isLunchOption && !isDinnerOption) return '';
                if (isLunchOption && menu.lunchRequirePrepay) {
                  return ' (pagamento anticipato)';
                }
                if (isDinnerOption && menu.dinnerRequirePrepay) {
                  return ' (pagamento anticipato)';
                }
                if (requiresPrepay && prepayAmountCents) {
                  return ` (anticipo ${formatMoney(prepayAmountCents)})`;
                }
                return requiresPrepay ? ' (richiede anticipo)' : '';
              })();
              return (
                <label
                  key={option.value}
                  style={{
                    border: '1px solid var(--color-border)',
                    padding: '.5rem',
                    borderRadius: '12px',
                    minWidth: '160px',
                  }}
                >
                  <input type="radio" {...register('type')} value={option.value} />{' '}
                  {option.label}
                  {prepayLabel}
                </label>
              );
            })
          )}
        </div>
      </div>
      <p style={{ marginTop: '.5rem' }}>
        Hai selezionato {peopleCount} {peopleCount === 1 ? 'persona' : 'persone'}.
      </p>

      {isTierType && (
        <section style={{ marginTop: '1.5rem', borderTop: '1px solid #e5e7eb', paddingTop: '1rem' }}>
          <h4 id="tier-options" style={{ margin: 0 }}>Opzioni disponibili</h4>
          {tierOptions.length === 0 ? (
            <p style={{ marginTop: '.5rem' }}>
              Nessun pacchetto configurato per questa tipologia al momento.
            </p>
          ) : (
            <div role="radiogroup" aria-labelledby="tier-options" style={{ display: 'grid', gap: '.75rem', marginTop: '.75rem' }}>
              {tierOptions.map((tier) => {
                const checked = selectedTier?.id === tier.id;
                return (
                  <label
                    key={tier.id}
                    style={{
                      border: checked ? '2px solid #1d4ed8' : '1px solid #e5e7eb',
                      borderRadius: 12,
                      padding: '0.75rem 1rem',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      background: '#fff',
                      gap: '1rem',
                    }}
                  >
                    <span style={{ display: 'flex', alignItems: 'center', gap: '.75rem' }}>
                      <input
                        type="radio"
                        name="tier-option"
                        value={tier.id}
                        checked={checked}
                        onChange={() => {
                          setValue('tier', tier, {
                            shouldValidate: true,
                            shouldDirty: true,
                          });
                          setValue('tierId', tier.id, {
                            shouldValidate: true,
                            shouldDirty: true,
                          });
                          setValue('tierType', selectedType as 'evento' | 'aperitivo', {
                            shouldValidate: true,
                            shouldDirty: true,
                          });
                          setValue('tierLabel', tier.label, {
                            shouldValidate: true,
                            shouldDirty: true,
                          });
                          setValue('tierPriceCents', tier.priceCents, {
                            shouldValidate: true,
                            shouldDirty: true,
                          });
                        }}
                      />
                      <span style={{ fontWeight: 600 }}>{tier.label}</span>
                    </span>
                    <span style={{ fontSize: '0.95rem', color: '#111827' }}>
                      {formatMoney(tier.priceCents)}
                    </span>
                  </label>
                );
              })}
            </div>
          )}
          {selectedTier && (
            <p style={{ marginTop: '.5rem', color: '#0f172a' }}>
              Prezzo selezionato: <strong>{formatMoney(selectedTier.priceCents)}</strong>
            </p>
          )}
          {tierErrorMessage && (
            <div style={{ marginTop: '.5rem', color: '#b91c1c' }} role="alert">
              {tierErrorMessage}
            </div>
          )}
        </section>
      )}

      {isMealWithMenu && (
        <div style={{ marginTop: '1.5rem', display: 'grid', gap: '1rem' }}>
          {((isLunch && menu.lunchRequirePrepay) || (isDinner && menu.dinnerRequirePrepay)) && (
            <p style={{ margin: 0, color: '#b45309', fontWeight: 600 }}>
              ⚠️ {isLunch ? 'Il pranzo' : 'La cena'} richiede il pagamento anticipato.
            </p>
          )}

          {groups.length === 0 ? (
            <p>Nessun piatto configurato. Contatta l'amministratore.</p>
          ) : (
            groups.map(([category, dishes]) => (
              <section key={category || 'no-category'} style={{ borderTop: '1px solid #e5e7eb', paddingTop: '1rem' }}>
                {category ? <h4 style={{ margin: 0 }}>{category}</h4> : null}
                <div style={{ display: 'grid', gap: '0.75rem' }}>
                  {dishes.map((dish) => {
                    const qty = orderMap.get(dish.id) ?? 0;
                    return (
                      <div
                        key={dish.id}
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          border: '1px solid #e5e7eb',
                          borderRadius: 12,
                          padding: '0.75rem 1rem',
                          background: '#fff',
                        }}
                      >
                        <div>
                          <p style={{ margin: 0, fontWeight: 600 }}>{dish.name}</p>
                          {dish.description && (
                            <p style={{ margin: '.25rem 0 0', color: '#6b7280', fontSize: '0.9rem' }}>{dish.description}</p>
                          )}
                          <p style={{ margin: '.25rem 0 0', fontSize: '0.9rem', color: '#111827' }}>
                            Prezzo: <strong>{formatMoney(dish.priceCents)}</strong>
                          </p>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '.5rem' }}>
                          <label style={{ display: 'flex', alignItems: 'center', gap: '.5rem' }}>
                            <span>Qtà</span>
                            <input
                              type="number"
                              min={0}
                              max={99}
                              value={qty}
                              onChange={(event) =>
                                updateQty(dish.id, Number.parseInt(event.target.value, 10) || 0)
                              }
                              style={{ width: '4.5rem' }}
                            />
                          </label>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            ))
          )}

          {lunchError && (
            <p style={{ margin: 0, color: '#b91c1c' }}>{lunchError.message}</p>
          )}

          <div
            style={{
              display: 'grid',
              gap: '.35rem',
              padding: '1rem',
              borderRadius: 12,
              background: '#f1f5f9',
              fontSize: '0.95rem',
            }}
          >
            <div>
              <strong>Subtotale piatti:</strong> {formatMoney(subtotalCents)}
            </div>
            {mealCoverCents > 0 && (
              <div>
                <strong>Coperto:</strong> {formatMoney(mealCoverCents)} × {peopleCount} = {formatMoney(coverTotalCents)}
              </div>
            )}
            <div style={{ fontSize: '1.05rem' }}>
              <strong>Totale {isLunch ? 'pranzo' : 'cena'}:</strong> {formatMoney(totalCents)}
            </div>
          </div>
        </div>
      )}
    </fieldset>
  );
}
