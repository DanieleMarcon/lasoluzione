'use client';

import { useMemo, useState } from 'react';
import type { ChangeEvent, CSSProperties, FormEvent } from 'react';

import type { AdminSettingsDTO } from '@/types/admin';
import { ToastProvider, useToast } from '@/components/admin/ui/toast';

type Props = {
  settings: AdminSettingsDTO;
  allTypes: string[];
};

type AlertState = {
  kind: 'success' | 'error';
  message: string;
};

function SettingsFormInner({ settings, allTypes }: Props) {
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
  const [saving, setSaving] = useState(false);
  const [alert, setAlert] = useState<AlertState | null>(null);
  const toast = useToast();

  const typeOptions = useMemo(() => allTypes.sort(), [allTypes]);

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
    } catch (error: any) {
      console.error('[SettingsForm] update error', error);
      setAlert({ kind: 'error', message: error?.message ?? 'Impossibile salvare le impostazioni' });
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
          Tipologie contrassegnate come "richiede pagamento" mostreranno il bottone di pre-pagamento nel
          flusso pubblico. L'importo viene usato anche nei messaggi email.
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
