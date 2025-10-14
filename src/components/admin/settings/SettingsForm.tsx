'use client';
/* eslint-disable @next/next/no-img-element */

import { useMemo, useState } from 'react';
import type { ChangeEvent, CSSProperties, FormEvent } from 'react';

import type { AdminEventInstance, AdminSettingsDTO } from '@/types/admin';
import { ToastProvider, useToast } from '@/components/admin/ui/toast';

type Props = {
  settings: AdminSettingsDTO;
  allTypes: string[];
  eventInstances: AdminEventInstance[];
};

type AlertState = {
  kind: 'success' | 'error';
  message: string;
};

function SettingsFormInner({ settings, allTypes, eventInstances: initialEventInstances }: Props) {
  const [enableDateStep, setEnableDateStep] = useState(settings.enableDateTimeStep);
  const [fixedDate, setFixedDate] = useState(settings.fixedDate ?? '');
  const [fixedTime, setFixedTime] = useState(settings.fixedTime ?? '');
  const [enabledTypes, setEnabledTypes] = useState(() => new Set(settings.enabledTypes));
  const [typeLabels, setTypeLabels] = useState<Record<string, string>>({ ...settings.typeLabels });
  const [prepayTypes, setPrepayTypes] = useState(() => new Set(settings.prepayTypes));
  const [prepayAmount, setPrepayAmount] = useState(
    settings.prepayAmountCents != null ? String(settings.prepayAmountCents) : ''
  );
  const [coverCents, setCoverCents] = useState(String(settings.coverCents ?? 0));
  const [lunchRequirePrepay, setLunchRequirePrepay] = useState(settings.lunchRequirePrepay);
  const [dinnerCoverCents, setDinnerCoverCents] = useState(String(settings.dinnerCoverCents ?? 0));
  const [dinnerRequirePrepay, setDinnerRequirePrepay] = useState(settings.dinnerRequirePrepay);
  const initialSite = settings.site ?? {
    brandLogoUrl: settings.siteBrandLogoUrl,
    heroImageUrl: settings.siteHeroImageUrl,
    footerRibbonUrl: settings.siteFooterRibbonUrl,
  };
  const [siteBrandLogoUrl, setSiteBrandLogoUrl] = useState(initialSite.brandLogoUrl ?? '');
  const [siteHeroImageUrl, setSiteHeroImageUrl] = useState(initialSite.heroImageUrl ?? '');
  const [siteFooterRibbonUrl, setSiteFooterRibbonUrl] = useState(initialSite.footerRibbonUrl ?? '');
  const [saving, setSaving] = useState(false);
  const [alert, setAlert] = useState<AlertState | null>(null);
  const [eventInstances, setEventInstances] = useState(() =>
    initialEventInstances.map((event) => ({ ...event }))
  );
  const [eventSaving, setEventSaving] = useState<Record<number, boolean>>({});
  const [eventErrors, setEventErrors] = useState<Record<number, string | null>>({});
  const toast = useToast();

  const typeOptions = useMemo(() => allTypes.sort(), [allTypes]);

  function formatEventDateTime(value: string) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return value;
    }
    return date.toLocaleString('it-IT', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  async function updateEventAllowEmailOnly(eventId: number, nextValue: boolean) {
    if (eventSaving[eventId]) {
      return;
    }

    const target = eventInstances.find((event) => event.id === eventId);
    if (!target) {
      return;
    }

    const previousValue = target.allowEmailOnlyBooking;
    if (previousValue === nextValue) {
      return;
    }

    setEventInstances((prev) =>
      prev.map((event) => (event.id === eventId ? { ...event, allowEmailOnlyBooking: nextValue } : event))
    );
    setEventSaving((prev) => ({ ...prev, [eventId]: true }));
    setEventErrors((prev) => ({ ...prev, [eventId]: null }));

    try {
      const response = await fetch(`/api/admin/event-instances/${eventId}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ allowEmailOnlyBooking: nextValue }),
      });

      const body = (await response.json().catch(() => null)) as
        | { error?: string; data?: { allowEmailOnlyBooking?: boolean } | null }
        | null;

      if (!response.ok) {
        const message = body?.error || "Impossibile aggiornare l'evento";
        throw new Error(message);
      }

      const confirmedValue =
        typeof body?.data?.allowEmailOnlyBooking === 'boolean'
          ? body.data.allowEmailOnlyBooking
          : nextValue;

      setEventInstances((prev) =>
        prev.map((event) =>
          event.id === eventId ? { ...event, allowEmailOnlyBooking: confirmedValue } : event
        )
      );
      toast.success('Evento aggiornato');
    } catch (error: unknown) {
      console.error('[SettingsForm] update allowEmailOnlyBooking error', error);
      const message = error instanceof Error ? error.message : "Impossibile aggiornare l'evento";
      setEventErrors((prev) => ({ ...prev, [eventId]: message }));
      setEventInstances((prev) =>
        prev.map((event) =>
          event.id === eventId ? { ...event, allowEmailOnlyBooking: previousValue } : event
        )
      );
      toast.error(message);
    } finally {
      setEventSaving((prev) => ({ ...prev, [eventId]: false }));
    }
  }

  function toggleEnabledType(event: ChangeEvent<HTMLInputElement>) {
    const { value, checked } = event.target;
    setEnabledTypes((prev) => {
      const next = new Set(prev);
      if (checked) {
        next.add(value);
      } else {
        next.delete(value);
        setPrepayTypes((current) => {
          const updated = new Set(current);
          updated.delete(value);
          return updated;
        });
      }
      return next;
    });
  }

  function togglePrepayType(event: ChangeEvent<HTMLInputElement>) {
    const { value, checked } = event.target;
    if (!enabledTypes.has(value)) return;
    setPrepayTypes((prev) => {
      const next = new Set(prev);
      if (checked) {
        next.add(value);
      } else {
        next.delete(value);
      }
      return next;
    });
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    saveSettings();
  }

  async function saveSettings() {
    setSaving(true);
    setAlert(null);

    let prepayAmountValue: number | null = null;
    if (prepayTypes.size > 0 && prepayAmount.trim() !== '') {
      const parsed = Number.parseInt(prepayAmount, 10);
      if (Number.isNaN(parsed)) {
        setAlert({ kind: 'error', message: 'Importo pagamento anticipato non valido' });
        setSaving(false);
        return;
      }
      prepayAmountValue = parsed;
    }

    const coverValue = Number.parseInt(coverCents, 10);
    const dinnerCoverValue = Number.parseInt(dinnerCoverCents, 10);
    const normalizedSite = {
      brandLogoUrl: siteBrandLogoUrl.trim() || null,
      heroImageUrl: siteHeroImageUrl.trim() || null,
      footerRibbonUrl: siteFooterRibbonUrl.trim() || null,
    };

    const payload = {
      enableDateTimeStep: enableDateStep,
      fixedDate: enableDateStep ? null : fixedDate || null,
      fixedTime: enableDateStep ? null : fixedTime || null,
      enabledTypes: Array.from(enabledTypes),
      typeLabels,
      prepayTypes: Array.from(prepayTypes),
      prepayAmountCents: prepayAmountValue,
      coverCents: Number.isNaN(coverValue) || coverValue < 0 ? 0 : coverValue,
      lunchRequirePrepay,
      dinnerCoverCents: Number.isNaN(dinnerCoverValue) || dinnerCoverValue < 0 ? 0 : dinnerCoverValue,
      dinnerRequirePrepay,
      siteBrandLogoUrl: normalizedSite.brandLogoUrl,
      siteHeroImageUrl: normalizedSite.heroImageUrl,
      siteFooterRibbonUrl: normalizedSite.footerRibbonUrl,
      site: normalizedSite,
    };

    try {
      const res = await fetch('/api/admin/settings', {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: 'Errore' }));
        throw new Error(body.error || 'Impossibile salvare le impostazioni');
      }

      setAlert(null);
      toast.success('Impostazioni aggiornate');
    } catch (error: unknown) {
      console.error('[SettingsForm] update error', error);
      const message = error instanceof Error ? error.message : 'Impossibile salvare le impostazioni';
      setAlert({ kind: 'error', message });
    } finally {
      setSaving(false);
    }
  }

  return (
    <form
      onSubmit={onSubmit}
      style={{
        display: 'grid',
        gap: '1.5rem',
        backgroundColor: '#fff',
        padding: '2rem',
        borderRadius: 16,
        boxShadow: '0 10px 30px rgba(15, 23, 42, 0.06)',
      }}
    >
      <header>
        <h2 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 600 }}>Impostazioni prenotazioni</h2>
        <p style={{ margin: '0.5rem 0 0', color: '#6b7280', fontSize: '0.95rem' }}>
          Aggiorna la configurazione visualizzata dal flusso di prenotazione pubblico.
        </p>
      </header>

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

      <section style={{ display: 'grid', gap: '1rem' }}>
        <h3 style={{ margin: 0, fontSize: '1.2rem' }}>Step data e ora</h3>
        <label style={toggleStyle}>
          <input
            type="checkbox"
            checked={enableDateStep}
            onChange={(event) => setEnableDateStep(event.target.checked)}
          />
          Abilita scelta data e ora nel form pubblico
        </label>
        {!enableDateStep && (
          <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
            <label style={labelStyle}>
              <span>Data fissa</span>
              <input type="date" value={fixedDate} onChange={(event) => setFixedDate(event.target.value)} style={inputStyle} />
            </label>
            <label style={labelStyle}>
              <span>Orario fisso</span>
              <input type="time" value={fixedTime} onChange={(event) => setFixedTime(event.target.value)} style={inputStyle} />
            </label>
          </div>
        )}
      </section>

      <section style={sectionStyle}>
        <h3 style={sectionTitleStyle}>Tipologie disponibili</h3>
        <div style={{ display: 'grid', gap: '1rem' }}>
          {typeOptions.map((type) => {
            const enabled = enabledTypes.has(type);
            return (
              <div
                key={type}
                style={{
                  padding: '1rem',
                  borderRadius: 12,
                  border: '1px solid #e5e7eb',
                  backgroundColor: enabled ? '#f9fafb' : '#fdf2f8',
                  display: 'grid',
                  gap: '0.75rem',
                }}
              >
                <label style={toggleStyle}>
                  <input type="checkbox" value={type} checked={enabled} onChange={toggleEnabledType} />
                  {type}
                </label>
                <label style={labelStyle}>
                  <span>Etichetta</span>
                  <input
                    type="text"
                    value={typeLabels[type] ?? type}
                    onChange={(event) => setTypeLabels((prev) => ({ ...prev, [type]: event.target.value }))}
                    style={inputStyle}
                    disabled={!enabled}
                  />
                </label>
                <label style={toggleStyle}>
                  <input
                    type="checkbox"
                    value={type}
                    checked={prepayTypes.has(type)}
                    onChange={togglePrepayType}
                    disabled={!enabled}
                  />
                  Richiede pagamento anticipato
                </label>
              </div>
            );
          })}
        </div>
      </section>

      <section style={{ display: 'grid', gap: '1rem' }}>
        <h3 style={sectionTitleStyle}>Pagamento anticipato</h3>
        <label style={labelStyle}>
          <span>Importo (cent in euro, es. 1500 = €15,00)</span>
          <input
            type="number"
            min={0}
            value={prepayAmount}
            onChange={(event) => setPrepayAmount(event.target.value)}
            style={inputStyle}
            disabled={prepayTypes.size === 0}
          />
        </label>
        <p style={{ margin: 0, color: '#6b7280', fontSize: '0.9rem' }}>
          Tipologie contrassegnate come &quot;richiede pagamento&quot; mostreranno il bottone di pre-pagamento nel
          flusso pubblico. L&apos;importo viene usato anche nei messaggi email.
        </p>
      </section>

      <section style={{ display: 'grid', gap: '1rem' }}>
        <h3 style={sectionTitleStyle}>Pranzo</h3>
        <label style={labelStyle}>
          <span>Coperto (centesimi per persona)</span>
          <input
            type="number"
            min={0}
            value={coverCents}
            onChange={(event) => setCoverCents(event.target.value)}
            style={inputStyle}
          />
        </label>
        <label style={toggleStyle}>
          <input
            type="checkbox"
            checked={lunchRequirePrepay}
            onChange={(event) => setLunchRequirePrepay(event.target.checked)}
          />
          Richiedi pagamento anticipato automaticamente per il pranzo
        </label>
        <p style={{ margin: 0, color: '#6b7280', fontSize: '0.9rem' }}>
          Quando attivo, le prenotazioni per il pranzo utilizzeranno il flusso di prepagamento fittizio
          come gli eventi.
        </p>
      </section>

      <section style={{ display: 'grid', gap: '1rem' }}>
        <h3 style={sectionTitleStyle}>Cena</h3>
        <label style={labelStyle}>
          <span>Coperto cena (centesimi per persona)</span>
          <input
            type="number"
            min={0}
            value={dinnerCoverCents}
            onChange={(event) => setDinnerCoverCents(event.target.value)}
            style={inputStyle}
          />
        </label>
        <label style={toggleStyle}>
          <input
            type="checkbox"
            checked={dinnerRequirePrepay}
            onChange={(event) => setDinnerRequirePrepay(event.target.checked)}
          />
          Richiedi pagamento anticipato automaticamente per la cena
        </label>
        <p style={{ margin: 0, color: '#6b7280', fontSize: '0.9rem' }}>
          Le prenotazioni serali useranno questa configurazione per calcolare coperti e flusso di
          pagamento.
        </p>
      </section>

      <section style={{ display: 'grid', gap: '1rem' }}>
        <h3 style={sectionTitleStyle}>Brand &amp; Immagini sito</h3>
        <p style={{ margin: 0, color: '#6b7280', fontSize: '0.9rem' }}>
          Le immagini sono opzionali. Se lasci i campi vuoti verranno utilizzati i fallback di default mostrati nelle anteprime.
        </p>
        <div style={{ display: 'grid', gap: '1rem', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
          <div style={cardStyle}>
            <label style={labelStyle} htmlFor="siteBrandLogoUrl">
              <span>Logo header (URL)</span>
              <input
                id="siteBrandLogoUrl"
                type="url"
                placeholder="https://..."
                value={siteBrandLogoUrl}
                onChange={(event) => setSiteBrandLogoUrl(event.target.value)}
                style={inputStyle}
              />
            </label>
            <div style={previewWrapperStyle}>
              <span style={previewLabelStyle}>Anteprima</span>
              <img
                src={(siteBrandLogoUrl || '/brand.svg').trim() || '/brand.svg'}
                alt="Anteprima logo"
                style={previewImageStyle}
                loading="lazy"
              />
            </div>
          </div>
          <div style={cardStyle}>
            <label style={labelStyle} htmlFor="siteHeroImageUrl">
              <span>Immagine hero (URL)</span>
              <input
                id="siteHeroImageUrl"
                type="url"
                placeholder="https://..."
                value={siteHeroImageUrl}
                onChange={(event) => setSiteHeroImageUrl(event.target.value)}
                style={inputStyle}
              />
            </label>
            <div style={previewWrapperStyle}>
              <span style={previewLabelStyle}>Anteprima</span>
              <img
                src={(siteHeroImageUrl || '/hero.jpg').trim() || '/hero.jpg'}
                alt="Anteprima immagine hero"
                style={{ ...previewImageStyle, aspectRatio: '16 / 9', objectFit: 'cover' }}
                loading="lazy"
              />
            </div>
          </div>
          <div style={cardStyle}>
            <label style={labelStyle} htmlFor="siteFooterRibbonUrl">
              <span>Ribbon footer (URL)</span>
              <input
                id="siteFooterRibbonUrl"
                type="url"
                placeholder="https://..."
                value={siteFooterRibbonUrl}
                onChange={(event) => setSiteFooterRibbonUrl(event.target.value)}
                style={inputStyle}
              />
            </label>
            <div style={previewWrapperStyle}>
              <span style={previewLabelStyle}>Anteprima</span>
              <img
                src={(siteFooterRibbonUrl || '/ribbon.jpg').trim() || '/ribbon.jpg'}
                alt="Anteprima ribbon footer"
                style={{ ...previewImageStyle, aspectRatio: '7 / 1', objectFit: 'cover' }}
                loading="lazy"
              />
            </div>
          </div>
        </div>
      </section>

      <section style={{ display: 'grid', gap: '1rem' }}>
        <h3 style={sectionTitleStyle}>Eventi – prenotazione via email</h3>
        <p style={{ margin: 0, color: '#6b7280', fontSize: '0.9rem' }}>
          Usa il toggle per abilitare la richiesta senza pagamento per le singole istanze evento.
        </p>
        {eventInstances.length === 0 ? (
          <p style={{ margin: 0, color: '#9ca3af', fontSize: '0.9rem' }}>
            Nessuna istanza evento disponibile.
          </p>
        ) : (
          <div style={{ display: 'grid', gap: '1rem' }}>
            {eventInstances.map((event) => {
              const savingEvent = eventSaving[event.id] ?? false;
              const errorMessage = eventErrors[event.id];
              return (
                <div
                  key={event.id}
                  style={{
                    border: '1px solid #e5e7eb',
                    borderRadius: 12,
                    padding: '1rem',
                    backgroundColor: '#f9fafb',
                    display: 'grid',
                    gap: '0.5rem',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      flexWrap: 'wrap',
                      gap: '0.5rem',
                      alignItems: 'center',
                    }}
                  >
                    <strong style={{ fontSize: '1rem' }}>{event.title}</strong>
                    <span style={{ fontSize: '0.85rem', color: '#6b7280' }}>
                      {formatEventDateTime(event.startAt)}
                    </span>
                    <span style={{ fontSize: '0.85rem', color: '#9ca3af' }}>#{event.slug}</span>
                    {!event.active && (
                      <span
                        style={{
                          fontSize: '0.75rem',
                          color: '#b45309',
                          backgroundColor: '#fef3c7',
                          padding: '0.1rem 0.5rem',
                          borderRadius: 999,
                        }}
                      >
                        Disattivato
                      </span>
                    )}
                  </div>
                  <label style={toggleStyle}>
                    <input
                      type="checkbox"
                      checked={event.allowEmailOnlyBooking}
                      onChange={(evt) => updateEventAllowEmailOnly(event.id, evt.target.checked)}
                      disabled={savingEvent}
                    />
                    Consenti prenotazione solo via email (senza pagamento)
                  </label>
                  {savingEvent && (
                    <span style={{ fontSize: '0.85rem', color: '#2563eb' }}>Salvataggio…</span>
                  )}
                  {errorMessage && (
                    <span style={{ fontSize: '0.85rem', color: '#b91c1c' }}>{errorMessage}</span>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
        <button type="submit" style={primaryButtonStyle} disabled={saving}>
          {saving ? 'Salvataggio…' : 'Salva impostazioni'}
        </button>
      </div>
    </form>
  );
}

export default function SettingsForm(props: Props) {
  return (
    <ToastProvider>
      <SettingsFormInner {...props} />
    </ToastProvider>
  );
}

const labelStyle: CSSProperties = {
  display: 'grid',
  gap: '0.4rem',
  fontSize: '0.95rem',
  color: '#374151',
};

const inputStyle: CSSProperties = {
  padding: '0.65rem 0.85rem',
  borderRadius: 10,
  border: '1px solid #d1d5db',
  fontSize: '0.95rem',
};

const toggleStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '0.65rem',
  fontWeight: 500,
  fontSize: '0.95rem',
};

const sectionStyle: CSSProperties = {
  display: 'grid',
  gap: '1rem',
};

const sectionTitleStyle: CSSProperties = {
  margin: 0,
  fontSize: '1.2rem',
};

const primaryButtonStyle: CSSProperties = {
  padding: '0.75rem 1.5rem',
  borderRadius: 12,
  border: 'none',
  backgroundColor: '#2563eb',
  color: '#fff',
  fontWeight: 600,
  fontSize: '1rem',
  cursor: 'pointer',
};

const cardStyle: CSSProperties = {
  display: 'grid',
  gap: '0.75rem',
  padding: '1rem',
  borderRadius: 12,
  border: '1px solid #e5e7eb',
  backgroundColor: '#f8fafc',
};

const previewWrapperStyle: CSSProperties = {
  display: 'grid',
  gap: '0.5rem',
};

const previewLabelStyle: CSSProperties = {
  fontSize: '0.85rem',
  color: '#6b7280',
};

const previewImageStyle: CSSProperties = {
  width: '100%',
  maxHeight: 160,
  borderRadius: 10,
  border: '1px solid #d1d5db',
  objectFit: 'contain',
  backgroundColor: '#fff',
};
