"use client";

import type { CSSProperties, FormEvent } from 'react';

type EventFormState = {
  title: string;
  slug: string;
  startAt: string;
  endAt: string;
  priceEuro: string;
  description: string;
  capacity: string;
  active: boolean;
  showOnHome: boolean;
  emailOnly: boolean;
};

type EventFormProps = {
  values: EventFormState;
  onFieldChange: <K extends keyof EventFormState>(field: K, value: EventFormState[K]) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  submitLabel: string;
  busyLabel?: string;
  busy?: boolean;
  disabled?: boolean;
  onSlugBlur?: () => void;
};

export type { EventFormState, EventFormProps };

export default function EventForm({
  values,
  onFieldChange,
  onSubmit,
  submitLabel,
  busyLabel = 'Salvataggio…',
  busy = false,
  disabled = false,
  onSlugBlur,
}: EventFormProps) {
  return (
    <form onSubmit={onSubmit} style={formStyle}>
      <div style={gridStyle}>
        <label style={labelStyle}>
          Titolo
          <input
            type="text"
            value={values.title}
            onChange={(event) => onFieldChange('title', event.target.value)}
            style={inputStyle}
            placeholder="Titolo evento"
            required
            disabled={disabled || busy}
          />
        </label>
        <label style={labelStyle}>
          Slug
          <input
            type="text"
            value={values.slug}
            onChange={(event) => onFieldChange('slug', event.target.value)}
            onBlur={onSlugBlur}
            style={inputStyle}
            placeholder="slug-evento"
            required
            disabled={disabled || busy}
          />
        </label>
      </div>

      <div style={gridStyle}>
        <label style={labelStyle}>
          Inizio
          <input
            type="datetime-local"
            value={values.startAt}
            onChange={(event) => onFieldChange('startAt', event.target.value)}
            style={inputStyle}
            required
            disabled={disabled || busy}
          />
        </label>
        <label style={labelStyle}>
          Fine
          <input
            type="datetime-local"
            value={values.endAt}
            onChange={(event) => onFieldChange('endAt', event.target.value)}
            style={inputStyle}
            disabled={disabled || busy}
          />
        </label>
        <label style={labelStyle}>
          Capacità
          <input
            type="number"
            min={1}
            value={values.capacity}
            onChange={(event) => onFieldChange('capacity', event.target.value)}
            style={inputStyle}
            placeholder="Es. 50"
            disabled={disabled || busy}
          />
        </label>
      </div>

      <label style={labelStyle}>
        Prezzo (€)
        <input
          type="text"
          inputMode="decimal"
          value={values.priceEuro}
          onChange={(event) => onFieldChange('priceEuro', event.target.value)}
          style={inputStyle}
          placeholder="0,00"
          required
          disabled={disabled || busy}
        />
      </label>

      <label style={{ ...labelStyle, fontSize: '0.95rem' }}>
        Descrizione
        <textarea
          value={values.description}
          onChange={(event) => onFieldChange('description', event.target.value)}
          style={textareaStyle}
          rows={4}
          maxLength={2000}
          disabled={disabled || busy}
        />
      </label>

      <div style={checkboxRowStyle}>
        <label style={checkboxLabel}>
          <input
            type="checkbox"
            checked={values.active}
            onChange={(event) => onFieldChange('active', event.target.checked)}
            disabled={disabled || busy}
          />
          <span>Attivo</span>
        </label>
        <label style={checkboxLabel}>
          <input
            type="checkbox"
            checked={values.showOnHome}
            onChange={(event) => onFieldChange('showOnHome', event.target.checked)}
            disabled={disabled || busy}
          />
          <span>Mostra in home</span>
        </label>
        <label style={checkboxLabel}>
          <input
            type="checkbox"
            checked={values.emailOnly}
            onChange={(event) => onFieldChange('emailOnly', event.target.checked)}
            disabled={disabled || busy}
          />
          <span>Prenotazione solo email</span>
        </label>
      </div>

      <div>
        <button type="submit" style={submitButtonStyle} disabled={disabled || busy}>
          {busy ? busyLabel : submitLabel}
        </button>
      </div>
    </form>
  );
}

const formStyle: CSSProperties = {
  display: 'grid',
  gap: '1.25rem',
};

const gridStyle: CSSProperties = {
  display: 'grid',
  gap: '1rem',
  gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
};

const labelStyle: CSSProperties = {
  display: 'grid',
  gap: '0.35rem',
  fontSize: '0.95rem',
};

const inputStyle: CSSProperties = {
  padding: '0.6rem 0.75rem',
  borderRadius: 10,
  border: '1px solid rgba(148,163,184,0.35)',
  backgroundColor: '#111827',
  color: '#f9fafb',
};

const textareaStyle: CSSProperties = {
  ...inputStyle,
  minHeight: 120,
  resize: 'vertical',
};

const checkboxRowStyle: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: '1.5rem',
};

const checkboxLabel: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '0.5rem',
};

const submitButtonStyle: CSSProperties = {
  padding: '0.65rem 1.2rem',
  borderRadius: 10,
  border: 'none',
  backgroundColor: '#2563eb',
  color: '#fff',
  fontWeight: 600,
  cursor: 'pointer',
};
